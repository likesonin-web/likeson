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
  DAILY_LIMIT: 1_00_000,
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
const withdrawalRequestSchema = new Schema(
  {
    // index removed here — defined once via schema.index() below
    requestId: {
      type:    String,
      default: () => `WDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    },
    amount: { type: Number, required: true, min: 1 },
    bankAccountId:     { type: Schema.Types.ObjectId },
    accountHolderName: { type: String },
    accountNumber:     { type: String },
    ifscCode:          { type: String },
    bankName:          { type: String },
    // index removed here — defined once via schema.index() below
    status: {
      type:    String,
      enum:    ['Pending', 'Approved', 'Completed', 'Failed', 'Rejected'],
      default: 'Pending',
    },
    razorpayPayoutId:     { type: String },
    razorpayPayoutStatus: { type: String },
    walletTransactionId: { type: String },
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
    // index removed here — defined once via schema.index() below
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
        'P2P_Send',
        'P2P_Receive',
        'Withdrawal_Debit',
        'Withdrawal_Reversal',
      ],
    },
    // index removed here — defined once via schema.index() below
    pairTxnId:         { type: String },
    counterpartyId:    { type: Schema.Types.ObjectId, ref: 'User' },
    counterpartyUpiId: { type: String },
    transferMode: {
      type: String,
      enum: ['upi_id', 'phone', 'qr'],
    },
    // index removed here — defined once via schema.index() below
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
    // index removed here — defined once via schema.index() below
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
    // index removed here — defined once via schema.index() below
    upiId: {
      type:      String,
      unique:    true,
      sparse:    true,
      trim:      true,
      lowercase: true,
    },
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
    dailyTransferTotal: { type: Number, default: 0 },
    dailyTransferDate:  { type: String },
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
    const newCount = this._newTxnCount ?? 1;
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

  if (this.withdrawalRequests.length > 500) {
    this.withdrawalRequests = this.withdrawalRequests.slice(-500);
  }

  this._newTxnCount = undefined;
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
    pairTxnId:                options.pairTxnId,
    counterpartyId:           options.counterpartyId,
    counterpartyUpiId:        options.counterpartyUpiId,
    transferMode:             options.transferMode,
    withdrawalRequestId:      options.withdrawalRequestId,
    timestamp:                new Date(),
  });

  this._newTxnCount = 1;
  const saved = await this.save();

  const lastTxn = saved.transactions[saved.transactions.length - 1];
  if (lastTxn) {
    lastTxn.withdrawableBalanceAfter = saved.withdrawableBalance;
    await saved.save();
  }
  return saved;
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
// Indexes  — single source of truth, no inline index: true for these fields
// ─────────────────────────────────────────────────────────────────────────────

 
 
walletSchema.index({ 'transactions.transactionId': 1 });
walletSchema.index({ 'transactions.timestamp': -1 });
walletSchema.index({ 'transactions.pairTxnId': 1 });
walletSchema.index({ 'transactions.withdrawalRequestId': 1 });
walletSchema.index({ 'withdrawalRequests.requestId': 1 });
walletSchema.index({ 'withdrawalRequests.status': 1 });
walletSchema.index({ 'bankAccounts.ifscCode': 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;