/**
 * walletSyncService.js
 *
 * Syncs kycVerified, bankVerified, and bankDetails from role-profile
 * models into PartnerWallet when profile KYC or bank status changes.
 *
 * Call these from profile update routes / admin KYC approval flows.
 *
 * Usage:
 *   import { syncWalletKyc, syncWalletBank } from './walletSyncService.js';
 *
 *   // After DoctorProfile KYC approved:
 *   await syncWalletKyc(userId, 'doctor');
 *
 *   // After Driver bank verified:
 *   await syncWalletBank(userId, 'driver');
 *
 *   // Both at once (e.g. full onboarding complete):
 *   await syncWalletFull(userId, 'care_assistant');
 */

import PartnerWallet from '../models/PartnerWallet.js';
import DoctorProfile        from '../models/DoctorProfile.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import TransportPartner     from '../models/TransportPartner.js';
import LabPartnerProfile    from '../models/LabPartnerProfile.js';

// ── KYC verified check per role ───────────────────────────────────────────────

/**
 * Returns { kycVerified: boolean } by reading role profile.
 * Field mapping per role:
 *   doctor          → kycStatus === 'verified'
 *   care_assistant  → kyc.verificationStatus === 'Verified'
 *   driver          → kyc.verificationStatus === 'Verified'
 *   solodriverpartner → kyc.verificationStatus === 'verified'
 *   transportpartner  → ownerKyc.kycStatus === 'verified'
 *   lab_partner     → isVerified === true
 */
async function resolveProfileKycVerified(userId, partnerRole) {
  switch (partnerRole) {
    case 'doctor': {
      const p = await DoctorProfile.findOne({ user: userId })
        .select('kycStatus').lean();
      return p?.kycStatus === 'verified';
    }
    case 'care_assistant': {
      const p = await CareAssistantProfile.findOne({ user: userId })
        .select('kyc.verificationStatus').lean();
      return p?.kyc?.verificationStatus === 'Verified';
    }
    case 'driver': {
      const p = await Driver.findOne({ user: userId })
        .select('kyc.verificationStatus').lean();
      return p?.kyc?.verificationStatus === 'Verified';
    }
    case 'solodriverpartner': {
      const p = await SoloDriverPartner.findOne({ user: userId })
        .select('kyc.verificationStatus').lean();
      return p?.kyc?.verificationStatus === 'verified';
    }
    case 'transportpartner': {
      const p = await TransportPartner.findOne({ user: userId })
        .select('ownerKyc.kycStatus').lean();
      return p?.ownerKyc?.kycStatus === 'verified';
    }
    case 'lab_partner': {
      const p = await LabPartnerProfile.findOne({ user: userId })
        .select('isVerified').lean();
      return p?.isVerified === true;
    }
    default:
      return false;
  }
}

// ── Bank verified check + bank detail extraction per role ─────────────────────

/**
 * Returns { bankVerified, bankDetail } from role profile.
 * bankDetail shape: { accountHolderName, accountNumberLast4, ifscCode, bankName, upiId }
 *
 * Field mapping per role:
 *   doctor          → bankDetails.isBankVerified + bankDetails fields
 *   care_assistant  → bankDetails.isBankVerified
 *   driver          → bankDetails.isBankVerified
 *   solodriverpartner → bankDetails.isVerified
 *   transportpartner  → bankDetails.bankAccounts[isPrimary=true].isVerified
 *   lab_partner     → bankDetails.isVerified
 */
