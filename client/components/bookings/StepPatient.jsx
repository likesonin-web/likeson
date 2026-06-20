"use client";

import { User } from "lucide-react";
import { Field, Inp, Sel, SCard } from "./atoms";
import { PP, GENDER_OPTIONS, BLOOD_GROUPS } from "@/lib/constants";

export function StepPatient({ form, set, errors }) {
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
