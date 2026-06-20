/**
 * PayoutService — Likeson.in
 *
 * Core service for all partner payouts via RazorpayX.
 *
 * RESPONSIBILITIES:
 *   1. createOrSyncContact()     — ensure partner has Razorpay contact
 *   2. createFundAccount()       — create bank/UPI fund account on Razorpay
 *   3. handleBankUpdate()        — safe rotation when partner updates bank
 *   4. dispatchPayout()          — fire single payout via RazorpayX
 *   5. handleWebhook()           — process RazorpayX webhook events
 *   6. runSettlementCycle()      — compute + dispatch batch settlement
 *   7. triggerManualSettlement() — admin triggers payout for one partner
 *
 * RAZORPAYX DOCS:
 *   https://razorpay.com/docs/razorpayx/api/
 *
 * ENV VARS REQUIRED:
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   RAZORPAYX_ACCOUNT_NUMBER  (your RazorpayX banking account number)
 *   PAYOUT_WEBHOOK_SECRET     (from RazorpayX dashboard)
 */

import mongoose from 'mongoose';
import crypto   from 'crypto';
import Razorpay from 'razorpay';

import Payout      from '../models/Payout.js';
import Settlement  from '../models/Settlement.js';
import FundAccount from '../models/FundAccount.js';

// ── Razorpay client ───────────────────────────────────────────────────────────

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Partner model registry ────────────────────────────────────────────────────

const PARTNER_MODELS = {
  doctor:            () => mongoose.model('DoctorProfile'),
  hospital:          () => mongoose.model('Hospital'),
  transportpartner:  () => mongoose.model('TransportPartner'),
  driver:            () => mongoose.model('Driver'),
  solodriverpartner: () => mongoose.model('SoloDriverPartner'),
  pharmacy:          () => mongoose.model('PharmacyStore'),
  care_assistant:    () => mongoose.model('CareAssistantProfile'),
  lab_partner:       () => mongoose.model('LabPartnerProfile'),
  customer:          () => mongoose.model('User'),
};

/**
 * Fetch the profile doc for a partner type.
 * For customers: returns User doc directly.
 */
async function getPartnerProfile(partnerType, partnerProfileId) {
  const Model = PARTNER_MODELS[partnerType]?.();
  if (!Model) throw new Error(`Unknown partnerType: ${partnerType}`);
  const doc = await Model.findById(partnerProfileId).lean();
  if (!doc) throw new Error(`${partnerType} profile not found: ${partnerProfileId}`);
  return doc;
}

/**
 * Build Razorpay contact type string from partnerType.
 * RazorpayX contact types: 'vendor', 'customer', 'employee', 'self'
 */
function toRazorpayContactType(partnerType) {
  if (partnerType === 'customer') return 'customer';
  if (['driver', 'solodriverpartner'].includes(partnerType)) return 'employee';
  return 'vendor';
}

// ══════════════════════════════════════════════════════════════════════════════
// §1  CONTACT MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * createOrSyncContact
 *
 * Ensures partner has a Razorpay contact.
 * If razorpayContactId already stored on partner doc → returns existing.
 * Otherwise creates new contact and stores ID back to partner doc.
 *
 * @param {string}   partnerType      - e.g. 'doctor'
 * @param {ObjectId} partnerProfileId - profile doc _id
 * @param {Object}   contactData      - { name, email, phone, gstin? }
 * @returns {string} razorpayContactId
 */
export async function createOrSyncContact(partnerType, partnerProfileId, contactData) {
  const Model   = PARTNER_MODELS[partnerType]?.();
  const profile = await Model.findById(partnerProfileId).select('razorpayContactId').lean();

  if (profile?.razorpayContactId) {
    return profile.razorpayContactId;
  }

  // Create new contact on Razorpay
  const contact = await razorpay.contacts.create({
    name:         contactData.name,
    email:        contactData.email,
    contact:      contactData.phone,
    type:         toRazorpayContactType(partnerType),
    reference_id: partnerProfileId.toString(),
    notes:        {
      platform:     'Likeson',
      partnerType,
      profileId:    partnerProfileId.toString(),
    },
  });

  // Store contact ID back to partner doc
  await Model.findByIdAndUpdate(partnerProfileId, {
    razorpayContactId: contact.id,
  });

  return contact.id;
}

