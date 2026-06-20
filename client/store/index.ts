import { configureStore } from "@reduxjs/toolkit";

// ─────────────────────────────────────────────────────────────────────────────
// SLICE IMPORTS (Alphabetical Order)
// ─────────────────────────────────────────────────────────────────────────────
import accountingReducer from "./slices/accountingSlice";
import adminAnalysticsReducer from "./slices/adminAnalyticsSlice";
import adminUserReducer from "./slices/adminUserSlice";
import adsReducer from "./slices/adsSlice";
import availabilityReducer from "./slices/availabilitySlice";
import bannersReducer from "./slices/bannerSlice";
import bloodbankReducer from "./slices/bloodbankSlice";
import bookingReducer from "./slices/bookingSlice";
import careAssistantReducer from "./slices/careAssistantSlice";
import chatReducer from "./slices/chatSlice";
import clinicalReducer from "./slices/clinicalSlice";
import consulationReducer from "./slices/consultationSlice";
import cookieConsentReducer from "./slices/cookieConsentSlice";
import customerProfileReducer from "./slices/customerProfileSlice";
import driverReducer from "./slices/driverSlice";
import faqReducer from "./slices/faqSlice";
import heroPageReducer from "./slices/heroPageSlice";
import hospitalManagerReducer from "./slices/hospitalManagerSlice";
import hospitalReducer from "./slices/hospitalSlice";
import labPartnerBookingsReducer from "./slices/labPartnerBookingSlice";
import labReducer from "./slices/labSlice";
import legalReducer from "./slices/legalSlice";
import marqueeReducer from "./slices/marqueeSlice";
import medicineReducer from "./slices/medicineSlice";
import meetingsReducer from "./slices/meetingSlice";
import notificationsReducer from "./slices/notificationSlice";
import operationsReducer from "./slices/operationsSlice";
import payAtServiceReducer from './slices/payAtServiceSlice';
import pharmacyOrderReducer from "./slices/pharmacyOrderSlice";
import pharmacyReducer from "./slices/pharmacySlice";
import pharmacyStoreReducer from "./slices/pharmacy/pharmacyStoreSlice";
import platformPricingReducer from "./slices/platformPricingSlice";
import promotionReducer from "./slices/promotionSlice";
import referralReducer from "./slices/referralSlice";
import rideRequestReducer from "./slices/rideRequestSlice";
import searchReducer from "./slices/searchSlice";
import soloDriverReducer from "./slices/soloDriverSlice";
import subscriptionPlansReducer from "./slices/subscriptionPlanSlice";
import usersubscriptionPlansReducer from "./slices/subscriptionSlice";
import superadminReducer from "./slices/superadminSlice";
import transportPartnerReducer from "./slices/transportPartnerSlice";
import uploadReducer from "./slices/uploadSlice";
import userManagementReducer from "./slices/userManagementSlice";
import userReducer from "./slices/userSlice";
import walletReducer from "./slices/walletSlice";

// ─────────────────────────────────────────────────────────────────────────────
// STORE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: {
    accounting: accountingReducer,
    adminAnalytics: adminAnalysticsReducer,
    adminUsers: adminUserReducer,
    ads: adsReducer,
    availability: availabilityReducer,
    banners: bannersReducer,
    bloodBank: bloodbankReducer,
    booking: bookingReducer,
    careAssistant: careAssistantReducer,
    chat: chatReducer,
    clinical: clinicalReducer,
    consultation: consulationReducer,
    cookieConsent: cookieConsentReducer,
    customerProfile: customerProfileReducer,
    driver: driverReducer,
    faq: faqReducer,
    heroPage: heroPageReducer,
    hospital: hospitalReducer,
    hospitalManager: hospitalManagerReducer,
    labPartnerBookings: labPartnerBookingsReducer,
    labs: labReducer,
    legal: legalReducer,
    marquee: marqueeReducer,
    medicine: medicineReducer,
    meeting: meetingsReducer,
    notifications: notificationsReducer,
    operations: operationsReducer,
    payAtService: payAtServiceReducer,
    pharmacy: pharmacyReducer,
    pharmacyOrder: pharmacyOrderReducer,
    pharmacyStore: pharmacyStoreReducer,
    platformPricing: platformPricingReducer,
    promotion: promotionReducer,
    referral: referralReducer,
    rideRequest: rideRequestReducer,
    search: searchReducer,
    soloDriver: soloDriverReducer,
    subscriptionPlan: subscriptionPlansReducer,
    subscriptions: usersubscriptionPlansReducer,
    superadmin: superadminReducer,
    transportPartner: transportPartnerReducer,
    upload: uploadReducer,
    user: userReducer,
    userManagement: userManagementReducer,
    wallet: walletReducer,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────
// This exports the 'RootState' type that your page.tsx is looking for
export type RootState = ReturnType<typeof store.getState>;
// This exports the 'AppDispatch' type for use with useDispatch
export type AppDispatch = typeof store.dispatch;