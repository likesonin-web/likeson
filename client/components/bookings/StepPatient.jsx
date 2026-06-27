"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { User, Clock, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Field, Inp, Sel, SCard } from "./atoms";
import { PP, GENDER_OPTIONS, BLOOD_GROUPS } from "@/lib/constants";
import {
  fetchPreviousPatientInfo,
  selectPreviousPatientInfo,
  selectPreviousPatientInfoLoading,
} from "@/store/slices/bookingSlice";

export function StepPatient({ form, set, errors }) {
  const dispatch = useDispatch();
  const prevInfo = useSelector(selectPreviousPatientInfo);
  const prevLoading = useSelector(selectPreviousPatientInfoLoading);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    dispatch(fetchPreviousPatientInfo());
  }, [dispatch]);

  // Reset dismiss when booking type changes (new booking flow)
  useEffect(() => {
    setBannerDismissed(false);
  }, [form.bookingType]);

  const prefillFromPrev = () => {
    if (!prevInfo?.patientInfo) return;
    const p = prevInfo.patientInfo;
    set("patientName", p.name || "");
    set("patientAge", p.age || "");
    set("patientGender", p.gender || "");
    set("patientPhone", p.phone || "");
    set("patientBloodGroup", p.bloodGroup || "");
    set("patientWeight", p.weight || "");
    set("patientIsSelf", p.isSelf ?? true);
    setBannerDismissed(true);
  };

  const showBanner =
    !bannerDismissed &&
    !prevLoading &&
    prevInfo?.patientInfo &&
    // Only show if form is empty (no name yet)
    !form.patientName;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Patient Information
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Details captured at booking — accurate even if your profile updates
          later.
        </p>
      </div>

      {/* ── Previous patient banner ─────────────────────────────────────── */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            key="prev-patient-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-primary/25 bg-primary/5"
          >
            <Clock size={13} className="text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-primary leading-tight" style={PP}>
                Use previous patient?
              </p>
              <p className="text-[10px] text-primary/60 font-semibold truncate" style={PP}>
                {prevInfo.patientInfo.name}
                {prevInfo.patientInfo.age ? `, ${prevInfo.patientInfo.age} yrs` : ""}
                {prevInfo.patientInfo.gender ? ` · ${prevInfo.patientInfo.gender}` : ""}
                {prevInfo.patientInfo.phone ? ` · ${prevInfo.patientInfo.phone}` : ""}
              </p>
              {prevInfo.fromBooking && (
                <p className="text-[9px] text-primary/40 font-semibold mt-0.5" style={PP}>
                  From booking #{prevInfo.fromBooking}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={prefillFromPrev}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-content font-black text-[10px] flex-shrink-0 hover:opacity-90 transition-opacity"
              style={PP}
            >
              Use
              <ChevronRight size={10} />
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="p-1 rounded-lg text-primary/50 hover:text-primary transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {[
          { v: true, l: "For myself" },
          { v: false, l: "For someone else" },
        ].map(({ v, l }) => {
          const on = form.patientIsSelf === v;
          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => set("patientIsSelf", v)}
              className={`flex-1 py-2.5 rounded-xl border-2 font-bold text-xs transition-all ${on ? "border-primary bg-primary/5 text-primary" : "border-base-300 bg-base-200 text-base-content"}`}
              style={PP}
            >
              {l}
            </button>
          );
        })}
      </div>

      <SCard title="Patient Details" icon={User} accent="var(--primary)">
        <div className="space-y-3">
          <Field
            label="Full Name"
            required
            note="As on government ID"
            error={errors.patientName}
          >
            <Inp
              placeholder="e.g. Ravi Kumar Reddy"
              value={form.patientName || ""}
              onChange={(e) => set("patientName", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Age (years)" error={errors.patientAge}>
              <Inp
                type="number"
                min="0"
                max="150"
                placeholder="34"
                value={form.patientAge || ""}
                onChange={(e) => set("patientAge", Number(e.target.value))}
              />
            </Field>
            <Field label="Gender">
              <Sel
                value={form.patientGender || ""}
                onChange={(e) => set("patientGender", e.target.value)}
              >
                <option value="">— Select —</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Sel>
            </Field>
          </div>
          <Field
            label="Mobile Number"
            note="Confirmation SMS here"
            error={errors.patientPhone}
          >
            <Inp
              type="tel"
              placeholder="+91 98765 43210"
              value={form.patientPhone || ""}
              onChange={(e) => set("patientPhone", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Blood Group">
              <Sel
                value={form.patientBloodGroup || ""}
                onChange={(e) => set("patientBloodGroup", e.target.value)}
              >
                <option value="">— Select —</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Sel>
            </Field>
            <Field label="Weight (kg)">
              <Inp
                type="number"
                min="0"
                placeholder="68"
                value={form.patientWeight || ""}
                onChange={(e) => set("patientWeight", Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Emergency Contact (optional)" note="Alternative number">
            <Inp
              type="tel"
              placeholder="+91 77777 88888"
              value={form.emergencyContact || ""}
              onChange={(e) => set("emergencyContact", e.target.value)}
            />
          </Field>
        </div>
      </SCard>
    </div>
  );
}