// ══════════════════════════════════════════════════════════════════════════════
// §2  FUND ACCOUNT CREATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * createFundAccount
 *
 * Creates a fund account on RazorpayX for bank transfer or UPI.
 * Also creates a FundAccount doc in DB.
 *
 * @param {Object} params
 * @param {string}   params.partnerType
 * @param {ObjectId} params.partnerUserId
 * @param {ObjectId} params.partnerProfileId
 * @param {string}   params.razorpayContactId
 * @param {string}   params.accountType         - 'bank_account' | 'vpa'
 * @param {Object}   params.bankDetails          - { accountNumber, ifscCode, accountHolderName, ... }
 * @param {Object}   params.vpaDetails           - { address } (for UPI)
 * @param {string}   params.addedBy              - 'partner' | 'admin'
 * @param {ObjectId} params.addedByUserId
 * @returns {FundAccount} saved FundAccount doc
 */
export async function createFundAccount({
  partnerType,
  partnerUserId,
  partnerProfileId,
  razorpayContactId,
  accountType,
  bankDetails,
  vpaDetails,
  addedBy = 'partner',
  addedByUserId,
}) {
  // Build Razorpay fund account payload
  let razorpayPayload = {
    contact_id:   razorpayContactId,
    account_type: accountType,
  };

  if (accountType === 'bank_account') {
    razorpayPayload.bank_account = {
      name:           bankDetails.accountHolderName,
      ifsc:           bankDetails.ifscCode,
      account_number: bankDetails.accountNumber,
    };
  } else if (accountType === 'vpa') {
    razorpayPayload.vpa = {
      address: vpaDetails.address,
    };
  } else {
    throw new Error(`Unsupported accountType: ${accountType}`);
  }

  // Call Razorpay API
  const rzpFundAccount = await razorpay.fundAccount.create(razorpayPayload);

  // Build FundAccount doc
  const fundAccountData = {
    partnerType,
    partnerUserId,
    partnerProfileId,
    razorpayContactId,
    razorpayFundAccountId: rzpFundAccount.id,
    accountType,
    isVerified:   true,  // Razorpay created it successfully
    verifiedAt:   new Date(),
    addedBy,
    addedByUserId,
    razorpayRawResponse: rzpFundAccount,
    createdBy: addedByUserId,
  };

  if (accountType === 'bank_account') {
    fundAccountData.bank = {
      accountHolderName:  bankDetails.accountHolderName,
      accountNumber:      bankDetails.accountNumber,  // will be masked in pre-save
      ifscCode:           bankDetails.ifscCode,
      bankName:           bankDetails.bankName,
      branchName:         bankDetails.branchName,
      accountType:        bankDetails.accountType || 'savings',
    };
  } else {
    fundAccountData.vpa = {
      address: vpaDetails.address,
      name:    rzpFundAccount.vpa?.name,
    };
  }

  const fundAccount = await FundAccount.create(fundAccountData);

  // Update partner doc with new fund account ID
  const Model = PARTNER_MODELS[partnerType]?.();
  await Model.findByIdAndUpdate(partnerProfileId, {
    razorpayContactId,
    razorpayFundAccountId: rzpFundAccount.id,
  });

  return fundAccount;
}

// ══════════════════════════════════════════════════════════════════════════════
// §3  BANK UPDATE — SAFE ROTATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * handleBankUpdate
 *
 * Called when a partner updates their bank account or UPI.
 *
 * SAFETY RULES:
 *   - In-flight payouts (status=processing) → NOT affected. Finish on old account.
 *   - Old FundAccount marked inactive.
 *   - New FundAccount created on Razorpay.
 *   - Partner doc updated with new razorpayFundAccountId.
 *
 * @param {Object} params
 * @param {string}   params.partnerType
 * @param {ObjectId} params.partnerUserId
 * @param {ObjectId} params.partnerProfileId
 * @param {string}   params.accountType
 * @param {Object}   params.bankDetails      (for bank_account type)
 * @param {Object}   params.vpaDetails       (for vpa type)
 * @param {ObjectId} params.updatedByUserId
 * @returns {{ oldFundAccount, newFundAccount }}
 */
