"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Phone, Check, CheckCircle2 } from "lucide-react";
import { PP, BOOKING_TYPES } from "@/lib/constants";
import { ServiceTooltip, ServiceEducation } from "./ServiceTooltip";

export function StepType({ form, set, onSelectBookingType }) {
  const selected = BOOKING_TYPES.find((b) => b.value === form.bookingType);
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          What service do you need?
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Select care type. Each service for{" "}
          <strong>non-emergency situations only.</strong>
        </p>
      </div>
      <div className="flex items-center gap-2 p-2.5 rounded-xl border border-warning/25 bg-warning/5">
        <Phone size={12} className="text-warning flex-shrink-0" />
        <p className="text-[10px] font-bold text-base-content/70" style={PP}>
          Life-threatening emergencies — call <strong>108</strong> immediately.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BOOKING_TYPES.map((bt) => {
          const Icon = bt.icon;
          const active = form.bookingType === bt.value;
          return (
            <motion.button
              key={bt.value}
              type="button"
              whileTap={{ scale: 0.975 }}
              onClick={() => onSelectBookingType(bt.value)}
              className="relative flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all w-full"
              style={{
                borderColor: active ? bt.color : "var(--base-300)",
                background: active ? bt.bg : "var(--base-100)",
                boxShadow: active ? `0 4px 14px ${bt.color}22` : "none",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: active ? bt.bg : "var(--base-200)",
                  color: bt.color,
                }}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0 pr-7">
                <p
                  className="font-black text-xs leading-tight"
                  style={{ color: active ? bt.color : "inherit", ...PP }}
                >
                  {bt.label}
                </p>
                <p
                  className="text-[10px] text-base-content/40 mt-0.5 leading-snug line-clamp-2"
                  style={PP}
                >
                  {bt.desc}
                </p>
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {active && (
                  <div
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    style={{ background: bt.color }}
                  >
                    <Check size={8} className="text-white" strokeWidth={3} />
                  </div>
                )}
                <ServiceTooltip tooltip={bt.tooltip} />
              </div>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {selected && <ServiceEducation key={selected.value} bt={selected} />}
      </AnimatePresence>
      {form.bookingType && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5"
        >
          <CheckCircle2 size={13} className="text-primary flex-shrink-0" />
          <p className="text-xs font-bold text-primary" style={PP}>
            {selected?.label} selected. Press Continue.
          </p>
        </motion.div>
      )}
    </div>
  );
}
