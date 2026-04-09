"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Accessibility, Wind, Heart, Stethoscope, Zap, CheckCircle2,
  Loader2, AlertTriangle, Save, Info, RefreshCw, Sparkles
} from "lucide-react";
import {
  fetchVehicle, updateVehicleFeatures,
  selectVehicle, selectLoading, selectError
} from "@/store/slices/soloDriverSlice";

// ── animation helpers ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

// ── Feature toggle card ───────────────────────────────────────────────────────
function FeatureCard({ id, label, description, icon: Icon, color, value, onChange, surcharge }) {
  const colorMap = {
    primary:  { ring: "ring-primary/20",  bg: "bg-primary/10",  border: "border-primary/25",  text: "text-primary",  glow: "shadow-primary/20"  },
    success:  { ring: "ring-success/20",  bg: "bg-success/10",  border: "border-success/25",  text: "text-success",  glow: "shadow-success/20"  },
    info:     { ring: "ring-info/20",     bg: "bg-info/10",     border: "border-info/25",     text: "text-info",     glow: "shadow-info/20"     },
    warning:  { ring: "ring-warning/20",  bg: "bg-warning/10",  border: "border-warning/25",  text: "text-warning",  glow: "shadow-warning/20"  },
    error:    { ring: "ring-error/20",    bg: "bg-error/10",    border: "border-error/25",    text: "text-error",    glow: "shadow-error/20"    },
    secondary:{ ring: "ring-secondary/20",bg: "bg-secondary/10",border: "border-secondary/25",text: "text-secondary",glow: "shadow-secondary/20"},
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <motion.div
      variants={fadeUp}
      layout
      onClick={() => onChange(id, !value)}
      className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-300 select-none
        ${value
          ? `${c.border} ${c.bg} shadow-md ${c.glow} ring-2 ${c.ring}`
          : "border-base-300 bg-base-100 shadow-sm hover:border-base-content/20 hover:shadow-md"
        }`}
    >
      {/* Active checkmark */}
      <AnimatePresence>
        {value && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`absolute top-3 right-3 w-5 h-5 rounded-full ${c.bg} border ${c.border} flex items-center justify-center`}
          >
            <CheckCircle2 className={`w-3 h-3 ${c.text}`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon */}
      <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center transition-all duration-300
        ${value ? `${c.bg} border ${c.border}` : "bg-base-200 border border-base-300"}`}>
        <Icon className={`w-6 h-6 transition-colors duration-300 ${value ? c.text : "text-base-content/30"}`} />
      </div>

      {/* Label */}
      <h3 className={`text-sm font-bold transition-colors duration-300 ${value ? "text-base-content" : "text-base-content/60"}`}>
        {label}
      </h3>
      <p className={`text-xs mt-1 leading-relaxed transition-colors duration-300 ${value ? "text-base-content/60" : "text-base-content/35"}`}>
        {description}
      </p>

      {/* Surcharge badge */}
      {surcharge && value && (
        <motion.div
          initial={{ opacity:0, y:4 }}
          animate={{ opacity:1, y:0 }}
          className={`mt-3 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border} font-semibold`}
        >
          <Zap className="w-2.5 h-2.5" />
          {surcharge}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FeaturesExtras() {
  const dispatch = useDispatch();
  const vehicle  = useSelector(selectVehicle);
  const updating = useSelector(selectLoading("updateVehicleFeatures"));
  const error    = useSelector(selectError("updateVehicleFeatures"));

  const [features, setFeatures] = useState({
    isWheelchairAccessible: false,
    hasStretcherSupport:    false,
    hasOxygenSupport:       false,
    hasMedicalKit:          false,
    hasAC:                  true,
  });
  const [saved, setSaved] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => { dispatch(fetchVehicle()); }, [dispatch]);

  useEffect(() => {
    if (vehicle) {
      setFeatures({
        isWheelchairAccessible: vehicle.isWheelchairAccessible ?? false,
        hasStretcherSupport:    vehicle.hasStretcherSupport    ?? false,
        hasOxygenSupport:       vehicle.hasOxygenSupport       ?? false,
        hasMedicalKit:          vehicle.hasMedicalKit          ?? false,
        hasAC:                  vehicle.hasAC                  ?? true,
      });
    }
  }, [vehicle]);

  const handleChange = (key, val) => {
    setFeatures(p => ({ ...p, [key]: val }));
    setSaved(false);
    setChanged(true);
  };

  const handleSave = async () => {
    setSaved(false);
    const result = await dispatch(updateVehicleFeatures(features));
    if (!result.error) { setSaved(true); setChanged(false); }
  };

  const featureConfig = [
    {
      id:          "hasAC",
      label:       "Air Conditioning",
      description: "Climate-controlled cabin for comfortable rides in all weather.",
      icon:        Wind,
      color:       "info",
      surcharge:   null,
    },
    {
      id:          "isWheelchairAccessible",
      label:       "Wheelchair Accessible",
      description: "Vehicle has ramp/lift and secure wheelchair tie-downs.",
      icon:        Accessibility,
      color:       "primary",
      surcharge:   "+₹100 surcharge",
    },
    {
      id:          "hasStretcherSupport",
      label:       "Stretcher Support",
      description: "Can accommodate a stretcher for non-emergency medical transport.",
      icon:        Heart,
      color:       "error",
      surcharge:   "+₹150 surcharge",
    },
    {
      id:          "hasOxygenSupport",
      label:       "Oxygen Support",
      description: "Equipped with medical-grade oxygen cylinder and delivery system.",
      icon:        Sparkles,
      color:       "secondary",
      surcharge:   "+₹200 surcharge",
    },
    {
      id:          "hasMedicalKit",
      label:       "First Aid / Medical Kit",
      description: "Certified first-aid kit with essential emergency supplies onboard.",
      icon:        Stethoscope,
      color:       "success",
      surcharge:   null,
    },
  ];

  const enabledCount = Object.values(features).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp}
        className="rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden"
      >
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black text-base-content font-[family-name:var(--font-family-montserrat)]">
                Features & Extras
              </h2>
              <p className="text-xs text-base-content/50">
                {enabledCount} of {featureConfig.length} features enabled · Click to toggle
              </p>
            </div>
          </div>

          {/* Save */}
          <AnimatePresence>
            {changed && (
              <motion.button
                initial={{ opacity:0, scale:0.9 }}
                animate={{ opacity:1, scale:1 }}
                exit={{ opacity:0, scale:0.9 }}
                onClick={handleSave}
                disabled={updating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-content
                           text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {updating ? "Saving…" : "Save Changes"}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            className="flex items-center gap-2 p-3.5 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-semibold"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
          </motion.div>
        )}
        {saved && (
          <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            className="flex items-center gap-2 p-3.5 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-semibold"
          >
            <CheckCircle2 className="w-4 h-4" />Features updated successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info note */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1, transition:{delay:0.2} }}
        className="flex items-start gap-2.5 p-3.5 rounded-xl bg-info/10 border border-info/20"
      >
        <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
        <p className="text-xs text-info leading-relaxed">
          Features with surcharges will be added to your ride fare automatically. Customers can filter by these features when booking.
        </p>
      </motion.div>

      {/* Feature grid */}
      <motion.div initial="hidden" animate="visible" variants={stagger}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {featureConfig.map(f => (
          <FeatureCard key={f.id} {...f} value={features[f.id]} onChange={handleChange} />
        ))}
      </motion.div>

      {/* Summary bar */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1, transition:{ delay:0.5 } }}
        className="rounded-2xl border border-base-300 bg-base-100 shadow-sm p-4"
      >
        <h4 className="text-xs font-bold text-base-content/60 uppercase tracking-wider mb-3">Enabled Features Summary</h4>
        <div className="flex flex-wrap gap-2">
          {featureConfig.filter(f => features[f.id]).map(f => {
            const colorMap = {
              primary:"bg-primary/10 text-primary border-primary/25",
              success:"bg-success/10 text-success border-success/25",
              info:"bg-info/10 text-info border-info/25",
              warning:"bg-warning/10 text-warning border-warning/25",
              error:"bg-error/10 text-error border-error/25",
              secondary:"bg-secondary/10 text-secondary border-secondary/25",
            };
            return (
              <motion.span key={f.id}
                initial={{ scale:0 }} animate={{ scale:1 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colorMap[f.color] || colorMap.primary}`}
              >
                <f.icon className="w-3 h-3" />{f.label}
              </motion.span>
            );
          })}
          {enabledCount === 0 && (
            <span className="text-xs text-base-content/40 italic">No features enabled yet</span>
          )}
        </div>
      </motion.div>
    </div>
  );
}