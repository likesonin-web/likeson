/**
 * Seed Data — Likeson.in Fixed Subscription Plans (6 tiers)
 *
 * Source: WhatsApp_Image_2026-03-14 plan comparison table
 *         + Project_Overview_original.pdf (sections 3, 5, 9)
 *
 * "No Plan" is NOT seeded — pay-per-use pricing lives in PlatformPricingConfig.
 *
 * Usage:
 *   import { fixedPlansSeed } from './seed/subscriptionPlans.seed.js';
 *   await SubscriptionPlan.insertMany(fixedPlansSeed);
 */

export const fixedPlansSeed = [

  // ───────────────────────────────────────────────────────────────────────────
  // 1. BASIC CARE — ₹499/month
  // ───────────────────────────────────────────────────────────────────────────
  {
    name:      'Basic Care',
    slug:      'basic-care',
    planType:  'fixed',
    fixedTier: 'Basic Care',
    visibleToCustomerOnly: false,
    description: 'Essential monthly care for individuals with occasional healthcare needs.',
    isActive: true,

    pricing: { monthly: 499, billingCycle: 'monthly', billingLabel: '/month', currency: 'INR' },
    freeTrial: { enabled: true, durationDays: 7, requiresPaymentMethod: false },
    membership: { maxMembers: 1 },

    consultations: {
      freePerMonth: 2,
      doctorRangeLabel: 'Single Doctor',
      modes: { inPerson: true, video: false, home: false },
      specialNote: 'Free 2 Consultations per Month (Single Doctor)',
    },

    pharmacy: {
      discountMin: 10, discountMax: 15, isFlat: false,
      deliveryChargePerOrder: 10,
      deliveryNote: '₹10/- charge per Delivery',
    },

    diagnostics: {
      discountPercent: 10, isApplicable: true, homeSampleCollection: true,
    },

    transport: { ratePerKm: 20, isApplicable: true, ridesPerMonth: null },

    careAssistant: {
      included: true, isDedicated: false, serviceType: 'Standard',
      note: 'Standard service price for Care Assistant',
    },

    support: { priorityAppointmentScheduling: true, tier: 'Priority' },

    features: {
      noHiddenCharges: true,
      additionalFeatures: [
        'Priority Appointment Scheduling',
        'Priority Customer Care Support',
        'Free Home Sample Collection',
        '10%–15% Medicine Discount (online purchase)',
        '10% Diagnostic Discount',
        '₹10/- Delivery Charge per Order',
      ],
    },

    idealFor: 'Low-usage individuals, young adults, students',
    displayOrder: 1,
    isFeatured: false,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 2. STANDARD CARE — ₹999/month
  // ───────────────────────────────────────────────────────────────────────────
  {
    name:      'Standard Care',
    slug:      'standard-care',
    planType:  'fixed',
    fixedTier: 'Standard Care',
    visibleToCustomerOnly: false,
    description: 'Balanced care with free delivery and broader doctor access.',
    isActive: true,

    pricing: { monthly: 999, billingCycle: 'monthly', billingLabel: '/month', currency: 'INR' },
    freeTrial: { enabled: true, durationDays: 7, requiresPaymentMethod: false },
    membership: { maxMembers: 1 },

    consultations: {
      freePerMonth: 3,
      doctorRangeLabel: '1-2 Doctors',
      modes: { inPerson: true, video: false, home: false },
      specialNote: 'Free 3 Consultations per Month (1-2 Doctors)',
    },

    pharmacy: {
      discountMin: 15, discountMax: 20, isFlat: false,
      deliveryChargePerOrder: 0,
      deliveryNote: 'Free Delivery',
    },

    diagnostics: {
      discountPercent: 10, isApplicable: true, homeSampleCollection: true,
    },

    transport: { ratePerKm: 19, isApplicable: true, ridesPerMonth: null },

    careAssistant: {
      included: true, isDedicated: false, serviceType: 'Standard',
      note: 'Standard service price for Care Assistant',
    },

    support: { priorityAppointmentScheduling: true, tier: 'Priority' },

    features: {
      noHiddenCharges: true,
      additionalFeatures: [
        'Priority Appointment Scheduling',
        'Priority Customer Care Support',
        'Free Home Sample Collection',
        'Free Delivery on Medicines',
        '15%–20% Medicine Discount (online purchase)',
        '10% Diagnostic Discount',
      ],
    },

    idealFor: 'Working professionals, elderly with occasional needs',
    displayOrder: 2,
    isFeatured: false,
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 3. PREMIUM CARE — ₹1999/month
  // ───────────────────────────────────────────────────────────────────────────
  {
    name:      'Premium Care',
    slug:      'premium-care',
    planType:  'fixed',
    fixedTier: 'Premium Care',
    visibleToCustomerOnly: false,
    description: 'Comprehensive care for chronic patients — unlimited consultations, flat discounts.',
    isActive: true,

    pricing: { monthly: 1999, billingCycle: 'monthly', billingLabel: '/month', currency: 'INR' },
    freeTrial: { enabled: true, durationDays: 7, requiresPaymentMethod: false },
    membership: { maxMembers: 1 },

    consultations: {
      freePerMonth: 5,
      doctorRangeLabel: '1-3 Doctors',
      modes: { inPerson: true, video: true, home: true },
      specialNote: 'Free 5 Consultations per Month (1-3 Doctors)',
    },

    pharmacy: {
      discountMin: 20, discountMax: 20, isFlat: true,
      deliveryChargePerOrder: 0,
      deliveryNote: 'Free Delivery',
    },

    diagnostics: {
      discountPercent: 20, isApplicable: true, homeSampleCollection: true,
    },

    transport: { ratePerKm: 18, isApplicable: true, ridesPerMonth: null },

    careAssistant: {
      included: true, isDedicated: false, serviceType: 'Standard',
      note: 'Standard service price for Care Assistant',
    },

    support: { priorityAppointmentScheduling: true, tier: 'Dedicated Executive' },

    features: {
      noHiddenCharges: true,
      monthlyHealthSummary: true,
      noCancellationCharges: true,
      autoRefillReminders: true,
      digitalReportAccess: true,
      additionalFeatures: [
        'Priority Appointment Scheduling',
        'Dedicated Customer Care Executive',
        'Free Home Sample Collection',
        'Free Delivery on Medicines',
        'Flat 20% Medicine Discount (online purchase)',
        'Flat 20% Diagnostic Discount',
        'Monthly Health Summary',
        'No Cancellation Charges',
        'Digital Report Access',
      ],
    },

    idealFor: 'Individuals with chronic diseases or dependent elderly',
    displayOrder: 3,
    isFeatured: true,
    badgeLabel: 'Most Popular',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 4. FAMILY CARE — ₹3499/month
  // ───────────────────────────────────────────────────────────────────────────
  {
    name:      'Family Care',
    slug:      'family-care',
    planType:  'fixed',
    fixedTier: 'Family Care',
    visibleToCustomerOnly: false,
    description: 'Up to 4 family members under a single plan with combined consultation quota.',
    isActive: true,

    pricing: { monthly: 3499, billingCycle: 'monthly', billingLabel: '/month', currency: 'INR' },
    freeTrial: { enabled: true, durationDays: 7, requiresPaymentMethod: false },
    membership: {
      maxMembers: 4,
      membershipNote: 'Coverage for Up to 4 Members',
    },

    consultations: {
      freePerMonth: 8,
      doctorRangeLabel: '1-6 Doctors',
      modes: { inPerson: true, video: true, home: false },
      specialNote: 'Free 8 Consultations per month (1-6 Doctors), 1 Video consultation (for NRIs in family)',
    },

    pharmacy: {
      discountMin: 20, discountMax: 20, isFlat: true,
      deliveryChargePerOrder: 0,
      deliveryNote: 'Free Delivery',
    },

    diagnostics: {
      discountPercent: 20, isApplicable: true, homeSampleCollection: true,
    },

    transport: { ratePerKm: 18, isApplicable: true, ridesPerMonth: null },

    careAssistant: {
      included: true, isDedicated: false, serviceType: 'Standard',
      note: 'Standard service price for Care Assistant',
    },

    support: { priorityAppointmentScheduling: true, tier: 'Dedicated Executive' },

    features: {
      noHiddenCharges: true,
      monthlyHealthSummary: true,
      noCancellationCharges: true,
      autoRefillReminders: true,
      digitalReportAccess: true,
      additionalFeatures: [
        'Priority Appointment Scheduling',
        'Dedicated Customer Care Executive',
        'Free Home Sample Collection',
        'Free Delivery on Medicines',
        'Flat 20% Medicine Discount',
        'Flat 20% Diagnostic Discount',
        'Health Tracker Dashboard for each member',
      ],
    },

    idealFor: 'Families managing elderly, children, or multi-patient households',
    displayOrder: 4,
    isFeatured: false,
    badgeLabel: 'Best for Families',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PREGNANT WOMEN CARE — ₹5999 (Till Delivery)
  // ───────────────────────────────────────────────────────────────────────────
  {
    name:      'Pregnant Women Care',
    slug:      'pregnant-women-care',
    planType:  'fixed',
    fixedTier: 'Pregnant Women Care',
    visibleToCustomerOnly: false,
    description: 'End-to-end maternity support with a dedicated care assistant, valid till delivery.',
    isActive: true,

    pricing: { monthly: 5999, billingCycle: 'till_delivery', billingLabel: 'Till Delivery', currency: 'INR' },
    freeTrial: { enabled: true, durationDays: 7, requiresPaymentMethod: false },
    membership: { maxMembers: 1 },

    consultations: {
      freePerMonth: 20,
      doctorRangeLabel: '1-3 Doctors',
      modes: { inPerson: true, video: true, home: true },
      specialNote: 'Free 20 Consultations (max.) per month (1-3 Doctors)',
    },

    pharmacy: {
      discountMin: 21, discountMax: 21, isFlat: true,
      deliveryChargePerOrder: 0,
      deliveryNote: 'Free Delivery',
    },

    diagnostics: {
      discountPercent: 21, isApplicable: true, homeSampleCollection: true,
    },

    transport: { ratePerKm: 18, isApplicable: true, ridesPerMonth: null },

    careAssistant: {
      included: true, isDedicated: true, serviceType: 'Dedicated',
      note: 'Dedicated Care Assistant exclusively assigned for maternity support',
    },

    support: { priorityAppointmentScheduling: true, tier: 'Dedicated Executive' },

    features: {
      noHiddenCharges: true,
      monthlyHealthSummary: true,
      noCancellationCharges: true,
      autoRefillReminders: true,
      digitalReportAccess: true,
      additionalFeatures: [
        'Priority Appointment Scheduling',
        'Dedicated Customer Care Executive',
        'Dedicated Care Assistant (maternity)',
        'Free Home Sample Collection',
        'Free Delivery on Medicines',
        'Flat 21% Medicine Discount (online purchase)',
        'Flat 21% Diagnostic Discount',
      ],
    },

    idealFor: 'Pregnant women requiring end-to-end maternity care support',
    displayOrder: 5,
    isFeatured: false,
    badgeLabel: 'Maternity Special',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // 6. NRI'S CARE — ₹2999/month
  // ───────────────────────────────────────────────────────────────────────────
  {
    name:      "NRI's Care",
    slug:      'nris-care',
    planType:  'fixed',
    fixedTier: "NRI's Care",
    visibleToCustomerOnly: false,
    description: 'Trusted local healthcare for NRI families in India — video-first, 24/7 support.',
    isActive: true,

    pricing: { monthly: 2999, billingCycle: 'monthly', billingLabel: '/month', currency: 'INR' },
    freeTrial: { enabled: true, durationDays: 7, requiresPaymentMethod: false },
    membership: {
      maxMembers: 2,
      membershipNote: 'Up to 2 Members',
    },

    consultations: {
      freePerMonth: 3,
      doctorRangeLabel: '1-2 Doctors',
      modes: { inPerson: false, video: true, home: false },
      specialNote: 'Free 3 Video Consultations per month (1-2 Doctors)',
    },

    pharmacy: {
      discountMin: 0, discountMax: 0, isFlat: false,
      specialOffer: 'International standard e-Prescription',
      deliveryChargePerOrder: null,
      deliveryNote: 'International standard Medical Summary',
    },

    diagnostics: {
      discountPercent: 0, isApplicable: false, homeSampleCollection: false,
    },

    transport: { ratePerKm: null, isApplicable: false, ridesPerMonth: null },

    careAssistant: {
      included: false, isDedicated: false, serviceType: 'None',
      note: 'Not applicable for NRI plan',
    },

    support: { priorityAppointmentScheduling: true, tier: '24/7 Service' },

    features: {
      noHiddenCharges: true,
      digitalReportAccess: true,
      additionalFeatures: [
        'Priority Appointment Scheduling',
        '24/7 Customer Care Service',
        'International Standard e-Prescription',
        'International Standard Medical Summary',
      ],
    },

    idealFor: 'NRIs managing healthcare for family members residing in India',
    displayOrder: 6,
    isFeatured: false,
    badgeLabel: 'NRI Special',
  },
];