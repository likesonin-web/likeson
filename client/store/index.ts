import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";
import hospitalReducer from "./slices/hospitalSlice";
import uploadReducer from "./slices/uploadSlice";
import adsReducer from "./slices/adsSlice";
import bannersReducer from "./slices/bannerSlice";
import subscriptionPlansReducer from "./slices/subscriptionPlanSlice";
import transportPartnerReducer from "./slices/transportPartnerSlice";
import userManagementReducer from "./slices/userManagementSlice";
import meetingsReducer from "./slices/meetingSlice";
import medicineReducer from "./slices/medicineSlice";
import notificationsReducer from "./slices/notificationSlice";
import faqReducer from "./slices/faqSlice";
import promotionReducer from "./slices/promotionSlice";
import chatReducer from "./slices/chatSlice";
import usersubscriptionPlansReducer from "./slices/subscriptionSlice";
import pharmacyOrderReducer from "./slices/pharmacyOrderSlice";
import pharmacyReducer from "./slices/pharmacySlice";
import walletReducer from "./slices/walletSlice";
import superadminReducer from "./slices/superadminSlice";
import legalReducer from "./slices/legalSlice";
import marqueeReducer from "./slices/marqueeSlice";
import adminUserReducer from "./slices/adminUserSlice";
import customerProfileReducer from "./slices/customerProfileSlice";
import heroPageReducer from "./slices/heroPageSlice";
import referralReducer from "./slices/referralSlice";
import pharmacyStoreReducer from "./slices/pharmacy/pharmacyStoreSlice";
 import platformPricingReducer from './slices/platformPricingSlice';
 import soloDriverReducer  from './slices/soloDriverSlice';
 import careAssistantReducer from './slices/careAssistantSlice';
import labReducer from './slices/labSlice';
import hospitalManagerReducer from './slices/hospitalManagerSlice';
export const store = configureStore({
  reducer: {
    user: userReducer,
    hospital: hospitalReducer,
    upload: uploadReducer,
    ads: adsReducer,
    banners: bannersReducer,
    subscriptionPlan: subscriptionPlansReducer,
    transportPartner: transportPartnerReducer,
    userManagement: userManagementReducer,
    meeting: meetingsReducer,
    medicine: medicineReducer,
    notifications: notificationsReducer,
    faq: faqReducer,
    promotion: promotionReducer,
    chat: chatReducer,
    subscriptions: usersubscriptionPlansReducer,
    pharmacyOrder: pharmacyOrderReducer,
    pharmacy: pharmacyReducer,
    wallet: walletReducer,
    superadmin: superadminReducer,
    legal: legalReducer,
    marquee: marqueeReducer,
    adminUsers: adminUserReducer,
    heroPage: heroPageReducer,
    referral: referralReducer,
 platformPricing: platformPricingReducer,
    customerProfile: customerProfileReducer,
soloDriver: soloDriverReducer,
    //  pharmacy slices
    pharmacyStore: pharmacyStoreReducer,
    careAssistant: careAssistantReducer,
    hospitalManager: hospitalManagerReducer,
    labs: labReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

// --- ADD THESE LINES ---
// This exports the 'RootState' type that your page.tsx is looking for
export type RootState = ReturnType<typeof store.getState>;
// This exports the 'AppDispatch' type for use with useDispatch
export type AppDispatch = typeof store.dispatch;
