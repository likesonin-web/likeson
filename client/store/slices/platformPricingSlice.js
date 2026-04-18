import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const extractError = (error) => {
  if (error?.response?.data?.errors)
    return error.response.data.errors.map((e) => e.msg).join(', ');
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message === 'Network Error')
    return 'Network error. Please check your connection.';
  return 'Something went wrong. Please try again.';
};

const makeThunk = (typePrefix, apiFn, opts = {}) =>
  createAsyncThunk(typePrefix, async (arg, thunkAPI) => {
    try {
      const result = await apiFn(arg, thunkAPI);
      if (opts.successMsg) toast.success(opts.successMsg);
      return result;
    } catch (error) {
      const message = extractError(error);
      if (!opts.silentError) toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
//  § 1  READ
// ─────────────────────────────────────────────────────────────────────────────

/** GET /pricing/config  — admin/superadmin full config (no versionHistory) */
export const fetchAdminPricingConfig = makeThunk(
  'platformPricing/fetchAdminConfig',
  async () => {
    const { data } = await API.get('/pricing/config');
    return data; // { success, data: PlatformPricingConfig }
  },
  { silentError: true }
);

/** GET /pricing/public  — caps, customPlanOptions, tax, refundPolicy only */
export const fetchPublicPricingConfig = makeThunk(
  'platformPricing/fetchPublicConfig',
  async () => {
    const { data } = await API.get('/pricing/public');
    return data; // { success, data: { caps, customPlanOptions, tax, refundPolicy } }
  },
  { silentError: true }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 2  FULL CONFIG UPDATE  (superadmin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /pricing/config
 * payload can include any top-level section. platformFee objects must be
 * { type: 'fixed'|'percentage', value: number }.
 */
export const updateFullPricingConfig = makeThunk(
  'platformPricing/updateFullConfig',
  async (payload) => {
    const { data } = await API.patch('/pricing/config', payload);
    return data;
  },
  { successMsg: 'Platform pricing updated and audit snapshot saved.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 3  SECTION-LEVEL PATCH THUNKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /pricing/caps  (superadmin only)
 * payload: { note?, pharmacyDiscountMax?, diagnosticsDiscountMax?,
 *            careAssistantMaxVisitsPerMonth?, consultationsMaxPerMonth?,
 *            transportMaxRidesPerMonth? }
 *
 * BUG FIX: successMsg corrected (was 'Discount caps updated.' — kept consistent).
 */
export const updateCaps = makeThunk(
  'platformPricing/updateCaps',
  async (payload) => {
    const { data } = await API.patch('/pricing/caps', payload);
    return data; // { success, message, data: caps }
  },
  { successMsg: 'Discount caps updated.' }
);

/**
 * PATCH /pricing/transport
 * payload: { note?,
 *            baseFare?, defaultRatePerKm?,
 *            nightSurchargeMultiplier?, nightStartHour?, nightEndHour?,
 *            waitingFreeMinutes?, waitingChargePerMinute?,
 *            cancellationFeePercent?,
 *            platformFee?: { type, value },
 *            planRateOverrides?: { [planSlug]: number | null } }
 */
export const updateTransport = makeThunk(
  'platformPricing/updateTransport',
  async (payload) => {
    const { data } = await API.patch('/pricing/transport', payload);
    return data; // { success, message, data: transport (planRateOverrides as plain obj) }
  },
  { successMsg: 'Transport pricing updated.' }
);

/**
 * PATCH /pricing/care-assistant  (superadmin only)
 *
 * BUG FIX: Removed non-existent fields payoutPerVisit and chargeToUser.
 *          The schema has no top-level payoutPerVisit / chargeToUser on
 *          careAssistantPricingSchema — those live inside pricingTiers.
 *          The correct top-level scalars are:
 *            dedicatedMonthlyPayout, dedicatedMonthlyCharge,
 *            punctualityBonusPerVisit, noShowPenalty, overtimeRatePerHour.
 *
 * payload: { note?,
 *            dedicatedMonthlyPayout?, dedicatedMonthlyCharge?,
 *            punctualityBonusPerVisit?, noShowPenalty?, overtimeRatePerHour?,
 *            platformFee?: { type, value } }
 */
export const updateCareAssistant = makeThunk(
  'platformPricing/updateCareAssistant',
  async (payload) => {
    const { data } = await API.patch('/pricing/care-assistant', payload);
    return data;
  },
  { successMsg: 'Care-assistant pricing updated.' }
);

/**
 * PATCH /pricing/care-assistant/tiers  (superadmin only)
 * Replace the full pricing-tier array.
 *
 * payload: { note?, pricingTiers: [{ label, minHours, maxHours, chargeToUser, payoutToAssistant, isActive? }] }
 */
export const updateCareAssistantTiers = makeThunk(
  'platformPricing/updateCareAssistantTiers',
  async (payload) => {
    const { data } = await API.patch('/pricing/care-assistant/tiers', payload);
    return data;
  },
  { successMsg: 'Care-assistant pricing tiers updated.' }
);

/**
 * PATCH /pricing/doctor
 * payload: { note?,
 *            honorariumPerConsultation?, chargeToUser?,
 *            teleConsultationChargeToUser?, teleConsultationHonorarium?,
 *            homeVisitChargeToUser?, homeVisitHonorarium?,
 *            followUpDiscountPercent?, followUpValidDays?,
 *            platformFee?: { type, value } }
 */
export const updateDoctor = makeThunk(
  'platformPricing/updateDoctor',
  async (payload) => {
    const { data } = await API.patch('/pricing/doctor', payload);
    return data;
  },
  { successMsg: 'Doctor pricing updated.' }
);

/**
 * PATCH /pricing/hospital  (superadmin only)
 * payload: { note?,
 *            settlementCycle?,
 *            platformFee?: { type, value },
 *            hospitalOverrides?: { [hospitalId]: { type, value } } }
 */
export const updateHospital = makeThunk(
  'platformPricing/updateHospital',
  async (payload) => {
    const { data } = await API.patch('/pricing/hospital', payload);
    return data; // { success, message, data: hospital (hospitalOverrides as plain obj) }
  },
  { successMsg: 'Hospital commission updated.' }
);

/**
 * DELETE /pricing/hospital/override/:hospitalId  (superadmin only)
 */
export const deleteHospitalOverride = makeThunk(
  'platformPricing/deleteHospitalOverride',
  async (hospitalId) => {
    const { data } = await API.delete(`/pricing/hospital/override/${hospitalId}`);
    return { ...data, hospitalId };
  },
  { successMsg: 'Hospital platform fee override removed.' }
);

/**
 * PATCH /pricing/diagnostics
 * payload: { note?,
 *            homeSampleCollectionCharge?, physicalReportFee?, settlementCycle?,
 *            platformFee?: { type, value },
 *            homeSamplePlatformFee?: { type, value } }
 */
export const updateDiagnostics = makeThunk(
  'platformPricing/updateDiagnostics',
  async (payload) => {
    const { data } = await API.patch('/pricing/diagnostics', payload);
    return data;
  },
  { successMsg: 'Diagnostics pricing updated.' }
);

/**
 * PATCH /pricing/pharmacy
 * payload: { note?,
 *            ownStoreMarginPercent?, expressDeliveryCharge?,
 *            deliveryAgentPayout?, freeDeliveryMinOrderValue?, settlementCycle?,
 *            platformFee?: { type, value } }
 */
export const updatePharmacy = makeThunk(
  'platformPricing/updatePharmacy',
  async (payload) => {
    const { data } = await API.patch('/pricing/pharmacy', payload);
    return data;
  },
  { successMsg: 'Pharmacy pricing updated.' }
);

/**
 * PATCH /pricing/custom-plan-options  (superadmin only)
 * payload: { note?,
 *   consultation?: { pricePerConsultation?, maxDoctorsAllowed?,
 *                    doctorPricingTiers?: [{ doctorCount, additionalPrice }] },
 *   transport?: { kmSlabs?: [{ km, price }] },
 *   diagnosticsDiscount?: { slabs?: [{ percent, price }] },
 *   pharmacyDiscount?:   { slabs?: [{ percent, price }] },
 *   careAssistant?: { pricingTiers?: [...] },
 *   addOns?: { homeSampleCollection?, prioritySupport? }
 * }
 */
export const updateCustomPlanOptions = makeThunk(
  'platformPricing/updateCustomPlanOptions',
  async (payload) => {
    const { data } = await API.patch('/pricing/custom-plan-options', payload);
    return data;
  },
  { successMsg: 'Custom plan option prices updated. Existing plans are unaffected.' }
);

/**
 * PATCH /pricing/ads  (superadmin only)
 * payload: { note?, sponsoredListingMonthly?, homePageBannerMonthly? }
 */
export const updateAds = makeThunk(
  'platformPricing/updateAds',
  async (payload) => {
    const { data } = await API.patch('/pricing/ads', payload);
    return data;
  },
  { successMsg: 'Ad pricing updated.' }
);

/**
 * PATCH /pricing/tax  (superadmin only)
 * payload: { note?, defaultGstPercent?, pharmacyGstPercent?,
 *            transportGstPercent?, consultationGstPercent (must be 0)?,
 *            diagnosticsGstPercent?, careAssistantGstPercent? }
 */
export const updateTax = makeThunk(
  'platformPricing/updateTax',
  async (payload) => {
    const { data } = await API.patch('/pricing/tax', payload);
    return data;
  },
  { successMsg: 'GST/Tax rates updated.' }
);

/**
 * PATCH /pricing/refund-policy  (superadmin only)
 * payload: { note?, rideFullRefundHoursThreshold?,
 *            ridePartialRefundPercent?,
 *            refundProcessingDaysMin?, refundProcessingDaysMax? }
 */
export const updateRefundPolicy = makeThunk(
  'platformPricing/updateRefundPolicy',
  async (payload) => {
    const { data } = await API.patch('/pricing/refund-policy', payload);
    return data;
  },
  { successMsg: 'Refund policy updated.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 4  TRANSPORT RATE HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /pricing/transport/rate/:planSlug
 * Returns: { planSlug, ratePerKm, baseFare, platformFee, currency, applicable }
 */
export const fetchTransportRate = makeThunk(
  'platformPricing/fetchTransportRate',
  async (planSlug) => {
    const { data } = await API.get(`/pricing/transport/rate/${planSlug}`);
    return data;
  },
  { silentError: true }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 5  AUDIT / VERSION HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/** GET /pricing/history — paginated, newest first. params: { page?, limit? } */
export const fetchPricingHistory = makeThunk(
  'platformPricing/fetchHistory',
  async (params = {}) => {
    const { data } = await API.get('/pricing/history', { params });
    return data;
  }
);

/** GET /pricing/history/:index — single snapshot (superadmin) */
export const fetchPricingHistoryByIndex = makeThunk(
  'platformPricing/fetchHistoryByIndex',
  async (index) => {
    const { data } = await API.get(`/pricing/history/${index}`);
    return data;
  }
);

/** POST /pricing/restore/:index — restore to a snapshot (superadmin) */
export const restorePricingConfig = makeThunk(
  'platformPricing/restoreConfig',
  async ({ index, note }) => {
    const { data } = await API.post(`/pricing/restore/${index}`, { note });
    return data;
  },
  { successMsg: 'Platform config restored to selected snapshot.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const asyncStatus = () => ({ loading: false, error: null });
const paginationInit = () => ({ total: 0, page: 1, pages: 1 });

const initialState = {
  // ── Admin (full) config ────────────────────────────────────────────────────
  adminConfig:       null,
  adminConfigStatus: asyncStatus(),

  // ── Public / customer-safe config ─────────────────────────────────────────
  publicConfig:       null,
  publicConfigStatus: asyncStatus(),

  // ── Full-config update (superadmin) ───────────────────────────────────────
  fullUpdateStatus: asyncStatus(),

  // ── Per-section save statuses ─────────────────────────────────────────────
  capsStatus:                  asyncStatus(),
  transportStatus:             asyncStatus(),
  careAssistantStatus:         asyncStatus(),
  // BUG FIX: added separate status for tier updates
  careAssistantTiersStatus:    asyncStatus(),
  doctorStatus:                asyncStatus(),
  hospitalStatus:              asyncStatus(),
  diagnosticsStatus:           asyncStatus(),
  pharmacyStatus:              asyncStatus(),
  customPlanOptionsStatus:     asyncStatus(),
  adsStatus:                   asyncStatus(),
  taxStatus:                   asyncStatus(),
  refundPolicyStatus:          asyncStatus(),

  // ── Override deletion statuses ─────────────────────────────────────────────
  hospitalOverrideDeleteStatus: asyncStatus(),

  // ── Transport rate cache keyed by planSlug ─────────────────────────────────
  // { [planSlug]: { ratePerKm, baseFare, platformFee, currency, applicable } }
  transportRates:      {},
  transportRateStatus: asyncStatus(),

  // ── Audit / Version History ────────────────────────────────────────────────
  history:           [],
  historyPagination: paginationInit(),
  historyStatus:     asyncStatus(),

  selectedSnapshot:       null,
  selectedSnapshotStatus: asyncStatus(),

  restoreStatus: asyncStatus(),
};

// ─────────────────────────────────────────────────────────────────────────────
//  SLICE
// ─────────────────────────────────────────────────────────────────────────────

const platformPricingSlice = createSlice({
  name: 'platformPricing',
  initialState,

  reducers: {
    /** Call on logout — wipes admin-only state, retains public config */
    clearAdminPricingState: (state) => {
      state.adminConfig                  = null;
      state.adminConfigStatus            = asyncStatus();
      state.fullUpdateStatus             = asyncStatus();
      state.capsStatus                   = asyncStatus();
      state.transportStatus              = asyncStatus();
      state.careAssistantStatus          = asyncStatus();
      state.careAssistantTiersStatus     = asyncStatus();
      state.doctorStatus                 = asyncStatus();
      state.hospitalStatus               = asyncStatus();
      state.diagnosticsStatus            = asyncStatus();
      state.pharmacyStatus               = asyncStatus();
      state.customPlanOptionsStatus      = asyncStatus();
      state.adsStatus                    = asyncStatus();
      state.taxStatus                    = asyncStatus();
      state.refundPolicyStatus           = asyncStatus();
      state.hospitalOverrideDeleteStatus = asyncStatus();
      state.history                      = [];
      state.historyPagination            = paginationInit();
      state.historyStatus                = asyncStatus();
      state.selectedSnapshot             = null;
      state.selectedSnapshotStatus       = asyncStatus();
      state.restoreStatus                = asyncStatus();
    },

    clearPublicPricingState: (state) => {
      state.publicConfig       = null;
      state.publicConfigStatus = asyncStatus();
    },

    /** Clear a named status key's error before resubmission */
    clearPricingError: (state, action) => {
      const key = action.payload;
      if (state[key]) state[key].error = null;
    },

    clearSelectedSnapshot: (state) => {
      state.selectedSnapshot       = null;
      state.selectedSnapshotStatus = asyncStatus();
    },

    /** Evict transport rate cache for one slug (or all if no arg) */
    evictTransportRate: (state, action) => {
      if (action.payload) delete state.transportRates[action.payload];
      else state.transportRates = {};
    },

    clearRestoreStatus: (state) => {
      state.restoreStatus = asyncStatus();
    },
  },

  extraReducers: (builder) => {
    const pending  = (key) => (state)         => { state[key].loading = true;  state[key].error = null; };
    const rejected = (key) => (state, action) => { state[key].loading = false; state[key].error = action.payload; };

    /** Sync publicConfig from adminConfig whenever a full config is loaded/updated */
    const syncPublic = (state) => {
      if (!state.adminConfig) return;
      state.publicConfig = {
        caps:              state.adminConfig.caps,
        customPlanOptions: state.adminConfig.customPlanOptions,
        tax:               state.adminConfig.tax,
        refundPolicy:      state.adminConfig.refundPolicy,
      };
    };

    builder
      // ── § 1  Read ──────────────────────────────────────────────────────────
      .addCase(fetchAdminPricingConfig.pending,   pending('adminConfigStatus'))
      .addCase(fetchAdminPricingConfig.rejected,  rejected('adminConfigStatus'))
      .addCase(fetchAdminPricingConfig.fulfilled, (state, action) => {
        state.adminConfigStatus.loading = false;
        state.adminConfig = action.payload.data ?? null;
        syncPublic(state);
      })

      .addCase(fetchPublicPricingConfig.pending,   pending('publicConfigStatus'))
      .addCase(fetchPublicPricingConfig.rejected,  rejected('publicConfigStatus'))
      .addCase(fetchPublicPricingConfig.fulfilled, (state, action) => {
        state.publicConfigStatus.loading = false;
        state.publicConfig = action.payload.data ?? null;
      })

      // ── § 2  Full update ───────────────────────────────────────────────────
      .addCase(updateFullPricingConfig.pending,   pending('fullUpdateStatus'))
      .addCase(updateFullPricingConfig.rejected,  rejected('fullUpdateStatus'))
      .addCase(updateFullPricingConfig.fulfilled, (state, action) => {
        state.fullUpdateStatus.loading = false;
        state.adminConfig = action.payload.data ?? state.adminConfig;
        syncPublic(state);
      })

      // ── § 3  Section patches ───────────────────────────────────────────────
      .addCase(updateCaps.pending,   pending('capsStatus'))
      .addCase(updateCaps.rejected,  rejected('capsStatus'))
      .addCase(updateCaps.fulfilled, (state, action) => {
        state.capsStatus.loading = false;
        if (state.adminConfig)  state.adminConfig.caps  = action.payload.data;
        if (state.publicConfig) state.publicConfig.caps = action.payload.data;
      })

      .addCase(updateTransport.pending,   pending('transportStatus'))
      .addCase(updateTransport.rejected,  rejected('transportStatus'))
      .addCase(updateTransport.fulfilled, (state, action) => {
        state.transportStatus.loading = false;
        if (state.adminConfig) state.adminConfig.transport = action.payload.data;
        // Evict all transport rate cache — planRateOverrides may have changed
        state.transportRates = {};
      })

      .addCase(updateCareAssistant.pending,   pending('careAssistantStatus'))
      .addCase(updateCareAssistant.rejected,  rejected('careAssistantStatus'))
      .addCase(updateCareAssistant.fulfilled, (state, action) => {
        state.careAssistantStatus.loading = false;
        if (state.adminConfig) state.adminConfig.careAssistant = action.payload.data;
      })

      // BUG FIX: added cases for the new tiers thunk
      .addCase(updateCareAssistantTiers.pending,   pending('careAssistantTiersStatus'))
      .addCase(updateCareAssistantTiers.rejected,  rejected('careAssistantTiersStatus'))
      .addCase(updateCareAssistantTiers.fulfilled, (state, action) => {
        state.careAssistantTiersStatus.loading = false;
        if (state.adminConfig) state.adminConfig.careAssistant = action.payload.data;
      })

      .addCase(updateDoctor.pending,   pending('doctorStatus'))
      .addCase(updateDoctor.rejected,  rejected('doctorStatus'))
      .addCase(updateDoctor.fulfilled, (state, action) => {
        state.doctorStatus.loading = false;
        if (state.adminConfig) state.adminConfig.doctor = action.payload.data;
      })

      .addCase(updateHospital.pending,   pending('hospitalStatus'))
      .addCase(updateHospital.rejected,  rejected('hospitalStatus'))
      .addCase(updateHospital.fulfilled, (state, action) => {
        state.hospitalStatus.loading = false;
        if (state.adminConfig) state.adminConfig.hospital = action.payload.data;
      })

      .addCase(deleteHospitalOverride.pending,   pending('hospitalOverrideDeleteStatus'))
      .addCase(deleteHospitalOverride.rejected,  rejected('hospitalOverrideDeleteStatus'))
      .addCase(deleteHospitalOverride.fulfilled, (state, action) => {
        state.hospitalOverrideDeleteStatus.loading = false;
        // action.payload.data = remaining hospitalOverrides as plain object
        if (state.adminConfig?.hospital) {
          state.adminConfig.hospital.hospitalOverrides = action.payload.data;
        }
      })

      .addCase(updateDiagnostics.pending,   pending('diagnosticsStatus'))
      .addCase(updateDiagnostics.rejected,  rejected('diagnosticsStatus'))
      .addCase(updateDiagnostics.fulfilled, (state, action) => {
        state.diagnosticsStatus.loading = false;
        if (state.adminConfig) state.adminConfig.diagnostics = action.payload.data;
      })

      .addCase(updatePharmacy.pending,   pending('pharmacyStatus'))
      .addCase(updatePharmacy.rejected,  rejected('pharmacyStatus'))
      .addCase(updatePharmacy.fulfilled, (state, action) => {
        state.pharmacyStatus.loading = false;
        if (state.adminConfig) state.adminConfig.pharmacy = action.payload.data;
      })

      .addCase(updateCustomPlanOptions.pending,   pending('customPlanOptionsStatus'))
      .addCase(updateCustomPlanOptions.rejected,  rejected('customPlanOptionsStatus'))
      .addCase(updateCustomPlanOptions.fulfilled, (state, action) => {
        state.customPlanOptionsStatus.loading = false;
        if (state.adminConfig)  state.adminConfig.customPlanOptions  = action.payload.data;
        if (state.publicConfig) state.publicConfig.customPlanOptions = action.payload.data;
      })

      .addCase(updateAds.pending,   pending('adsStatus'))
      .addCase(updateAds.rejected,  rejected('adsStatus'))
      .addCase(updateAds.fulfilled, (state, action) => {
        state.adsStatus.loading = false;
        if (state.adminConfig) state.adminConfig.ads = action.payload.data;
      })

      .addCase(updateTax.pending,   pending('taxStatus'))
      .addCase(updateTax.rejected,  rejected('taxStatus'))
      .addCase(updateTax.fulfilled, (state, action) => {
        state.taxStatus.loading = false;
        if (state.adminConfig)  state.adminConfig.tax  = action.payload.data;
        if (state.publicConfig) state.publicConfig.tax = action.payload.data;
      })

      .addCase(updateRefundPolicy.pending,   pending('refundPolicyStatus'))
      .addCase(updateRefundPolicy.rejected,  rejected('refundPolicyStatus'))
      .addCase(updateRefundPolicy.fulfilled, (state, action) => {
        state.refundPolicyStatus.loading = false;
        if (state.adminConfig)  state.adminConfig.refundPolicy  = action.payload.data;
        if (state.publicConfig) state.publicConfig.refundPolicy = action.payload.data;
      })

      // ── § 4  Transport rate ────────────────────────────────────────────────
      .addCase(fetchTransportRate.pending,   pending('transportRateStatus'))
      .addCase(fetchTransportRate.rejected,  rejected('transportRateStatus'))
      .addCase(fetchTransportRate.fulfilled, (state, action) => {
        state.transportRateStatus.loading = false;
        const rateData = action.payload.data;
        if (rateData?.planSlug) {
          state.transportRates[rateData.planSlug] = {
            ratePerKm:   rateData.ratePerKm,
            baseFare:    rateData.baseFare,
            platformFee: rateData.platformFee,
            currency:    rateData.currency,
            applicable:  rateData.applicable,
          };
        }
      })

      // ── § 5  History / restore ─────────────────────────────────────────────
      .addCase(fetchPricingHistory.pending,   pending('historyStatus'))
      .addCase(fetchPricingHistory.rejected,  rejected('historyStatus'))
      .addCase(fetchPricingHistory.fulfilled, (state, action) => {
        state.historyStatus.loading = false;
        state.history           = action.payload.data       ?? [];
        state.historyPagination = action.payload.pagination ?? paginationInit();
      })

      .addCase(fetchPricingHistoryByIndex.pending,   pending('selectedSnapshotStatus'))
      .addCase(fetchPricingHistoryByIndex.rejected,  rejected('selectedSnapshotStatus'))
      .addCase(fetchPricingHistoryByIndex.fulfilled, (state, action) => {
        state.selectedSnapshotStatus.loading = false;
        state.selectedSnapshot = action.payload.data ?? null;
      })

      .addCase(restorePricingConfig.pending,   pending('restoreStatus'))
      .addCase(restorePricingConfig.rejected,  rejected('restoreStatus'))
      .addCase(restorePricingConfig.fulfilled, (state, action) => {
        state.restoreStatus.loading = false;
        state.adminConfig = action.payload.data ?? state.adminConfig;
        syncPublic(state);
        state.transportRates = {};
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearAdminPricingState,
  clearPublicPricingState,
  clearPricingError,
  clearSelectedSnapshot,
  evictTransportRate,
  clearRestoreStatus,
} = platformPricingSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
//  SELECTORS  (root key: state.platformPricing)
// ─────────────────────────────────────────────────────────────────────────────

const sel = (s) => s.platformPricing;

// § 1 — Admin config
export const selectAdminConfig        = (s) => sel(s).adminConfig;
export const selectAdminConfigLoading = (s) => sel(s).adminConfigStatus.loading;
export const selectAdminConfigError   = (s) => sel(s).adminConfigStatus.error;

// § 1 — Public config
export const selectPublicConfig        = (s) => sel(s).publicConfig;
export const selectPublicConfigLoading = (s) => sel(s).publicConfigStatus.loading;
export const selectPublicConfigError   = (s) => sel(s).publicConfigStatus.error;

// § 1 sub-selectors — admin sections
export const selectCaps              = (s) => sel(s).adminConfig?.caps              ?? null;
export const selectTransport         = (s) => sel(s).adminConfig?.transport         ?? null;
export const selectCareAssistant     = (s) => sel(s).adminConfig?.careAssistant     ?? null;
export const selectDoctor            = (s) => sel(s).adminConfig?.doctor            ?? null;
export const selectHospital          = (s) => sel(s).adminConfig?.hospital          ?? null;
export const selectDiagnostics       = (s) => sel(s).adminConfig?.diagnostics       ?? null;
export const selectPharmacy          = (s) => sel(s).adminConfig?.pharmacy          ?? null;
export const selectCustomPlanOptions = (s) => sel(s).adminConfig?.customPlanOptions ?? null;
export const selectAds               = (s) => sel(s).adminConfig?.ads               ?? null;
export const selectTax               = (s) => sel(s).adminConfig?.tax               ?? null;
export const selectRefundPolicy      = (s) => sel(s).adminConfig?.refundPolicy      ?? null;

// Care assistant tiers convenience selector
export const selectCareAssistantTiers = (s) =>
  sel(s).adminConfig?.careAssistant?.pricingTiers ?? [];

// § 1 sub-selectors — public sections
export const selectPublicCaps              = (s) => sel(s).publicConfig?.caps              ?? null;
export const selectPublicCustomPlanOptions = (s) => sel(s).publicConfig?.customPlanOptions ?? null;
export const selectPublicTax               = (s) => sel(s).publicConfig?.tax               ?? null;
export const selectPublicRefundPolicy      = (s) => sel(s).publicConfig?.refundPolicy      ?? null;

// Derived caps (safe defaults matching model defaults)
export const selectPharmacyDiscountMax    = (s) => sel(s).publicConfig?.caps?.pharmacyDiscountMax    ?? 25;
export const selectDiagnosticsDiscountMax = (s) => sel(s).publicConfig?.caps?.diagnosticsDiscountMax ?? 25;
export const selectConsultationsMax       = (s) => sel(s).publicConfig?.caps?.consultationsMaxPerMonth ?? 30;
export const selectTransportRidesMax      = (s) => sel(s).publicConfig?.caps?.transportMaxRidesPerMonth ?? 20;
export const selectCareAssistantVisitsMax = (s) => sel(s).publicConfig?.caps?.careAssistantMaxVisitsPerMonth ?? 30;

// § 2 — Full update
export const selectFullUpdateLoading = (s) => sel(s).fullUpdateStatus.loading;
export const selectFullUpdateError   = (s) => sel(s).fullUpdateStatus.error;

// § 3 — Section statuses
export const selectCapsLoading                  = (s) => sel(s).capsStatus.loading;
export const selectCapsError                    = (s) => sel(s).capsStatus.error;
export const selectTransportLoading             = (s) => sel(s).transportStatus.loading;
export const selectTransportError               = (s) => sel(s).transportStatus.error;
export const selectCareAssistantLoading         = (s) => sel(s).careAssistantStatus.loading;
export const selectCareAssistantError           = (s) => sel(s).careAssistantStatus.error;
export const selectCareAssistantTiersLoading    = (s) => sel(s).careAssistantTiersStatus.loading;
export const selectCareAssistantTiersError      = (s) => sel(s).careAssistantTiersStatus.error;
export const selectDoctorLoading                = (s) => sel(s).doctorStatus.loading;
export const selectDoctorError                  = (s) => sel(s).doctorStatus.error;
export const selectHospitalLoading              = (s) => sel(s).hospitalStatus.loading;
export const selectHospitalError                = (s) => sel(s).hospitalStatus.error;
export const selectDiagnosticsLoading           = (s) => sel(s).diagnosticsStatus.loading;
export const selectDiagnosticsError             = (s) => sel(s).diagnosticsStatus.error;
export const selectPharmacyLoading              = (s) => sel(s).pharmacyStatus.loading;
export const selectPharmacyError                = (s) => sel(s).pharmacyStatus.error;
export const selectCustomPlanOptionsLoading     = (s) => sel(s).customPlanOptionsStatus.loading;
export const selectCustomPlanOptionsError       = (s) => sel(s).customPlanOptionsStatus.error;
export const selectAdsLoading                   = (s) => sel(s).adsStatus.loading;
export const selectAdsError                     = (s) => sel(s).adsStatus.error;
export const selectTaxLoading                   = (s) => sel(s).taxStatus.loading;
export const selectTaxError                     = (s) => sel(s).taxStatus.error;
export const selectRefundPolicyLoading          = (s) => sel(s).refundPolicyStatus.loading;
export const selectRefundPolicyError            = (s) => sel(s).refundPolicyStatus.error;

/**
 * BUG FIX: Original was missing hospitalOverrideDeleteStatus.loading.
 *          Also added careAssistantTiersStatus.loading.
 */
export const selectAnySectionSaving = (s) => {
  const p = sel(s);
  return (
    p.capsStatus.loading              ||
    p.transportStatus.loading         ||
    p.careAssistantStatus.loading     ||
    p.careAssistantTiersStatus.loading ||
    p.doctorStatus.loading            ||
    p.hospitalStatus.loading          ||
    p.hospitalOverrideDeleteStatus.loading || // BUG FIX: was missing
    p.diagnosticsStatus.loading       ||
    p.pharmacyStatus.loading          ||
    p.customPlanOptionsStatus.loading ||
    p.adsStatus.loading               ||
    p.taxStatus.loading               ||
    p.refundPolicyStatus.loading      ||
    p.fullUpdateStatus.loading
  );
};

// Override deletion
export const selectHospitalOverrideDeleteLoading = (s) => sel(s).hospitalOverrideDeleteStatus.loading;
export const selectHospitalOverrideDeleteError   = (s) => sel(s).hospitalOverrideDeleteStatus.error;

// § 4 — Transport rates
export const selectTransportRates       = (s) => sel(s).transportRates;
export const selectTransportRateForSlug = (planSlug) => (s) => sel(s).transportRates[planSlug] ?? null;
export const selectTransportRateLoading = (s) => sel(s).transportRateStatus.loading;
export const selectTransportRateError   = (s) => sel(s).transportRateStatus.error;

// § 5 — History
export const selectPricingHistory           = (s) => sel(s).history;
export const selectPricingHistoryPagination = (s) => sel(s).historyPagination;
export const selectPricingHistoryLoading    = (s) => sel(s).historyStatus.loading;
export const selectPricingHistoryError      = (s) => sel(s).historyStatus.error;
export const selectSelectedSnapshot         = (s) => sel(s).selectedSnapshot;
export const selectSelectedSnapshotLoading  = (s) => sel(s).selectedSnapshotStatus.loading;
export const selectRestoreLoading           = (s) => sel(s).restoreStatus.loading;
export const selectRestoreError             = (s) => sel(s).restoreStatus.error;

// ─────────────────────────────────────────────────────────────────────────────
//  DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default platformPricingSlice.reducer;