export async function handleBankUpdate({
  partnerType,
  partnerUserId,
  partnerProfileId,
  accountType,
  bankDetails,
  vpaDetails,
  updatedByUserId,
}) {
  // 1. Find current active fund account
  const oldFundAccount = await FundAccount.findOne({
    partnerType,
    partnerUserId,
    isActive: true,
  }).lean();

  // 2. Ensure contact exists (or create)
  const profile     = await getPartnerProfile(partnerType, partnerProfileId);
  const contactData = extractContactData(partnerType, profile);
  const contactId   = await createOrSyncContact(partnerType, partnerProfileId, contactData);

  // 3. Create new fund account on Razorpay + DB
  const newFundAccount = await createFundAccount({
    partnerType,
    partnerUserId,
    partnerProfileId,
    razorpayContactId: contactId,
    accountType,
    bankDetails,
    vpaDetails,
    addedBy:        'partner',
    addedByUserId:  updatedByUserId,
  });

  // 4. Deactivate old fund account (if exists)
  if (oldFundAccount) {
    await FundAccount.rotate(
      oldFundAccount._id,
      newFundAccount._id,
      'partner_bank_update',
      updatedByUserId
    );
    // Note: We do NOT call Razorpay API to "delete" old fund account
    // because RazorpayX doesn't support deletion.
    // Old account remains on Razorpay but we stop using it.
  }

  return { oldFundAccount, newFundAccount };
}

/**
 * Extract contact details from partner profile for Razorpay.
 * Each partner type stores data in slightly different shape.
 */
