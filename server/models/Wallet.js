import mongoose from 'mongoose';
const { Schema } = mongoose;

export const TRANSFER_LIMITS = {
  MIN_AMOUNT:  1,
  MAX_AMOUNT:  10_000,
  DAILY_LIMIT: 25_000,
};

export const WITHDRAWAL_LIMITS = {
  MIN_AMOUNT:  100,
  MAX_AMOUNT:  50_000,
  DAILY_LIMIT: 100_000, // FIX BUG 8: was 1_00_000 (misleading Indian separator) → explicit 100_000
};

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
    razorpayFundAccountId: { type: String }, // Razorpay fund account ID for payouts
    // REMOVED: razorpayContactId — contact created per payout, not stored per account
    addedAt:   { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Request Sub-Schema
// ─────────────────────────────────────────────────────────────────────────────
const withdrawalRequestSchema = new Schema(
  {
    requestId: {
      type:    String,
      default: () => `WDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    },
    amount: { type: Number, required: true, min: 1 },
    bankAccountId:     { type: Schema.Types.ObjectId },
    accountHolderName: { type: String },
    accountNumber:     { type: String }, // stores last-4 digits only
    ifscCode:          { type: String },
    bankName:          { type: String },
    status: {
      type:    String,
      enum:    ['Pending', 'Approved', 'Completed', 'Failed', 'Rejected'],
      default: 'Pending',
    },
    razorpayPayoutId:     { type: String },
    razorpayPayoutStatus: { type: String },
    // REMOVED: walletTransactionId — no method ever sets this field
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    adminNote:  { type: String, trim: true },
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
        'Add_Money',
        'Booking_Payment',
        'Medicine_Purchase',
        'Refund',
        'Referral_Bonus',
        'Subscription_Fee',
        'Coin_Conversion',
        'Admin_Credit',
        'Admin_Debit',
        'Cashback',
        // REMOVED: P2P_Send, P2P_Receive — UPI P2P not supported via Razorpay payout
        'Withdrawal_Debit',
        'Withdrawal_Reversal',
      ],
    },
    // REMOVED: pairTxnId       — P2P pairing, no longer needed
    // REMOVED: counterpartyId  — P2P pairing, no longer needed
    // REMOVED: counterpartyUpiId — UPI handled by Razorpay, not stored
    // REMOVED: transferMode    — P2P UPI field, no longer needed
    withdrawalRequestId: { type: String },
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
    },
    balance: {
      type:     Number,
      required: true,
      default:  0.00,
      min:      [0, 'Wallet balance cannot be negative'],
    },
    lockedBalance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    withdrawableBalance: {
      type:    Number,
      default: 0,
      min:     [0, 'Withdrawable balance cannot be negative'],
    },
    // REMOVED: upiId — UPI handled entirely by Razorpay, not stored on wallet
    bankAccounts: {
      type:    [bankAccountSchema],
      default: [],
    },
    withdrawalRequests: {
      type:    [withdrawalRequestSchema],
      default: [],
    },
    dailyWithdrawalTotal: { type: Number, default: 0 },
    dailyWithdrawalDate:  { type: String },
    totalCredited:     { type: Number, default: 0 },
    totalDebited:      { type: Number, default: 0 },
    totalWithdrawn:    { type: Number, default: 0 },
    lastTransactionAt: { type: Date },
    // REMOVED: dailyTransferTotal, dailyTransferDate — P2P transfer tracking, no longer needed
    transactions: { type: [walletTransactionSchema], default: [] },
    isActive: { type: Boolean, default: true },
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

walletSchema.virtual('availableBalance').get(function () {
  return Math.max(0, +(this.balance - this.lockedBalance).toFixed(2));
});

walletSchema.virtual('withdrawableAvailable').get(function () {
  return Math.max(0, +(this.withdrawableBalance - this.lockedBalance).toFixed(2));
});

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
// Pre-validate Hook
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
    // FIX BUG 6: capture _newTxnCount before clearing it, default to 1 only once
    const newCount = this._newTxnCount ?? 1;
    this._newTxnCount = undefined; // clear BEFORE save triggers to prevent double-count
    const newTxns  = this.transactions.slice(-newCount);

    for (const txn of newTxns) {
      if (txn.type === 'Credit') {
        this.totalCredited = +(this.totalCredited + txn.amount).toFixed(2);
      } else if (txn.type === 'Debit') {
        this.totalDebited = +(this.totalDebited + txn.amount).toFixed(2);
      }

      if (txn.type === 'Credit' && WITHDRAWABLE_PURPOSES.has(txn.purpose)) {
        this.withdrawableBalance = +(this.withdrawableBalance + txn.amount).toFixed(2);
      }
      // FIX BUG 1: Withdrawal_Reversal is NOT in WITHDRAWABLE_PURPOSES — correct.
      // But track withdrawableBalanceAfter on the txn here directly while we have the
      // updated value, so the second save in credit() gets the right snapshot.
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

      // FIX BUG 1: set withdrawableBalanceAfter inline here so credit()'s second save
      // is no longer needed — value is accurate at pre-save time
      txn.withdrawableBalanceAfter = this.withdrawableBalance;
    }

    const latest = this.transactions[this.transactions.length - 1];
    if (latest?.timestamp) this.lastTransactionAt = latest.timestamp;

    if (this.transactions.length > 1000) {
      this.transactions = this.transactions.slice(-1000);
    }
  }

  if (this.withdrawalRequests.length > 500) {
    this.withdrawalRequests = this.withdrawalRequests.slice(-500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────────────────────

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
    withdrawalRequestId:      options.withdrawalRequestId,
    timestamp:                new Date(),
  });

  this._newTxnCount = 1;
  // FIX BUG 1: withdrawableBalanceAfter now set in pre-save hook — second save removed
  return this.save();
};

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
    withdrawalRequestId:      options.withdrawalRequestId,
    timestamp:                new Date(),
  });

  this._newTxnCount = 1;
  return this.save();
};

walletSchema.methods.addBankAccount = async function (details) {
  if (this.bankAccounts.length >= 3) {
    throw new Error('Maximum 3 bank accounts allowed. Please remove one to add a new account.');
  }

  const isFirst     = this.bankAccounts.length === 0;
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

walletSchema.methods.setPrimaryBankAccount = async function (bankAccountId) {
  const target = this.bankAccounts.id(bankAccountId);
  if (!target) throw new Error('Bank account not found');

  this.bankAccounts.forEach(acc => { acc.isPrimary = false; });
  target.isPrimary = true;
  target.updatedAt = new Date();

  return this.save();
};

walletSchema.methods.removeBankAccount = async function (bankAccountId) {
  const target = this.bankAccounts.id(bankAccountId);
  if (!target) throw new Error('Bank account not found');

  if (target.isPrimary && this.bankAccounts.length > 1) {
    throw new Error('Cannot remove the primary account while others exist. Set a new primary first.');
  }

  target.deleteOne();
  return this.save();
};

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
    accountNumber:     bankAccount.accountNumber.slice(-4), // store last-4 only
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

  // FIX BUG 2: debit FIRST, then mark Completed only if debit succeeds
  // Previously: status set to Completed → save → debit (if debit throws, stuck as Completed)
  this.lockedBalance = Math.max(0, +(this.lockedBalance - amount).toFixed(2));

  // FIX BUG 3: request.accountNumber already holds last-4 digits only (set in requestWithdrawal)
  // Description must NOT re-apply XXXX prefix — just use the stored masked value directly
  await this.debit(amount, 'Withdrawal_Debit', {
    description:         `Bank withdrawal to XXXX${request.accountNumber}`,
    initiatedBy:         reviewedBy,
    withdrawalRequestId: requestId,
  });

  // Mark Completed only after debit succeeds
  request.status           = 'Completed';
  request.razorpayPayoutId = razorpayPayoutId;
  request.reviewedBy       = reviewedBy;
  request.reviewedAt       = new Date();
  request.completedAt      = new Date();

  return this.save();
};

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

  // FIX BUG 4: call getDailyWithdrawalTotal() first to reset stale date before decrementing
  // Previously: direct decrement on dailyWithdrawalTotal without date check → wrong value if next day
  const currentDailyTotal = this.getDailyWithdrawalTotal();
  this.dailyWithdrawalTotal = Math.max(
    0,
    +(currentDailyTotal - amount).toFixed(2)
  );

  request.status     = 'Rejected';
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date();
  request.adminNote  = adminNote;

  return this.save();
};

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

  // FIX BUG 4 (same pattern): reset stale date before decrementing
  const currentDailyTotal = this.getDailyWithdrawalTotal();
  this.dailyWithdrawalTotal = Math.max(
    0,
    +(currentDailyTotal - amount).toFixed(2)
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
// Daily Withdrawal Helpers
// REMOVED: getDailyTransferTotal, incrementDailyTransfer — P2P transfer tracking removed
// ─────────────────────────────────────────────────────────────────────────────

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
walletSchema.index({ 'transactions.transactionId': 1 });
walletSchema.index({ 'transactions.timestamp': -1 });
// REMOVED: transactions.pairTxnId index — P2P field removed
walletSchema.index({ 'transactions.withdrawalRequestId': 1 });
walletSchema.index({ 'withdrawalRequests.requestId': 1 });
walletSchema.index({ 'withdrawalRequests.status': 1 });
walletSchema.index({ 'bankAccounts.ifscCode': 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;