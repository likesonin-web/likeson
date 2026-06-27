'use client';

export default function DateDivider({ label }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full bg-base-200 text-base-content/50">
        {label}
      </span>
    </div>
  );
}
