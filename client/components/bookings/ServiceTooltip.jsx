"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { PP } from "@/lib/constants";

export function ServiceTooltip({ tooltip }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <div
        role="button"
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            setOpen((o) => !o);
          }
        }}
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer bg-warning/15 text-warning"
        aria-label="Important notice"
      >
        <AlertTriangle size={9} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-xl border border-warning/30 shadow-lg bg-base-100"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={11}
                className="text-warning flex-shrink-0 mt-0.5"
              />
              <p
                className="text-[10px] font-semibold leading-relaxed text-base-content/70"
                style={PP}
              >
                {tooltip}
              </p>
            </div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b border-warning/30 bg-base-100" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ServiceEducation({ bt }) {
  if (!bt) return null;
  const Icon = bt.icon;
  return (
    <motion.div
      key={bt.value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22 }}
      className="rounded-2xl border"
      style={{ borderColor: `${bt.color}30`, background: bt.bg }}
    >
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 border-b"
        style={{ borderColor: `${bt.color}20` }}
      >
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${bt.color}20`, color: bt.color }}
        >
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <p
            className="font-black text-xs truncate"
            style={{ color: bt.color, ...PP }}
          >
            {bt.label}
          </p>
          <p className="text-[9px] text-base-content/40" style={PP}>
            How this service works
          </p>
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        {bt.educationNotes.map((note, i) => (
          <div key={i} className="flex items-start gap-2">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${bt.color}20`, color: bt.color }}
            >
              <span className="text-[8px] font-black">{i + 1}</span>
            </div>
            <p
              className="text-[11px] font-medium text-base-content/65 leading-snug"
              style={PP}
            >
              {note}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-3 mb-3 flex items-start gap-2 p-2 rounded-xl border border-warning/20 bg-warning/5">
        <AlertTriangle
          size={10}
          className="text-warning flex-shrink-0 mt-0.5"
        />
        <p
          className="text-[10px] font-semibold leading-snug text-base-content/70"
          style={PP}
        >
          {bt.tooltip}
        </p>
      </div>
    </motion.div>
  );
}
