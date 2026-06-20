"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PP } from "@/lib/constants";

export function StepBar({ steps, currentId, visitedIds, onStepClick }) {
  const [hoveredId, setHoveredId] = useState(null);
  return (
    <div className="w-full overflow-x-auto" style={{ overflowY: "visible" }}>
      <div
        className="flex items-end justify-center gap-0 px-2 pb-2"
        style={{
          paddingTop: "3rem",
          minWidth: "max-content",
          position: "relative",
        }}
      >
        {steps.map((s, i) => {
          const Icon = s.icon;
          const done = visitedIds.includes(s.id) && s.id !== currentId;
          const active = s.id === currentId;
          const ok = visitedIds.includes(s.id) || active;
          const canClick = visitedIds.includes(s.id) && s.id !== currentId;
          const isHov = hoveredId === s.id;
          return (
            <div key={s.id} className="flex items-center flex-shrink-0">
              <div
                className="relative flex flex-col items-center gap-0.5"
                style={{ minWidth: "44px" }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => canClick && onStepClick?.(s.id)}
              >
                {isHov && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none flex flex-col items-center">
                    <div
                      className={`px-2 py-1 rounded-lg text-[10px] font-black text-center whitespace-nowrap shadow-lg ${active ? "bg-primary text-primary-content" : done ? "bg-success text-success-content" : "bg-base-300 text-base-content"}`}
                      style={PP}
                    >
                      {s.label}
                      {canClick && <span className="ml-1 opacity-70">↩</span>}
                    </div>
                    <div
                      className={`w-2 h-2 rotate-45 -mt-1 ${active ? "bg-primary" : done ? "bg-success" : "bg-base-300"}`}
                    />
                  </div>
                )}
                <motion.div
                  animate={{ scale: active ? 1.12 : 1 }}
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-300 cursor-${canClick ? "pointer" : "default"} ${done ? "bg-success text-success-content" : active ? "bg-primary text-primary-content" : "bg-base-300 text-base-content"} ${ok ? "opacity-100" : "opacity-30"} ${isHov && canClick ? "ring-2 ring-primary/30" : ""}`}
                >
                  {done ? (
                    <Check size={9} strokeWidth={3} />
                  ) : (
                    <Icon size={9} />
                  )}
                </motion.div>
                <span
                  className={`hidden sm:block text-[7px] font-black uppercase tracking-wider text-center leading-tight ${ok ? "opacity-100" : "opacity-30"} ${active ? "text-primary" : canClick ? "text-primary" : "text-base-content"}`}
                  style={{
                    maxWidth: "44px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    ...PP,
                  }}
                >
                  {s.label}
                </span>
                <span
                  className={`block sm:hidden w-1 h-1 rounded-full mt-0.5 ${active ? "bg-primary" : ok ? "bg-success" : "bg-base-300"}`}
                />
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-3 h-px mx-0.5 flex-shrink-0 transition-all duration-500 ${done ? "bg-success opacity-100" : "bg-base-300 opacity-30"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