async function resolveProfileBankInfo(userId, partnerRole) {
  switch (partnerRole) {
    case 'doctor': {
      const p = await DoctorProfile.findOne({ user: userId })
        .select('bankDetails').lean();
      const b = p?.bankDetails;
      if (!b) return { bankVerified: false, bankDetail: null };
      return {
        bankVerified: b.isBankVerified === true,
        bankDetail: b.accountHolderName ? {
          accountHolderName:  b.accountHolderName,
          accountNumberLast4: b.accountLast4 ?? null,
          ifscCode:           b.ifscCode,
          bankName:           b.bankName,
          branchName:         b.branchName,
          upiId:              b.upiId ?? null,
          isVerified:         b.isBankVerified === true,
          source:             'profile_sync',
        } : null,
      };
    }

    case 'care_assistant': {
      const p = await CareAssistantProfile.findOne({ user: userId })
        .select('bankDetails').lean();
      const b = p?.bankDetails;
      if (!b) return { bankVerified: false, bankDetail: null };
      return {
        bankVerified: b.isBankVerified === true,
        bankDetail: b.accountHolderName ? {
          accountHolderName:  b.accountHolderName,
          accountNumberLast4: b.accountLast4 ?? null,
          ifscCode:           b.ifscCode,
          bankName:           b.bankName,
          upiId:              b.upiId ?? null,
          isVerified:         b.isBankVerified === true,
          source:             'profile_sync',
        } : null,
      };
    }

    case 'driver': {
      const p = await Driver.findOne({ user: userId })
        .select('bankDetails').lean();
      const b = p?.bankDetails;
      if (!b) return { bankVerified: false, bankDetail: null };
      return {
        bankVerified: b.isBankVerified === true,
        bankDetail: b.accountHolderName ? {
          accountHolderName:  b.accountHolderName,
          accountNumberLast4: b.accountLast4 ?? null,
          ifscCode:           b.ifscCode,
          bankName:           b.bankName,
          upiId:              b.upiId ?? null,
          isVerified:         b.isBankVerified === true,
          source:             'profile_sync',
        } : null,
      };
    }

    case 'solodriverpartner': {
      const p = await SoloDriverPartner.findOne({ user: userId })
        .select('bankDetails').lean();
      const b = p?.bankDetails;
      if (!b) return { bankVerified: false, bankDetail: null };
      return {
        bankVerified: b.isVerified === true,
        bankDetail: b.accountHolderName ? {
          accountHolderName:  b.accountHolderName,
          accountNumberLast4: b.accountNumber?.slice(-4) ?? null,
          ifscCode:           b.ifscCode,
          bankName:           b.bankName,
          upiId:              b.upiId ?? null,
          isVerified:         b.isVerified === true,
          source:             'profile_sync',
        } : null,
      };
    }

    case 'transportpartner': {
      const p = await TransportPartner.findOne({ user: userId })
        .select('bankDetails.bankAccounts').lean();
      const primary = p?.bankDetails?.bankAccounts?.find(a => a.isPrimary);
      if (!primary) return { bankVerified: false, bankDetail: null };
      return {
        bankVerified: primary.isVerified === true,
        bankDetail: primary.accountHolderName ? {
          accountHolderName:  primary.accountHolderName,
          accountNumberLast4: primary.accountLast4 ?? null,
          ifscCode:           primary.ifscCode,
          bankName:           primary.bankName,
          branchName:         primary.branchName,
          upiId:              null,
          isVerified:         primary.isVerified === true,
          source:             'profile_sync',
        } : null,
      };
    }

    case 'lab_partner': {
      const p = await LabPartnerProfile.findOne({ user: userId })
        .select('bankDetails').lean();
      const b = p?.bankDetails;
      if (!b) return { bankVerified: false, bankDetail: null };
      return {
        bankVerified: b.isVerified === true,
        bankDetail: b.accountHolderName ? {
          accountHolderName:  b.accountHolderName,
          accountNumberLast4: b.accountNumber?.slice(-4) ?? null,
          ifscCode:           b.ifscCode,
          bankName:           b.bankName,
          upiId:              b.upiId ?? null,
          isVerified:         b.isVerified === true,
          source:             'profile_sync',
        } : null,
      };
    }

    default:
      return { bankVerified: false, bankDetail: null };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * syncWalletKyc
 * Call after profile KYC status changes.
 * Updates kycVerified on PartnerWallet.
 *
 * @param {ObjectId|string} userId     — User._id (not profile _id)
 * @param {string}          partnerRole
 */
export async function syncWalletKyc(userId, partnerRole) {
  const kycVerified = await resolveProfileKycVerified(userId, partnerRole);

  const wallet = await PartnerWallet.findOneAndUpdate(
    { partner: userId },
    { $set: { kycVerified } },
    { new: true }
  );

  return wallet ? { kycVerified } : null;
}

/**
 * syncWalletBank
 * Call after profile bank details verified.
 * Updates bankVerified + upserts bank detail into wallet.bankDetails.
 *
 * Logic:
 *   - If profile-synced bank already exists (source='profile_sync'), update it.
 *   - If not, add it as primary (if no primary exists) or non-primary.
 *   - Never overwrites manually-added bank accounts.
 *
 * @param {ObjectId|string} userId
 * @param {string}          partnerRole
 */
export async function syncWalletBank(userId, partnerRole) {
  const { bankVerified, bankDetail } = await resolveProfileBankInfo(userId, partnerRole);

  const wallet = await PartnerWallet.findOne({ partner: userId });
  if (!wallet) return null;

  // Update bankVerified
  wallet.bankVerified = bankVerified;

  if (bankDetail && bankDetail.accountNumberLast4 && bankDetail.ifscCode) {
    // Find existing profile-synced bank entry
    const existingIdx = wallet.bankDetails.findIndex(
      b => b.source === 'profile_sync'
    );

    if (existingIdx >= 0) {
      // Update existing entry
      const existing = wallet.bankDetails[existingIdx];
      Object.assign(existing, bankDetail);
      existing.updatedAt = new Date();
    } else {
      // Add new: make primary if no primary yet
      const hasPrimary = wallet.bankDetails.some(b => b.isPrimary);
      wallet.bankDetails.push({
        ...bankDetail,
        isPrimary: !hasPrimary,
      });
    }
  }

  await wallet.save();
  return { bankVerified };
}

/**
 * syncWalletFull
 * Sync both KYC and bank in one call.
 * Use after full onboarding approval.
 *
 * @param {ObjectId|string} userId
 * @param {string}          partnerRole
 */
export async function syncWalletFull(userId, partnerRole) {
  const [kycVerified, { bankVerified, bankDetail }] = await Promise.all([
    resolveProfileKycVerified(userId, partnerRole),
    resolveProfileBankInfo(userId, partnerRole),
  ]);

  const wallet = await PartnerWallet.findOne({ partner: userId });
  if (!wallet) return null;

  wallet.kycVerified  = kycVerified;
  wallet.bankVerified = bankVerified;

  if (bankDetail && bankDetail.accountNumberLast4 && bankDetail.ifscCode) {
    const existingIdx = wallet.bankDetails.findIndex(b => b.source === 'profile_sync');
    if (existingIdx >= 0) {
      Object.assign(wallet.bankDetails[existingIdx], bankDetail);
      wallet.bankDetails[existingIdx].updatedAt = new Date();
    } else {
      const hasPrimary = wallet.bankDetails.some(b => b.isPrimary);
      wallet.bankDetails.push({
        ...bankDetail,
        isPrimary: !hasPrimary,
      });
    }
  }

  await wallet.save();
  return { kycVerified, bankVerified };
}