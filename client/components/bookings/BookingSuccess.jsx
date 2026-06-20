"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { PP } from "@/lib/constants";
import { fmt } from "@/lib/helpers";

export function BookingSuccess({ data, onReset, router }) {
  const bookingId = data?.bookingId || data?._id;
  const bookingCode = data?.bookingCode;
  const opNumber = data?.opNumber;
  const caAssigned = data?.careAssistantAssigned;
  const totalCharged = data?.fareBreakdown?.totalAmount;
  const walletApplied = data?.fareBreakdown?.walletApplied || 0;
  const razorpayPortion = data?.walletSplit?.razorpayPortion || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center py-8 space-y-5 px-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 220, delay: 0.1 }}
        className="w-16 h-16 rounded-3xl flex items-center justify-center bg-success/12"
      >
        <CheckCircle2 size={32} className="text-success" />
      </motion.div>
      <div>
        <h2
          className="text-lg font-black tracking-tight mb-1 text-success"
          style={PP}
        >
          Booking Confirmed!
        </h2>
        <p
          className="text-xs text-base-content/50 max-w-xs mx-auto leading-relaxed"
          style={PP}
        >
          Your booking is placed. Confirmation SMS and email arriving shortly.
        </p>
      </div>
      <div className="w-full max-w-xs rounded-2xl border border-success/30">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-success/20 bg-success/5">
          <span
            className="text-[10px] font-black uppercase tracking-widest text-success"
            style={PP}
          >
            Booking Reference
          </span>
          <span className="font-black text-xs text-success" style={PP}>
            {bookingCode ? `#${bookingCode}` : "—"}
          </span>
        </div>
        <div className="p-3 space-y-2 text-xs bg-base-100">
          {opNumber && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                OP Number
              </span>
              <span className="font-black" style={PP}>
                {opNumber}
              </span>
            </div>
          )}
          {caAssigned?.name && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                Care Assistant
              </span>
              <span className="font-black" style={PP}>
                {caAssigned.name}
              </span>
            </div>
          )}
          {walletApplied > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                Wallet paid
              </span>
              <span className="font-black text-primary" style={PP}>
                {fmt(walletApplied)}
              </span>
            </div>
          )}
          {razorpayPortion > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-base-content/50" style={PP}>
                Razorpay paid
              </span>
              <span className="font-black text-primary" style={PP}>
                {fmt(razorpayPortion)}
              </span>
            </div>
          )}
          {totalCharged != null && (
            <div className="flex justify-between border-t border-base-300 pt-2 mt-1 gap-2">
              <span className="font-black" style={PP}>
                Total Charged (incl. GST)
              </span>
              <span className="font-black text-primary" style={PP}>
                {totalCharged === 0 ? "FREE (subscription)" : fmt(totalCharged)}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-base-300 bg-base-200/50 w-full max-w-xs">
        <img
          src="https://ik.imagekit.io/4wja0s7p9/%20favicon.ico"
          alt="Likeson"
          className="w-5 h-5 rounded object-contain flex-shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="min-w-0">
          <p
            className="text-[10px] font-black text-base-content/60 truncate"
            style={PP}
          >
            Likeson Healthcare · Vijayawada
          </p>
          <p className="text-[9px] text-base-content/35" style={PP}>
            support@likeson.in · +91 80080 00000
          </p>
        </div>
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        {bookingId && (
          <button
            onClick={() => router.push(`/my-bookings/${bookingId}`)}
            className="flex-1 py-3 rounded-xl font-black text-xs text-primary-content bg-primary hover:opacity-90 transition-opacity min-h-[44px]"
            style={PP}
          >
            View Booking
          </button>
        )}
        <button
          onClick={onReset}
          className={`${bookingId ? "flex-1" : "w-full"} py-3 rounded-xl font-black text-xs border-2 border-base-300 hover:border-primary hover:text-primary transition-colors min-h-[44px]`}
          style={PP}
        >
          New Booking
        </button>
      </div>
    </motion.div>
  );
}
