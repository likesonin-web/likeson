import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * Wallet Model — Likeson.in
 *
 * One wallet per User. Stores running balance and a full transaction ledger.
 *
 * Features:
 *  - Wallet top-up via Razorpay
 *  - Wallet-to-wallet P2P transfers via UPI ID / phone number / QR scan
 *  - lockedBalance for pending reservations
 *  - Running totals (totalCredited, totalDebited) updated safely in pre-save
 *  - Transfer limits: min ₹1, max ₹10,000/txn, daily cap ₹25,000
 *  - UPI ID stored per user; phone number used as secondary lookup key
 *  - Full transaction ledger capped at 1000 entries (archive older via cron)
 *  - Bank account details (up to 3 accounts per wallet, one primary)
 *  - withdrawableBalance: only Add_Money + Referral_Bonus credits are withdrawable
 *  - Withdrawal requests with admin approval flow
 *  - Withdrawal limits: min ₹100, max ₹50,000/request, daily cap ₹1,00,000
 */

// ─────────────────────────────────────────────────────────────────────────────
// Transfer Limits
// ─────────────────────────────────────────────────────────────────────────────
export const TRANSFER_LIMITS = {
  MIN_AMOUNT:  1,
  MAX_AMOUNT:  10_000,
  DAILY_LIMIT: 25_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Limits  ← THIS IS WHAT THE ROUTER IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
export const WITHDRAWAL_LIMITS = {
  MIN_AMOUNT:  100,
  MAX_AMOUNT:  50_000,
  DAILY_LIMIT: 1_00_000,
};

/**
 * Purposes that contribute to withdrawableBalance.
 * Only money the user genuinely "earned or topped up" can be withdrawn.
 */
export const WITHDRAWABLE_PURPOSES = new Set([
  'Add_Money',
  'Referral_Bonus',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Bank Account Sub-Schema
// ─────────────────────────────────────────────────────────────────────────────
const bankAccountSchema = new Schema(
  {
    accountHolderName: { type: String, required: true, trim: true },

    accountNumber: {
      type:     String,
      required: true,
      trim:     true,
      // Never log or expose; mask in API responses
    },

    ifscCode: {
      type:      String,
      required:  true,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'],
    },

    bankName:   { type: String, trim: true },
    branchName: { type: String, trim: true },

    accountType: {
      type:    String,
      enum:    ['Savings', 'Current', 'Salary'],
      default: 'Savings',
    },

    isPrimary:  { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },

    // Razorpay Payout integration
    razorpayFundAccountId: { type: String },
    razorpayContactId:     { type: String },

    addedAt:   { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Request Sub-Schema
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Flow:
 *   User submits   → status: Pending
 *   Admin approves → status: Approved  → payout initiated
 *   Payout success → status: Completed → wallet.withdrawableBalance reduced
 *   Payout failed  → status: Failed    → lockedBalance released
 *   Admin rejects  → status: Rejected  → lockedBalance released
 */
const withdrawalRequestSchema = new Schema(
  {
    requestId: {
      type:    String,
      default: () => `WDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      index:   true,
    },

    amount: { type: Number, required: true, min: 1 },

    // Snapshot of bank account at time of request
    bankAccountId:     { type: Schema.Types.ObjectId },
    accountHolderName: { type: String },
    accountNumber:     { type: String },   // last 4 digits stored for display
    ifscCode:          { type: String },
    bankName:          { type: String },

    status: {
      type:    String,
      enum:    ['Pending', 'Approved', 'Completed', 'Failed', 'Rejected'],
      default: 'Pending',
      index:   true,
    },

    // Razorpay payout details
    razorpayPayoutId:     { type: String },
    razorpayPayoutStatus: { type: String },

    // Linked wallet transaction
    walletTransactionId: { type: String },

    // Admin action
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    adminNote:  { type: String, trim: true },

    // Failure tracking
    failureReason: { type: String, trim: true },
    retryCount:    { type: Number, default: 0 },

    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Sub-Schema
// ─────────────────────────────────────────────────────────────────────────────
const walletTransactionSchema = new Schema(
  {
    transactionId: {
      type:     String,
      required: true,
      default:  () => `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      index:    true,
    },

    type: {
      type:     String,
      enum:     ['Credit', 'Debit'],
      required: true,
    },

    amount: { type: Number, required: true, min: 0 },

    purpose: {
      type:     String,
      required: true,
      enum: [
        'Add_Money',           // top-up via payment gateway          ← WITHDRAWABLE
        'Booking_Payment',     // deducted for booking
        'Medicine_Purchase',   // deducted for pharmacy order
        'Refund',              // credited from cancelled booking / order
        'Referral_Bonus',      // credited for referring a new user   ← WITHDRAWABLE
        'Subscription_Fee',    // deducted for plan purchase
        'Coin_Conversion',     // credited when coins are redeemed to wallet
        'Admin_Credit',        // manual credit by admin
        'Admin_Debit',         // manual debit by admin
        'Cashback',            // promotional cashback
        'P2P_Send',            // outgoing wallet-to-wallet transfer
        'P2P_Receive',         // incoming wallet-to-wallet transfer
        'Withdrawal_Debit',    // deducted when bank withdrawal is completed
        'Withdrawal_Reversal', // credited back if withdrawal fails/rejected
      ],
    },

    // ── P2P transfer metadata ─────────────────────────────────────────────
    pairTxnId:         { type: String, index: true },
    counterpartyId:    { type: Schema.Types.ObjectId, ref: 'User' },
    counterpartyUpiId: { type: String },
    transferMode: {
      type: String,
      enum: ['upi_id', 'phone', 'qr'],
    },

    // ── Withdrawal metadata ───────────────────────────────────────────────
    withdrawalRequestId: { type: String, index: true },

    // ── Polymorphic reference (non-P2P) ──────────────────────────────────
    referenceId: { type: Schema.Types.ObjectId, refPath: 'transactions.onModel' },
    onModel: {
      type: String,
      enum: ['Booking', 'PharmacyOrder', 'Payment', 'UserSubscription', 'User'],
    },

    status: {
      type:    String,
      enum:    ['Success', 'Pending', 'Failed', 'Reversed'],
      default: 'Success',
    },

    balanceBefore: { type: Number },
    balanceAfter:  { type: Number },

    // Withdrawable balance snapshot
    withdrawableBalanceBefore: { type: Number },
    withdrawableBalanceAfter:  { type: Number },

    description: { type: String, trim: true },
    note:        { type: String, trim: true },

    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    timestamp:   { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Wallet Schema
// ─────────────────────────────────────────────────────────────────────────────
const walletSchema = new Schema(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Balance ───────────────────────────────────────────────────────────
    balance: {
      type:     Number,
      required: true,
      default:  0.00,
      min:      [0, 'Wallet balance cannot be negative'],
    },

    lockedBalance: { type: Number, default: 0, min: 0 },

    currency: { type: String, default: 'INR' },

    // ── Withdrawable Balance ──────────────────────────────────────────────
    /**
     * Tracks only the money eligible to leave the platform via bank transfer.
     * Increased by: Add_Money, Referral_Bonus, Withdrawal_Reversal
     * Decreased by: Withdrawal_Debit
     * Invariant: withdrawableBalance <= balance
     */
    withdrawableBalance: {
      type:    Number,
      default: 0,
      min:     [0, 'Withdrawable balance cannot be negative'],
    },

    // ── UPI Identity ──────────────────────────────────────────────────────
    upiId: {
      type:      String,
      unique:    true,
      sparse:    true,
      trim:      true,
      lowercase: true,
      index:     true,
    },

    // ── Bank Accounts ─────────────────────────────────────────────────────
    // Max 3 per wallet — enforced via pre-validate hook
    bankAccounts: {
      type:    [bankAccountSchema],
      default: [],
    },

    // ── Withdrawal Requests ───────────────────────────────────────────────
    // Capped at 500 entries; archive older via cron
    withdrawalRequests: {
      type:    [withdrawalRequestSchema],
      default: [],
    },

    // ── Daily Withdrawal Tracking ─────────────────────────────────────────
    dailyWithdrawalTotal: { type: Number, default: 0 },
    dailyWithdrawalDate:  { type: String }, // 'YYYY-MM-DD' IST

    // ── Running Totals ────────────────────────────────────────────────────
    totalCredited:     { type: Number, default: 0 },
    totalDebited:      { type: Number, default: 0 },
    totalWithdrawn:    { type: Number, default: 0 },
    lastTransactionAt: { type: Date },

    // ── Daily Transfer Tracking ───────────────────────────────────────────
    dailyTransferTotal: { type: Number, default: 0 },
    dailyTransferDate:  { type: String },

    // ── Transaction Ledger ────────────────────────────────────────────────
    transactions: { type: [walletTransactionSchema], default: [] },

    isActive: { type: Boolean, default: true },

    // ── Audit ─────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────────────────────────────────────

/** Amount freely spendable on the platform right now. */
walletSchema.virtual('availableBalance').get(function () {
  return Math.max(0, +(this.balance - this.lockedBalance).toFixed(2));
});

/**
 * withdrawableAvailable: withdrawable portion not locked by a pending request.
 * This is the ceiling for new withdrawal requests.
 */
walletSchema.virtual('withdrawableAvailable').get(function () {
  return Math.max(0, +(this.withdrawableBalance - this.lockedBalance).toFixed(2));
});

/** Safe masked primary bank account for API responses. */
walletSchema.virtual('primaryBankAccount').get(function () {
  const primary = this.bankAccounts.find(b => b.isPrimary) ?? this.bankAccounts[0];
  if (!primary) return null;
  return {
    _id:               primary._id,
    accountHolderName: primary.accountHolderName,
    maskedAccount:     `XXXX${primary.accountNumber.slice(-4)}`,
    ifscCode:          primary.ifscCode,
    bankName:          primary.bankName,
    accountType:       primary.accountType,
    isVerified:        primary.isVerified,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const todayIST = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ─────────────────────────────────────────────────────────────────────────────
// Pre-validate Hook — bank account cap
// ─────────────────────────────────────────────────────────────────────────────

walletSchema.pre('validate', function () {
  if (this.bankAccounts.length > 3) {
    this.invalidate('bankAccounts', 'A wallet can hold a maximum of 3 bank accounts.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Pre-save Hook
// ─────────────────────────────────────────────────────────────────────────────

walletSchema.pre('save', async function () {
  if (this.isModified('transactions') && this.transactions.length > 0) {
    const newCount = this._newTxnCount ?? 1;
    const newTxns  = this.transactions.slice(-newCount);

    for (const txn of newTxns) {
      // Running totals
      if (txn.type === 'Credit') {
        this.totalCredited = +(this.totalCredited + txn.amount).toFixed(2);
      } else if (txn.type === 'Debit') {
        this.totalDebited = +(this.totalDebited + txn.amount).toFixed(2);
      }

      // Withdrawable balance maintenance
      if (txn.type === 'Credit' && WITHDRAWABLE_PURPOSES.has(txn.purpose)) {
        this.withdrawableBalance = +(this.withdrawableBalance + txn.amount).toFixed(2);
      }
      if (txn.type === 'Credit' && txn.purpose === 'Withdrawal_Reversal') {
        this.withdrawableBalance = +(this.withdrawableBalance + txn.amount).toFixed(2);
      }
      if (txn.type === 'Debit' && txn.purpose === 'Withdrawal_Debit') {
        this.withdrawableBalance = Math.max(
          0,
          +(this.withdrawableBalance - txn.amount).toFixed(2)
        );
        this.totalWithdrawn = +(this.totalWithdrawn + txn.amount).toFixed(2);
      }
    }

    const latest = this.transactions[this.transactions.length - 1];
    if (latest?.timestamp) this.lastTransactionAt = latest.timestamp;

    if (this.transactions.length > 1000) {
      this.transactions = this.transactions.slice(-1000);
    }
  }

  // Archive old withdrawal requests
  if (this.withdrawalRequests.length > 500) {
    this.withdrawalRequests = this.withdrawalRequests.slice(-500);
  }

  this._newTxnCount = undefined;
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * credit(amount, purpose, options)
 * Credits the wallet and appends a transaction record.
 */
walletSchema.methods.credit = async function (amount, purpose, options = {}) {
  if (amount <= 0) throw new Error('Credit amount must be positive');

  const balanceBefore             = this.balance;
  const withdrawableBalanceBefore = this.withdrawableBalance;

  this.balance = +(this.balance + amount).toFixed(2);

  this.transactions.push({
    ...(options.transactionId ? { transactionId: options.transactionId } : {}),
    type:                     'Credit',
    amount,
    purpose,
    status:                   'Success',
    balanceBefore,
    balanceAfter:             this.balance,
    withdrawableBalanceBefore,
    referenceId:              options.referenceId,
    onModel:                  options.onModel,
    description:              options.description,
    initiatedBy:              options.initiatedBy,
    note:                     options.note,
    pairTxnId:                options.pairTxnId,
    counterpartyId:           options.counterpartyId,
    counterpartyUpiId:        options.counterpartyUpiId,
    transferMode:             options.transferMode,
    withdrawalRequestId:      options.withdrawalRequestId,
    timestamp:                new Date(),
  });

  this._newTxnCount = 1;
  const saved = await this.save();

  // Back-fill withdrawableBalanceAfter
  const lastTxn = saved.transactions[saved.transactions.length - 1];
  if (lastTxn) {
    lastTxn.withdrawableBalanceAfter = saved.withdrawableBalance;
    await saved.save();
  }
  return saved;
};

/**
 * debit(amount, purpose, options)
 * Debits the wallet. Throws if available balance is insufficient.
 * For Withdrawal_Debit also validates withdrawableBalance.
 */
walletSchema.methods.debit = async function (amount, purpose, options = {}) {
  if (amount <= 0) throw new Error('Debit amount must be positive');

  if (this.availableBalance < amount) {
    throw new Error(
      `Insufficient wallet balance. Available: ₹${this.availableBalance}, Required: ₹${amount}`
    );
  }

  if (purpose === 'Withdrawal_Debit' && this.withdrawableBalance < amount) {
    throw new Error(
      `Insufficient withdrawable balance. Withdrawable: ₹${this.withdrawableBalance}, Required: ₹${amount}`
    );
  }

  const balanceBefore             = this.balance;
  const withdrawableBalanceBefore = this.withdrawableBalance;

  this.balance = +(this.balance - amount).toFixed(2);

  this.transactions.push({
    ...(options.transactionId ? { transactionId: options.transactionId } : {}),
    type:                     'Debit',
    amount,
    purpose,
    status:                   'Success',
    balanceBefore,
    balanceAfter:             this.balance,
    withdrawableBalanceBefore,
    referenceId:              options.referenceId,
    onModel:                  options.onModel,
    description:              options.description,
    initiatedBy:              options.initiatedBy,
    note:                     options.note,
    pairTxnId:                options.pairTxnId,
    counterpartyId:           options.counterpartyId,
    counterpartyUpiId:        options.counterpartyUpiId,
    transferMode:             options.transferMode,
    withdrawalRequestId:      options.withdrawalRequestId,
    timestamp:                new Date(),
  });

  this._newTxnCount = 1;
  return this.save();
};

/**
 * addBankAccount(details)
 * Adds a new bank account (max 3). Auto-sets primary if first.
 */
walletSchema.methods.addBankAccount = async function (details) {
  if (this.bankAccounts.length >= 3) {
    throw new Error('Maximum 3 bank accounts allowed. Please remove one to add a new account.');
  }

  const isFirst    = this.bankAccounts.length === 0;
  const makePrimary = isFirst || details.isPrimary === true;

  if (makePrimary) {
    this.bankAccounts.forEach(acc => { acc.isPrimary = false; });
  }

  this.bankAccounts.push({
    ...details,
    isPrimary:  makePrimary,
    isVerified: false,
    addedAt:    new Date(),
    updatedAt:  new Date(),
  });

  return this.save();
};

/**
 * setPrimaryBankAccount(bankAccountId)
 * Marks the given account as primary; clears the flag on all others.
 */
walletSchema.methods.setPrimaryBankAccount = async function (bankAccountId) {
  const target = this.bankAccounts.id(bankAccountId);
  if (!target) throw new Error('Bank account not found');

  this.bankAccounts.forEach(acc => { acc.isPrimary = false; });
  target.isPrimary = true;
  target.updatedAt = new Date();

  return this.save();
};

/**
 * removeBankAccount(bankAccountId)
 * Removes a bank account. Cannot remove primary while others exist.
 */
walletSchema.methods.removeBankAccount = async function (bankAccountId) {
  const target = this.bankAccounts.id(bankAccountId);
  if (!target) throw new Error('Bank account not found');

  if (target.isPrimary && this.bankAccounts.length > 1) {
    throw new Error('Cannot remove the primary account while others exist. Set a new primary first.');
  }

  target.deleteOne();
  return this.save();
};

/**
 * requestWithdrawal({ amount, bankAccountId, initiatedBy })
 * Creates a Pending withdrawal request and locks the amount.
 */
walletSchema.methods.requestWithdrawal = async function ({
  amount,
  bankAccountId,
  initiatedBy,
} = {}) {
  if (!amount || amount <= 0) throw new Error('Withdrawal amount must be positive');

  if (amount < WITHDRAWAL_LIMITS.MIN_AMOUNT) {
    throw new Error(`Minimum withdrawal amount is ₹${WITHDRAWAL_LIMITS.MIN_AMOUNT}`);
  }
  if (amount > WITHDRAWAL_LIMITS.MAX_AMOUNT) {
    throw new Error(`Maximum withdrawal amount per request is ₹${WITHDRAWAL_LIMITS.MAX_AMOUNT}`);
  }

  const dailyUsed = this.getDailyWithdrawalTotal();
  if (dailyUsed + amount > WITHDRAWAL_LIMITS.DAILY_LIMIT) {
    const remaining = +(WITHDRAWAL_LIMITS.DAILY_LIMIT - dailyUsed).toFixed(2);
    throw new Error(
      `Daily withdrawal limit exceeded. You can withdraw ₹${remaining} more today.`
    );
  }

  const bankAccount = this.bankAccounts.id(bankAccountId);
  if (!bankAccount) throw new Error('Bank account not found');
  if (!bankAccount.isVerified) {
    throw new Error('Bank account is not verified yet. Please wait for verification before withdrawing.');
  }

  if (this.withdrawableAvailable < amount) {
    throw new Error(
      `Insufficient withdrawable balance. Available to withdraw: ₹${this.withdrawableAvailable}`
    );
  }

  const requestId = `WDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  this.withdrawalRequests.push({
    requestId,
    amount,
    bankAccountId:     bankAccount._id,
    accountHolderName: bankAccount.accountHolderName,
    accountNumber:     bankAccount.accountNumber.slice(-4),
    ifscCode:          bankAccount.ifscCode,
    bankName:          bankAccount.bankName,
    status:            'Pending',
    requestedAt:       new Date(),
  });

  this.lockedBalance = +(this.lockedBalance + amount).toFixed(2);
  this.incrementDailyWithdrawal(amount);

  const saved   = await this.save();
  const request = saved.withdrawalRequests.find(r => r.requestId === requestId);
  return { wallet: saved, request };
};

/**
 * completeWithdrawal({ requestId, razorpayPayoutId, reviewedBy })
 * Releases lock and debits wallet after payout succeeds.
 */
walletSchema.methods.completeWithdrawal = async function ({
  requestId,
  razorpayPayoutId,
  reviewedBy,
} = {}) {
  const request = this.withdrawalRequests.find(r => r.requestId === requestId);
  if (!request) throw new Error('Withdrawal request not found');
  if (!['Pending', 'Approved'].includes(request.status)) {
    throw new Error(`Cannot complete a withdrawal in status: ${request.status}`);
  }

  const { amount } = request;

  this.lockedBalance = Math.max(0, +(this.lockedBalance - amount).toFixed(2));

  request.status           = 'Completed';
  request.razorpayPayoutId = razorpayPayoutId;
  request.reviewedBy       = reviewedBy;
  request.reviewedAt       = new Date();
  request.completedAt      = new Date();

  await this.save();

  return this.debit(amount, 'Withdrawal_Debit', {
    description:         `Bank withdrawal to XXXX${request.accountNumber}`,
    initiatedBy:         reviewedBy,
    withdrawalRequestId: requestId,
  });
};

/**
 * rejectWithdrawal({ requestId, reviewedBy, adminNote })
 * Admin rejection — releases the locked amount.
 */
walletSchema.methods.rejectWithdrawal = async function ({
  requestId,
  reviewedBy,
  adminNote,
} = {}) {
  const request = this.withdrawalRequests.find(r => r.requestId === requestId);
  if (!request) throw new Error('Withdrawal request not found');
  if (request.status !== 'Pending') {
    throw new Error(`Can only reject a Pending request. Current status: ${request.status}`);
  }

  const { amount } = request;

  this.lockedBalance = Math.max(0, +(this.lockedBalance - amount).toFixed(2));
  this.dailyWithdrawalTotal = Math.max(
    0,
    +(this.dailyWithdrawalTotal - amount).toFixed(2)
  );

  request.status     = 'Rejected';
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date();
  request.adminNote  = adminNote;

  return this.save();
};

/**
 * failWithdrawal({ requestId, failureReason, reviewedBy })
 * Payout failed — releases lock and credits reversal back.
 */
walletSchema.methods.failWithdrawal = async function ({
  requestId,
  failureReason,
  reviewedBy,
} = {}) {
  const request = this.withdrawalRequests.find(r => r.requestId === requestId);
  if (!request) throw new Error('Withdrawal request not found');
  if (!['Pending', 'Approved'].includes(request.status)) {
    throw new Error(`Cannot fail a withdrawal in status: ${request.status}`);
  }

  const { amount } = request;

  this.lockedBalance = Math.max(0, +(this.lockedBalance - amount).toFixed(2));
  this.dailyWithdrawalTotal = Math.max(
    0,
    +(this.dailyWithdrawalTotal - amount).toFixed(2)
  );

  request.status        = 'Failed';
  request.failureReason = failureReason;
  request.reviewedBy    = reviewedBy;
  request.reviewedAt    = new Date();
  request.retryCount    = (request.retryCount ?? 0) + 1;

  await this.save();

  return this.credit(amount, 'Withdrawal_Reversal', {
    description:         `Reversal: failed withdrawal ${requestId}`,
    initiatedBy:         reviewedBy,
    withdrawalRequestId: requestId,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Daily Transfer / Withdrawal Helpers
// ─────────────────────────────────────────────────────────────────────────────

walletSchema.methods.getDailyTransferTotal = function () {
  const today = todayIST();
  if (this.dailyTransferDate !== today) {
    this.dailyTransferTotal = 0;
    this.dailyTransferDate  = today;
  }
  return this.dailyTransferTotal;
};

walletSchema.methods.incrementDailyTransfer = function (amount) {
  const today = todayIST();
  if (this.dailyTransferDate !== today) {
    this.dailyTransferTotal = 0;
    this.dailyTransferDate  = today;
  }
  this.dailyTransferTotal = +(this.dailyTransferTotal + amount).toFixed(2);
};

walletSchema.methods.getDailyWithdrawalTotal = function () {
  const today = todayIST();
  if (this.dailyWithdrawalDate !== today) {
    this.dailyWithdrawalTotal = 0;
    this.dailyWithdrawalDate  = today;
  }
  return this.dailyWithdrawalTotal;
};

walletSchema.methods.incrementDailyWithdrawal = function (amount) {
  const today = todayIST();
  if (this.dailyWithdrawalDate !== today) {
    this.dailyWithdrawalTotal = 0;
    this.dailyWithdrawalDate  = today;
  }
  this.dailyWithdrawalTotal = +(this.dailyWithdrawalTotal + amount).toFixed(2);
};

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

walletSchema.index({ user: 1 });
walletSchema.index({ upiId: 1 });
walletSchema.index({ 'transactions.transactionId': 1 });
walletSchema.index({ 'transactions.timestamp': -1 });
walletSchema.index({ 'transactions.pairTxnId': 1 });
walletSchema.index({ 'transactions.withdrawalRequestId': 1 });
walletSchema.index({ 'withdrawalRequests.requestId': 1 });
walletSchema.index({ 'withdrawalRequests.status': 1 });
walletSchema.index({ 'bankAccounts.ifscCode': 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;