function extractContactData(partnerType, profile) {
  switch (partnerType) {
    case 'doctor':
      return {
        name:  profile.contactPerson?.name  || 'Doctor',
        email: profile.contactPerson?.email || '',
        phone: profile.contactPerson?.phone || '',
      };
    case 'hospital':
      return {
        name:  profile.name,
        email: profile.contact?.email || '',
        phone: profile.contact?.phone || '',
        gstin: profile.registrationDetails?.gstNumber,
      };
    case 'transportpartner':
      return {
        name:  profile.ownerName,
        email: profile.ownerEmail || '',
        phone: profile.ownerPhone,
      };
    case 'driver':
      return {
        name:  profile.legalName,
        email: profile.email || '',
        phone: profile.phone,
      };
    case 'solodriverpartner':
      return {
        name:  profile.legalName,
        email: profile.email || '',
        phone: profile.phone,
      };
    case 'pharmacy':
      return {
        name:  profile.storeName,
        email: profile.contact?.email || '',
        phone: profile.contact?.phone || '',
      };
    case 'lab_partner':
      return {
        name:  profile.labName,
        email: profile.contactPersons?.[0]?.email || '',
        phone: profile.contactPersons?.[0]?.phone || '',
      };
    case 'customer':
      return {
        name:  profile.name,
        email: profile.email,
        phone: profile.phone?.replace('+91', '') || '',
      };
    default:
      throw new Error(`extractContactData: unknown partnerType ${partnerType}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// §4  DISPATCH SINGLE PAYOUT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * dispatchPayout
 *
 * Fire a single payout via RazorpayX.
 * Creates Payout doc in DB, then calls RazorpayX.
 *
 * @param {Object} params
 * @param {string}   params.partnerType
 * @param {ObjectId} params.partnerUserId
 * @param {ObjectId} params.partnerProfileId
 * @param {string}   params.recipientName
 * @param {number}   params.amountPaise       - amount in paise (min 100)
 * @param {string}   [params.mode]            - 'IMPS'|'NEFT'|'RTGS'|'UPI'
 * @param {string}   [params.narration]       - appears on bank statement
 * @param {ObjectId} [params.settlementId]    - link to Settlement doc
 * @param {Array}    [params.earningLines]    - booking breakdown
 * @param {ObjectId} [params.initiatedBy]     - admin user
 * @param {string}   [params.purpose]         - 'payout'|'refund'
 * @returns {Payout} saved Payout doc
 */
export async function dispatchPayout({
  partnerType,
  partnerUserId,
  partnerProfileId,
  recipientName,
  amountPaise,
  mode = 'IMPS',
  narration,
  settlementId = null,
  earningLines = [],
  initiatedBy  = null,
  purpose      = 'payout',
}) {
  if (amountPaise < 100) {
    throw new Error(`Minimum payout amount is ₹1 (100 paise). Got: ${amountPaise}`);
  }

  // 1. Get active + verified fund account
  const fundAccount = await FundAccount.getActive(partnerType, partnerUserId);
  if (!fundAccount) {
    throw new Error(
      `No active verified fund account for ${partnerType}:${partnerUserId}. ` +
      `Partner must add bank/UPI details first.`
    );
  }

  // 2. Build fund account snapshot (immutable copy for this payout)
  const snapshot = buildFundAccountSnapshot(fundAccount);

  // 3. Create Payout doc (queued)
  const payout = await Payout.create({
    payoutFor:           partnerType,
    recipientUserId:     partnerUserId,
    recipientProfileId:  partnerProfileId,
    recipientName,
    amountPaise,
    currency:            'INR',
    razorpayFundAccountId: fundAccount.razorpayFundAccountId,
    razorpayContactId:     fundAccount.razorpayContactId,
    mode,
    purpose,
    narration:           narration || `Likeson payout - ${partnerType}`,
    fundAccountSnapshot: snapshot,
    status:              'queued',
    scheduledAt:         new Date(),
    settlementId,
    earningLines,
    initiatedBy,
    createdBy:           initiatedBy,
  });

  // 4. Call RazorpayX API
  let rzpPayout;
  try {
    rzpPayout = await razorpay.payouts.create({
      account_number:  process.env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: fundAccount.razorpayFundAccountId,
      amount:          amountPaise,
      currency:        'INR',
      mode:            mode === 'UPI' ? 'UPI' : mode,
      purpose,
      narration:       narration || `Likeson payout - ${partnerType}`,
      queue_if_low_balance: true,
      reference_id:    payout.payoutCode,
      notes: {
        payoutDocId:    payout._id.toString(),
        partnerType,
        settlementId:   settlementId?.toString() || '',
      },
    });

    // 5. Update Payout doc with Razorpay payout ID + status
    payout.razorpayPayoutId = rzpPayout.id;
    payout.status           = 'processing';
    payout.updatedBy        = initiatedBy;
    await payout.save();

    // 6. Update Settlement status if linked
    if (settlementId) {
      await Settlement.findByIdAndUpdate(settlementId, {
        status:       'processing',
        payoutId:     payout._id,
        processedAt:  new Date(),
        fundAccountSnapshot: snapshot,
        updatedBy:    initiatedBy,
      });
    }

  } catch (err) {
    // Razorpay API call failed — mark payout as failed
    payout.status        = 'failed';
    payout.failureDetail = {
      description: err.message,
      rawResponse: err,
    };
    payout.failedAt  = new Date();
    payout.updatedBy = initiatedBy;
    await payout.save();

    if (settlementId) {
      await Settlement.findByIdAndUpdate(settlementId, {
        status:      'failed',
        failureNote: err.message,
      });
    }

    throw err;
  }

  return payout;
}

function buildFundAccountSnapshot(fundAccount) {
  return {
    razorpayContactId:     fundAccount.razorpayContactId,
    razorpayFundAccountId: fundAccount.razorpayFundAccountId,
    accountType:           fundAccount.accountType,
    accountHolderName:     fundAccount.bank?.accountHolderName || fundAccount.vpa?.name,
    accountNumber:         fundAccount.bank?.accountNumberLast4
      ? `••••${fundAccount.bank.accountNumberLast4}` : undefined,
    ifscCode:  fundAccount.bank?.ifscCode,
    bankName:  fundAccount.bank?.bankName,
    upiId:     fundAccount.vpa?.address,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// §5  WEBHOOK HANDLER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * handleWebhook
 *
 * Process incoming RazorpayX webhook events.
 * Mount at POST /api/webhooks/razorpayx
 *
 * Events handled:
 *   payout.processed  → mark Payout processed, decrement partner pendingPayout
 *   payout.failed     → mark Payout failed, schedule retry
 *   payout.reversed   → mark Payout reversed
 *   payout.queued     → informational, log only
 *
 * @param {string} rawBody    - raw request body string (for signature verification)
 * @param {string} signature  - X-Razorpay-Signature header
 * @param {Object} payload    - parsed JSON body
 */
export async function handleWebhook(rawBody, signature, payload) {
  // 1. Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.PAYOUT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    throw new Error('Webhook signature verification failed');
  }

  const event      = payload.event;
  const rzpPayout  = payload.payload?.payout?.entity;

  if (!rzpPayout) return { received: true, action: 'skipped_no_entity' };

  // 2. Find our Payout doc
  const payout = await Payout.findOne({ razorpayPayoutId: rzpPayout.id });
  if (!payout) {
    // Could be a payout created outside platform — log and ignore
    console.warn(`[Webhook] Payout not found in DB: ${rzpPayout.id}`);
    return { received: true, action: 'payout_not_found' };
  }

  payout.webhookRaw = payload;
  payout.updatedBy  = null;

  switch (event) {

    case 'payout.processed': {
      if (payout.status === 'processed') break;  // idempotent

      payout.status      = 'processed';
      payout.processedAt = new Date(rzpPayout.processed_at * 1000);
      await payout.save();

      // Decrement partner's pendingPayoutPaise, increment totalPaidPaise
      await creditPartnerEarnings(
        payout.payoutFor,
        payout.recipientProfileId,
        payout.amountPaise
      );

      // Mark Settlement paid
      if (payout.settlementId) {
        await Settlement.findByIdAndUpdate(payout.settlementId, {
          status:      'paid',
          completedAt: new Date(),
        });
      }
      break;
    }

    case 'payout.failed': {
      if (payout.status === 'failed') break;

      payout.status = 'failed';
      payout.failedAt = new Date();
      payout.failureDetail = {
        code:        rzpPayout.error?.code,
        description: rzpPayout.error?.description,
        source:      rzpPayout.error?.source,
        step:        rzpPayout.error?.step,
        reason:      rzpPayout.error?.reason,
      };

      // Schedule retry if under limit
      if (payout.retryCount < 3) {
        const retryDelayMs = [5, 30, 120][payout.retryCount] * 60 * 1000; // 5min, 30min, 2hr
        payout.retryAfter  = new Date(Date.now() + retryDelayMs);
        payout.retryCount += 1;
      }

      await payout.save();

      if (payout.settlementId) {
        await Settlement.findByIdAndUpdate(payout.settlementId, {
          status:      'failed',
          failureNote: rzpPayout.error?.description,
        });
      }
      break;
    }

    case 'payout.reversed': {
      payout.status     = 'reversed';
      payout.reversedAt = new Date();
      await payout.save();

      // Re-credit partner's pendingPayoutPaise (reversal = not paid)
      await reinstatePartnerEarnings(
        payout.payoutFor,
        payout.recipientProfileId,
        payout.amountPaise
      );

      if (payout.settlementId) {
        await Settlement.findByIdAndUpdate(payout.settlementId, {
          status: 'failed',
          failureNote: 'Payout reversed by bank',
        });
      }
      break;
    }

    case 'payout.queued':
    case 'payout.pending':
      // Informational — RazorpayX queued due to low balance etc.
      await payout.save();
      break;

    default:
      console.info(`[Webhook] Unhandled event: ${event}`);
  }

  return { received: true, action: event };
}

/**
 * Decrement partner's pendingPayoutPaise and increment totalPaidPaise.
 * Called after payout.processed webhook.
 */
async function creditPartnerEarnings(partnerType, partnerProfileId, amountPaise) {
  const Model = PARTNER_MODELS[partnerType]?.();
  if (!Model || !partnerProfileId) return;

  await Model.findByIdAndUpdate(partnerProfileId, {
    $inc: {
      'earnings.pendingPayoutPaise': -amountPaise,
      'earnings.totalPaidPaise':      amountPaise,
    },
    $set: { 'earnings.lastPayoutAt': new Date() },
  });
}

/**
 * Re-add amountPaise back to pendingPayoutPaise on reversal.
 */
async function reinstatePartnerEarnings(partnerType, partnerProfileId, amountPaise) {
  const Model = PARTNER_MODELS[partnerType]?.();
  if (!Model || !partnerProfileId) return;

  await Model.findByIdAndUpdate(partnerProfileId, {
    $inc: {
      'earnings.pendingPayoutPaise': amountPaise,
      'earnings.totalPaidPaise':    -amountPaise,
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// §6  SETTLEMENT CYCLE — SCHEDULED / BATCH
// ══════════════════════════════════════════════════════════════════════════════

/**
 * runSettlementCycle
 *
 * Called by cron job at cycle boundaries (daily/weekly/monthly).
 * Finds all partners whose settlementCycle matches the current period,
 * computes earnings, creates Settlement docs, dispatches payouts.
 *
 * @param {string} cycle - 'Daily'|'Weekly'|'Bi-Weekly'|'Monthly'
 * @param {ObjectId} adminUserId
 */
export async function runSettlementCycle(cycle, adminUserId) {
  const periodEnd   = new Date();
  const periodStart = getPeriodStart(cycle, periodEnd);

  const results = { created: 0, skipped: 0, failed: 0, errors: [] };

  // Gather all partner types that store earnings.pendingPayoutPaise
  const partnerConfigs = [
    { type: 'doctor',           ModelName: 'DoctorProfile',      cycleField: 'settlementCycle' },
    { type: 'hospital',         ModelName: 'Hospital',           cycleField: 'settlementCycle' },
    { type: 'transportpartner', ModelName: 'TransportPartner',   cycleField: 'settlementCycle' },
    { type: 'driver',           ModelName: 'Driver',             cycleField: null },              // drivers settled via agency
    { type: 'solodriverpartner',ModelName: 'SoloDriverPartner',  cycleField: 'settlementCycle' },
    { type: 'pharmacy',         ModelName: 'PharmacyStore',      cycleField: 'bankDetails.settlementCycle' },
    { type: 'lab_partner',      ModelName: 'LabPartnerProfile',  cycleField: 'payoutFrequency' },
  ];

  for (const config of partnerConfigs) {
    if (!config.cycleField) continue;  // drivers handled via agency

    let Model;
    try {
      Model = mongoose.model(config.ModelName);
    } catch {
      continue;
    }

    // Find all partners of this type with matching cycle and pending balance
    const cycleValue = normalizeCycleValue(config.type, cycle);
    const query = {
      'earnings.pendingPayoutPaise': { $gt: 0 },
    };
    if (cycleValue) {
      // Use dot notation for nested field
      query[config.cycleField] = cycleValue;
    }

    let partners;
    try {
      partners = await Model.find(query)
        .select('_id user earnings razorpayContactId razorpayFundAccountId')
        .lean();
    } catch (err) {
      results.errors.push({ type: config.type, error: err.message });
      continue;
    }

    for (const partner of partners) {
      try {
        await triggerManualSettlement({
          partnerType:       config.type,
          partnerUserId:     partner.user,
          partnerProfileId:  partner._id,
          periodStart,
          periodEnd,
          cycle,
          trigger:           'scheduled',
          adminUserId,
        });
        results.created++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          type:      config.type,
          profileId: partner._id,
          error:     err.message,
        });
      }
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// §7  MANUAL / SINGLE PARTNER SETTLEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * triggerManualSettlement
 *
 * Compute and dispatch settlement for ONE partner.
 * Called by admin dashboard or by runSettlementCycle() per partner.
 *
 * @param {Object} params
 * @param {string}   params.partnerType
 * @param {ObjectId} params.partnerUserId
 * @param {ObjectId} params.partnerProfileId
 * @param {Date}     params.periodStart
 * @param {Date}     params.periodEnd
 * @param {string}   params.cycle
 * @param {string}   params.trigger       - 'scheduled'|'manual'
 * @param {ObjectId} params.adminUserId
 * @returns {Settlement}
 */
export async function triggerManualSettlement({
  partnerType,
  partnerUserId,
  partnerProfileId,
  periodStart,
  periodEnd,
  cycle    = 'Manual',
  trigger  = 'manual',
  adminUserId,
}) {
  // 1. Fetch partner profile to get pending amount + name
  const profile = await getPartnerProfile(partnerType, partnerProfileId);
  const pendingPaise = profile.earnings?.pendingPayoutPaise ?? 0;

  if (pendingPaise < 100) {
    throw new Error(
      `Partner has insufficient balance: ${pendingPaise} paise (min 100). Skipping.`
    );
  }

  // 2. Check no duplicate settlement for same period
  const existing = await Settlement.findOne({
    partnerUserId,
    periodStart:  { $lte: periodEnd },
    periodEnd:    { $gte: periodStart },
    status:       { $in: ['pending', 'processing', 'paid'] },
  });
  if (existing) {
    throw new Error(
      `Settlement already exists for this period: ${existing.settlementCode}`
    );
  }

  // 3. Fetch completed bookings in period for earningLines
  // (Bookings where this partner is involved and status = completed)
  const earningLines = await buildEarningLines(partnerType, partnerProfileId, periodStart, periodEnd);

  // 4. Compute amounts
  const totalGross    = earningLines.reduce((s, l) => s + (l.grossAmountPaise || 0), 0);
  const totalPlatform = earningLines.reduce((s, l) => s + (l.platformFeePaise || 0), 0);
  const totalNet      = earningLines.reduce((s, l) => s + (l.netAmountPaise   || 0), 0);

  // Use pendingPaise from partner doc as source of truth (more reliable than recomputing)
  // earningLines are for the itemised pay-slip only
  const payableAmount = pendingPaise;

  // 5. Get partner name for records
  const partnerName = extractPartnerName(partnerType, profile);

  // 6. Create Settlement doc
  const settlement = await Settlement.create({
    partnerType,
    partnerUserId,
    partnerProfileId,
    partnerName,
    periodStart,
    periodEnd,
    cycle,
    trigger,
    totalGrossAmountPaise:   totalGross    || payableAmount,
    totalPlatformFeePaise:   totalPlatform || 0,
    totalNetAmountPaise:     totalNet      || payableAmount,
    finalPayableAmountPaise: payableAmount,
    totalBookings:           earningLines.length,
    settledBookings:         earningLines,
    status:                  'pending',
    scheduledAt:             new Date(),
    initiatedBy:             adminUserId,
    createdBy:               adminUserId,
  });

  // 7. Dispatch payout
  await dispatchPayout({
    partnerType,
    partnerUserId,
    partnerProfileId,
    recipientName:  partnerName,
    amountPaise:    payableAmount,
    mode:           pickPayoutMode(partnerType, profile),
    narration:      `Likeson ${partnerType} settlement ${settlement.settlementCode}`,
    settlementId:   settlement._id,
    earningLines,
    initiatedBy:    adminUserId,
    purpose:        'payout',
  });

  return settlement;
}

// ══════════════════════════════════════════════════════════════════════════════
// §8  REFUND TO CUSTOMER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * dispatchCustomerRefund
 *
 * Send refund to customer's bank/UPI.
 * For cancelled bookings or returned pharmacy orders.
 *
 * @param {Object} params
 * @param {ObjectId} params.customerUserId
 * @param {number}   params.amountPaise
 * @param {string}   params.narration
 * @param {ObjectId} [params.bookingId]
 * @param {ObjectId} [params.adminUserId]
 * @returns {Payout}
 */
export async function dispatchCustomerRefund({
  customerUserId,
  amountPaise,
  narration,
  bookingId,
  adminUserId,
}) {
  const User = mongoose.model('User');
  const user = await User.findById(customerUserId).select('name email phone').lean();
  if (!user) throw new Error(`Customer not found: ${customerUserId}`);

  // Customers use their own userId as profileId
  return dispatchPayout({
    partnerType:        'customer',
    partnerUserId:      customerUserId,
    partnerProfileId:   customerUserId,
    recipientName:      user.name,
    amountPaise,
    mode:               'IMPS',
    narration:          narration || 'Likeson refund',
    earningLines:       bookingId ? [{ bookingId, netAmountPaise: amountPaise }] : [],
    initiatedBy:        adminUserId,
    purpose:            'refund',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// §9  RETRY FAILED PAYOUTS — CRON
// ══════════════════════════════════════════════════════════════════════════════

/**
 * retryFailedPayouts
 *
 * Called by cron every 15 minutes.
 * Finds failed payouts that are eligible for retry and re-dispatches.
 */
export async function retryFailedPayouts(adminUserId) {
  const now = new Date();

  const payoutsToRetry = await Payout.find({
    status:      'failed',
    retryCount:  { $lt: 3 },
    retryAfter:  { $lte: now },
  }).lean();

  const results = { retried: 0, errors: [] };

  for (const p of payoutsToRetry) {
    try {
      // Get fresh fund account (partner may have updated bank since failure)
      const fundAccount = await FundAccount.getActive(p.payoutFor, p.recipientUserId);
      if (!fundAccount) {
        results.errors.push({ payoutId: p._id, error: 'No active fund account' });
        continue;
      }

      // Build new payout (retry)
      const newPayout = await dispatchPayout({
        partnerType:       p.payoutFor,
        partnerUserId:     p.recipientUserId,
        partnerProfileId:  p.recipientProfileId,
        recipientName:     p.recipientName,
        amountPaise:       p.amountPaise,
        mode:              p.mode,
        narration:         p.narration,
        settlementId:      p.settlementId,
        earningLines:      p.earningLines,
        initiatedBy:       adminUserId,
        purpose:           p.purpose,
      });

      // Mark original payout as cancelled (superseded by retry)
      await Payout.findByIdAndUpdate(p._id, {
        status:          'cancelled',
        notes:           `Retried. New payout: ${newPayout.payoutCode}`,
        parentPayoutId:  p._id,
      });

      results.retried++;
    } catch (err) {
      results.errors.push({ payoutId: p._id, error: err.message });
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS (private)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build earning lines from Booking collection for a partner over a period.
 * Adapts query based on which field links bookings to this partner type.
 */
async function buildEarningLines(partnerType, partnerProfileId, periodStart, periodEnd) {
  const Booking = mongoose.model('Booking');

  // Map partnerType → which field in Booking links to this partner's profile
  const fieldMap = {
    doctor:            'doctor',
    hospital:          'hospital',
    transportpartner:  'transportPartner',
    driver:            'driver',
    solodriverpartner: 'solodriverpartner',
    pharmacy:          null,  // handled via PharmacyOrder
    care_assistant:    'careAssistant',
    lab_partner:       'labPartner',
  };

  const bookingField = fieldMap[partnerType];
  if (!bookingField) return [];

  const bookings = await Booking.find({
    [bookingField]: partnerProfileId,
    status:         'completed',
    completedAt:    { $gte: periodStart, $lte: periodEnd },
  })
    .select('_id bookingCode bookingType completedAt fareBreakdown')
    .lean();

  return bookings.map((b) => {
    const gross    = (b.fareBreakdown?.totalAmount ?? 0) * 100;   // rupees → paise
    const platform = (b.fareBreakdown?.platformFee ?? 0) * 100;
    const net      = gross - platform;
    return {
      bookingId:        b._id,
      bookingCode:      b.bookingCode,
      bookingType:      b.bookingType,
      serviceDate:      b.completedAt,
      grossAmountPaise: gross,
      platformFeePaise: platform,
      netAmountPaise:   Math.max(0, net),
    };
  });
}

function extractPartnerName(partnerType, profile) {
  switch (partnerType) {
    case 'doctor':            return profile.contactPerson?.name   || 'Doctor';
    case 'hospital':          return profile.name;
    case 'transportpartner':  return profile.businessName;
    case 'driver':            return profile.legalName;
    case 'solodriverpartner': return profile.legalName;
    case 'pharmacy':          return profile.storeName;
    case 'lab_partner':       return profile.labName;
    case 'customer':          return profile.name;
    default:                  return 'Partner';
  }
}

/** Pick best payout mode based on partner type and their preferred method */
function pickPayoutMode(partnerType, profile) {
  // If partner has UPI set, prefer UPI for speed (instant)
  if (['driver', 'solodriverpartner'].includes(partnerType)) {
    return profile.bankDetails?.upiId ? 'UPI' : 'IMPS';
  }
  const preferred = profile.bankDetails?.preferredSettlementMethod
    || profile.settlement?.preferredMethod;
  if (preferred === 'UPI') return 'UPI';
  return 'IMPS';  // default: instant bank transfer
}

function getPeriodStart(cycle, endDate) {
  const d = new Date(endDate);
  switch (cycle) {
    case 'Daily':     d.setDate(d.getDate() - 1);  break;
    case 'Weekly':    d.setDate(d.getDate() - 7);  break;
    case 'Bi-Weekly': d.setDate(d.getDate() - 14); break;
    case 'Monthly':   d.setMonth(d.getMonth() - 1); break;
    default:          d.setDate(d.getDate() - 7);
  }
  return d;
}

/**
 * Normalize cycle value to match what's stored in each partner model.
 * e.g. 'Weekly' in TransportPartner but 'weekly' in DoctorProfile.
 */
function normalizeCycleValue(partnerType, cycle) {
  // Most models store lowercase, some store title-case
  const titleCase = ['transportpartner', 'solodriverpartner', 'pharmacy', 'lab_partner'];
  return titleCase.includes(partnerType) ? cycle : cycle.toLowerCase();
}