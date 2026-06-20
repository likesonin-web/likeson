"use client";

import dynamic from "next/dynamic";
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2, TrendingUp, Eye, MousePointerClick,
  Plus, Search, RefreshCw, Archive,
  Edit3, CheckCircle, XCircle, PauseCircle,
  Upload, Link2, X, ChevronDown, ChevronUp,
  DollarSign, Target, Clock, Smartphone,
  AlertTriangle, Info, MoreVertical,
  Image as ImageIcon, Video, Layers, Activity,
  ArrowUpRight, ArrowDownRight, Calendar,
} from "lucide-react";

import {
  fetchAllAds,
  createAd,
  updateAd,
  archiveAd,
  getAdAnalytics,
} from "@/store/slices/adsSlice";
import {
  uploadSingleFile,
  resetUploadState,
} from "@/store/slices/uploadSlice";

// Lazy-load heavy recharts panel — shows skeleton while loading
const RechartsPanel = dynamic(() => import("./RechartsPanel"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PAGES = ["Global", "Search_Results", "Medicine_Store", "Ride_Tracking_Screen"];
const SLOTS = ["Popup", "Native_Feed", "Sticky_Bottom", "Hero_Banner"];
const MEDIA_TYPES = ["Image", "Video", "Gif"];
const PRICING_MODELS = ["CPC", "CPM", "CPA", "Fixed_Weekly"];
const DEVICE_TYPES = ["iOS", "Android", "Web"];
const STATUSES = ["Active", "Paused", "Archived", "Depleted", "Draft"];
const AD_TYPES = ["Internal", "External_Partner"];

const STATUS_CONFIG = {
  Active:   { color: "text-success",         bg: "bg-success/10",    border: "border-success/40",  icon: CheckCircle },
  Paused:   { color: "text-warning",         bg: "bg-warning/10",    border: "border-warning/40",  icon: PauseCircle },
  Archived: { color: "text-base-content/40", bg: "bg-base-300/60",   border: "border-base-300",    icon: Archive },
  Depleted: { color: "text-error",           bg: "bg-error/10",      border: "border-error/40",    icon: XCircle },
  Draft:    { color: "text-info",            bg: "bg-info/10",       border: "border-info/30",     icon: Info },
};

const EMPTY_FORM = {
  advertiser: {
    name: "",
    type: "External_Partner",
    campaignId: "",
  },
  adContent: {
    headline: "",
    subHeadline: "",
    mediaUrl: "",
    mediaType: "Image",
    ctaText: "Learn More",
    landingPageUrl: "",
  },
  placement: {
    page: "Global",
    slot: "Native_Feed",
    priority: 5,
  },
  targeting: {
    deviceType: ["Web"],
    userSegments: "",
    location: {
      type: "Point",
      coordinates: [0, 0],
    },
    radiusInKm: 5,
  },
  schedule: {
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    displayHours: [],
    frequencyCap: {
      limit: 3,
      windowHours: 24,
    },
  },
  pricingModel: "CPC",
  budget: {
    totalMax: 10000,
    dailyMax: 500,
    currentSpend: 0,
  },
  status: "Active",
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADERS
// ─────────────────────────────────────────────────────────────────────────────

const StatSkeleton = memo(() => (
  <div className="stat-card animate-pulse">
    <div className="skeleton h-3 w-24 mb-3 rounded" />
    <div className="skeleton h-8 w-32 mb-2 rounded" />
    <div className="skeleton h-3 w-16 rounded" />
  </div>
));
StatSkeleton.displayName = "StatSkeleton";

const TableRowSkeleton = memo(() => (
  <tr>
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="skeleton h-4 rounded" style={{ width: `${60 + i * 8}%` }} />
      </td>
    ))}
  </tr>
));
TableRowSkeleton.displayName = "TableRowSkeleton";

const ChartSkeleton = memo(() => (
  <div className="animate-pulse h-64 bg-base-200 rounded-box flex items-end gap-2 p-4">
    {Array.from({ length: 7 }).map((_, i) => (
      <div key={i} className="flex-1 skeleton rounded-t" style={{ height: `${30 + i * 10}%` }} />
    ))}
  </div>
));
ChartSkeleton.displayName = "ChartSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = memo(({ icon: Icon, label, value, sub, trend, color = "text-primary" }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="stat-card group"
  >
    <div className="flex items-start justify-between mb-3">
      <span className="stat-card-label">{label}</span>
      <div className={`p-2 rounded-field bg-primary/10 ${color}`}>
        <Icon size={16} />
      </div>
    </div>
    <div className="stat-card-value">{value}</div>
    {sub && (
      <div className="flex items-center gap-1 mt-2">
        {trend === "up"   && <ArrowUpRight   size={12} className="text-success" />}
        {trend === "down" && <ArrowDownRight  size={12} className="text-error"   />}
        <span className="text-xs text-base-content/50">{sub}</span>
      </div>
    )}
  </motion.div>
));
StatCard.displayName = "StatCard";

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = memo(({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Draft;
  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border} gap-1`}>
      <Icon size={10} />
      {status}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA UPLOAD FIELD
// ─────────────────────────────────────────────────────────────────────────────

const MediaUploadField = memo(({ value, onChange, mediaType }) => {
  const dispatch = useDispatch();
  const { isUploading, lastUploadedUrl } = useSelector((s) => s.upload);
  const [mode, setMode] = useState("url"); 
  const fileRef = useRef(null);

  useEffect(() => {
    if (lastUploadedUrl) {
      onChange(lastUploadedUrl);
      dispatch(resetUploadState());
    }
  }, [lastUploadedUrl, onChange, dispatch]);

  const handleFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await dispatch(uploadSingleFile({ file, folder: "ads" }));
    },
    [dispatch]
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-1 bg-base-200 rounded-field w-fit">
        {["url", "upload"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              mode === m
                ? "bg-base-100 text-primary shadow-sm"
                : "text-base-content/50 hover:text-base-content"
            }`}
          >
            {m === "url" ? <Link2 size={12} /> : <Upload size={12} />}
            {m === "url" ? "Paste URL" : "Upload File"}
          </button>
        ))}
      </div>

      {mode === "url" ? (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/media.jpg"
          className="input-field w-full"
        />
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-base-300 hover:border-primary rounded-field p-6 text-center cursor-pointer transition-colors group"
          role="button"
          aria-label="Upload media file"
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={
              mediaType === "Video" ? "video/*"
              : mediaType === "Gif" ? "image/gif"
              : "image/*"
            }
            onChange={handleFile}
          />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2 text-primary">
              <div className="loading loading-spinner loading-sm" />
              <span className="text-sm font-medium">Uploading…</span>
            </div>
          ) : (
            <>
              <Upload size={24} className="mx-auto mb-2 text-base-content/30 group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium text-base-content/60">
                Click to upload {mediaType}
              </p>
              <p className="text-xs text-base-content/40 mt-1">
                {mediaType === "Video" ? "MP4, WebM up to 50 MB" : "PNG, JPG, WebP up to 10 MB"}
              </p>
            </>
          )}
        </div>
      )}

      {value && mode === "url" && (
        <div className="relative w-full h-28 rounded-field overflow-hidden bg-base-200 border border-base-300">
          {mediaType === "Video" ? (
            <video src={value} className="w-full h-full object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="preview" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-2">
            <span className="text-white text-xs font-bold uppercase">{mediaType}</span>
          </div>
        </div>
      )}
    </div>
  );
});
MediaUploadField.displayName = "MediaUploadField";

// ─────────────────────────────────────────────────────────────────────────────
// HOURS SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

const HoursSelector = memo(({ selected, onChange }) => {
  const toggle = useCallback(
    (h) => {
      const next = selected.includes(h)
        ? selected.filter((x) => x !== h)
        : [...selected, h];
      onChange(next.sort((a, b) => a - b));
    },
    [selected, onChange]
  );

  const allSelected = selected.length === 24;

  const toggleAll = useCallback(() => {
    onChange(allSelected ? [] : Array.from({ length: 24 }, (_, i) => i));
  }, [allSelected, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-base-content/50">
          {selected.length === 0
            ? "All hours — no restriction"
            : `${selected.length} hour${selected.length !== 1 ? "s" : ""} selected (UTC)`}
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-primary font-semibold hover:underline"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {Array.from({ length: 24 }, (_, h) => (
          <button
            key={h}
            type="button"
            onClick={() => toggle(h)}
            title={`${h}:00 – ${h}:59 UTC`}
            className={`text-[10px] py-1 rounded font-bold transition-all ${
              selected.includes(h)
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content/50 hover:bg-base-300"
            }`}
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  );
});
HoursSelector.displayName = "HoursSelector";

// ─────────────────────────────────────────────────────────────────────────────
// FIELD GROUP HELPER
// ─────────────────────────────────────────────────────────────────────────────

const FieldGroup = memo(({ label, note, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline gap-2">
      <label className="label-text font-semibold">{label}</label>
      {note && <span className="text-[11px] text-base-content/40">{note}</span>}
    </div>
    {children}
  </div>
));
FieldGroup.displayName = "FieldGroup";

const SelectField = memo(({ value, onChange, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-field w-full appearance-none pr-8"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
    <ChevronDown
      size={14}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
    />
  </div>
));
SelectField.displayName = "SelectField";

// ─────────────────────────────────────────────────────────────────────────────
// AD FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const AdFormModal = memo(({ editAd, onClose }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.ads);

  const [form, setForm] = useState(() => {
    if (!editAd) return EMPTY_FORM;
    return {
      ...EMPTY_FORM,
      ...editAd,
      advertiser: { ...EMPTY_FORM.advertiser, ...editAd.advertiser },
      adContent:  { ...EMPTY_FORM.adContent,  ...editAd.adContent  },
      placement:  { ...EMPTY_FORM.placement,  ...editAd.placement  },
      targeting: {
        ...EMPTY_FORM.targeting,
        ...editAd.targeting,
        userSegments: editAd.targeting?.userSegments?.join(", ") ?? "",
        location: { ...EMPTY_FORM.targeting.location, ...editAd.targeting?.location },
      },
      schedule: {
        ...EMPTY_FORM.schedule,
        ...editAd.schedule,
        startDate: editAd.schedule?.startDate?.split("T")[0] ?? EMPTY_FORM.schedule.startDate,
        endDate:   editAd.schedule?.endDate?.split("T")[0]   ?? "",
        frequencyCap: { ...EMPTY_FORM.schedule.frequencyCap, ...editAd.schedule?.frequencyCap },
      },
      budget: { ...EMPTY_FORM.budget, ...editAd.budget },
    };
  });

  const [section, setSection] = useState("content");

  const setField = useCallback((path, val) => {
    setForm((prev) => {
      const keys = path.split(".");
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = val;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();

      const payload = {
        ...form,
        targeting: {
          ...form.targeting,
          userSegments: form.targeting.userSegments
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        advertiser: {
          ...form.advertiser,
          ...(form.advertiser.campaignId ? {} : { campaignId: undefined }),
        },
      };

      if (editAd) {
        await dispatch(updateAd({ id: editAd._id, adData: payload }));
      } else {
        const { budget: { currentSpend: _, ...budgetRest }, ...rest } = payload;
        await dispatch(createAd({ ...rest, budget: budgetRest }));
      }
      onClose();
    },
    [dispatch, editAd, form, onClose]
  );

  const TABS = [
    { id: "content",   label: "Ad Content",  icon: ImageIcon },
    { id: "placement", label: "Placement",   icon: Layers    },
    { id: "targeting", label: "Targeting",   icon: Target    },
    { id: "schedule",  label: "Schedule",    icon: Calendar  },
    { id: "budget",    label: "Budget",      icon: DollarSign },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="w-full max-w-3xl max-h-[90vh] bg-base-100 rounded-box border border-base-300 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 shrink-0">
            <div>
              <h2 className="text-xl font-poppins tracking-tight">
                {editAd ? "Edit Advertisement" : "New Advertisement"}
              </h2>
              <p className="text-xs text-base-content/50 mt-0.5">
                {editAd
                  ? `Editing "${editAd.adContent?.headline}"`
                  : "Create a new ad campaign — fill all tabs before launching"}
              </p>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-3 pb-0 shrink-0 overflow-x-auto scrollbar-thin">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-t transition-all whitespace-nowrap ${
                  section === id
                    ? "bg-primary text-primary-content"
                    : "text-base-content/50 hover:text-base-content hover:bg-base-200"
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* CONTENT */}
            {section === "content" && (
              <div className="space-y-4">
                <FieldGroup label="Advertiser Name" note="Brand or company running this ad">
                  <input
                    className="input-field w-full"
                    value={form.advertiser.name}
                    onChange={(e) => setField("advertiser.name", e.target.value)}
                    placeholder="e.g. Practo, Apollo"
                    required
                  />
                </FieldGroup>
                <FieldGroup label="Advertiser Type" note="Internal vs External Partner">
                  <SelectField
                    value={form.advertiser.type}
                    onChange={(v) => setField("advertiser.type", v)}
                    options={AD_TYPES}
                  />
                </FieldGroup>
                <FieldGroup label="Headline" note="Primary ad copy — max 80 chars">
                  <input
                    className="input-field w-full"
                    value={form.adContent.headline}
                    onChange={(e) => setField("adContent.headline", e.target.value)}
                    placeholder="Consult a Doctor in 60 Seconds"
                    maxLength={80}
                    required
                  />
                </FieldGroup>
                <FieldGroup label="Sub Headline" note="Supporting copy shown below the headline">
                  <textarea
                    className="input-field w-full resize-none"
                    rows={2}
                    value={form.adContent.subHeadline}
                    onChange={(e) => setField("adContent.subHeadline", e.target.value)}
                    placeholder="Talk to verified specialist doctors online 24/7."
                  />
                </FieldGroup>
                <FieldGroup label="CTA Button Text" note="Call-to-action label">
                  <input
                    className="input-field w-full"
                    value={form.adContent.ctaText}
                    onChange={(e) => setField("adContent.ctaText", e.target.value)}
                    placeholder="Learn More"
                  />
                </FieldGroup>
                <FieldGroup label="Landing Page URL" note="Destination URL starting with https://">
                  <input
                    type="url"
                    className="input-field w-full"
                    value={form.adContent.landingPageUrl}
                    onChange={(e) => setField("adContent.landingPageUrl", e.target.value)}
                    placeholder="https://example.com/campaign"
                    required
                  />
                </FieldGroup>
                <FieldGroup label="Media Type" note="Format of the creative asset">
                  <div className="flex gap-2">
                    {MEDIA_TYPES.map((t) => {
                      const Icon = t === "Video" ? Video : ImageIcon;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setField("adContent.mediaType", t)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-field text-xs font-bold border transition-all ${
                            form.adContent.mediaType === t
                              ? "bg-primary text-primary-content border-primary"
                              : "border-base-300 text-base-content/60 hover:border-primary"
                          }`}
                        >
                          <Icon size={12} /> {t}
                        </button>
                      );
                    })}
                  </div>
                </FieldGroup>
                <FieldGroup label="Creative Media" note="Upload or paste URL">
                  <MediaUploadField
                    value={form.adContent.mediaUrl}
                    onChange={(v) => setField("adContent.mediaUrl", v)}
                    mediaType={form.adContent.mediaType}
                  />
                </FieldGroup>
              </div>
            )}

            {/* PLACEMENT */}
            {section === "placement" && (
              <div className="space-y-4">
                <FieldGroup label="App Page" note="Screen in the app to display ad">
                  <SelectField
                    value={form.placement.page}
                    onChange={(v) => setField("placement.page", v)}
                    options={PAGES}
                  />
                </FieldGroup>
                <FieldGroup label="Ad Slot" note="Specific UI position">
                  <SelectField
                    value={form.placement.slot}
                    onChange={(v) => setField("placement.slot", v)}
                    options={SLOTS}
                  />
                </FieldGroup>
                <FieldGroup label="Priority" note="1 (lowest) – 10 (highest)">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={form.placement.priority}
                      onChange={(e) => setField("placement.priority", Number(e.target.value))}
                      className="flex-1 accent-[var(--primary)]"
                    />
                    <span className="stat-card-value text-2xl w-8 text-center">
                      {form.placement.priority}
                    </span>
                  </div>
                </FieldGroup>
                <FieldGroup label="Initial Status" note="Active, Draft, Paused">
                  <div className="grid grid-cols-3 gap-2">
                    {STATUSES.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setField("status", s)}
                          className={`py-2 px-3 rounded-field text-xs font-bold border transition-all ${
                            form.status === s
                              ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                              : "border-base-300 text-base-content/50 hover:border-base-300"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </FieldGroup>
              </div>
            )}

            {/* TARGETING */}
            {section === "targeting" && (
              <div className="space-y-4">
                <FieldGroup label="Device Types" note="Platforms targeting. None = all devices.">
                  <div className="flex gap-2 flex-wrap">
                    {DEVICE_TYPES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const cur = form.targeting.deviceType;
                          setField(
                            "targeting.deviceType",
                            cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
                          );
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-field text-xs font-bold border transition-all ${
                          form.targeting.deviceType.includes(d)
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "border-base-300 text-base-content/50 hover:border-primary"
                        }`}
                      >
                        <Smartphone size={10} /> {d}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
                <FieldGroup label="User Segments" note="Comma-separated tags (e.g. first_time_user)">
                  <input
                    className="input-field w-full"
                    value={form.targeting.userSegments}
                    onChange={(e) => setField("targeting.userSegments", e.target.value)}
                    placeholder="first_time_user, parent, working_professional"
                  />
                </FieldGroup>

                <div className="bg-base-200/60 rounded-field p-4 space-y-3 border border-base-300">
                  <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">
                    Geo Targeting
                  </p>
                  <p className="text-xs text-base-content/40">
                    Set coordinates + radius to filter delivery. [0, 0] means global (no restriction).
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldGroup label="Longitude" note="East/West">
                      <input
                        type="number"
                        step="any"
                        min={-180}
                        max={180}
                        className="input-field w-full"
                        value={form.targeting.location.coordinates[0]}
                        onChange={(e) =>
                          setField("targeting.location.coordinates", [
                            Number(e.target.value),
                            form.targeting.location.coordinates[1],
                          ])
                        }
                        placeholder="80.6480"
                      />
                    </FieldGroup>
                    <FieldGroup label="Latitude" note="North/South">
                      <input
                        type="number"
                        step="any"
                        min={-90}
                        max={90}
                        className="input-field w-full"
                        value={form.targeting.location.coordinates[1]}
                        onChange={(e) =>
                          setField("targeting.location.coordinates", [
                            form.targeting.location.coordinates[0],
                            Number(e.target.value),
                          ])
                        }
                        placeholder="16.5062"
                      />
                    </FieldGroup>
                  </div>
                  <FieldGroup label="Radius (km)" note="Distance around target coordinates">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      className="input-field w-full"
                      value={form.targeting.radiusInKm}
                      onChange={(e) => setField("targeting.radiusInKm", Number(e.target.value))}
                    />
                  </FieldGroup>
                  {form.targeting.location.coordinates[0] === 0 &&
                   form.targeting.location.coordinates[1] === 0 && (
                    <div className="flex items-center gap-2 text-xs text-info bg-info/10 rounded p-2">
                      <Info size={12} />
                      Coordinates are [0, 0] — serving globally.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SCHEDULE */}
            {section === "schedule" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Start Date" note="Ad live date">
                    <input
                      type="date"
                      className="input-field w-full"
                      value={form.schedule.startDate}
                      onChange={(e) => setField("schedule.startDate", e.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="End Date" note="Leave blank for open-ended">
                    <input
                      type="date"
                      className="input-field w-full"
                      value={form.schedule.endDate}
                      onChange={(e) => setField("schedule.endDate", e.target.value)}
                      min={form.schedule.startDate}
                    />
                  </FieldGroup>
                </div>
                <FieldGroup label="Display Hours (UTC)" note="Restrict serving hours">
                  <HoursSelector
                    selected={form.schedule.displayHours}
                    onChange={(v) => setField("schedule.displayHours", v)}
                  />
                </FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Frequency Cap" note="Max impressions per user">
                    <input
                      type="number"
                      min={1}
                      className="input-field w-full"
                      value={form.schedule.frequencyCap.limit}
                      onChange={(e) =>
                        setField("schedule.frequencyCap", {
                          ...form.schedule.frequencyCap,
                          limit: Number(e.target.value),
                        })
                      }
                    />
                  </FieldGroup>
                  <FieldGroup label="Frequency Window" note="Rolling window in hours">
                    <input
                      type="number"
                      min={1}
                      className="input-field w-full"
                      value={form.schedule.frequencyCap.windowHours}
                      onChange={(e) =>
                        setField("schedule.frequencyCap", {
                          ...form.schedule.frequencyCap,
                          windowHours: Number(e.target.value),
                        })
                      }
                    />
                  </FieldGroup>
                </div>
              </div>
            )}

            {/* BUDGET */}
            {section === "budget" && (
              <div className="space-y-4">
                <FieldGroup label="Pricing Model" note="Cost structure">
                  <div className="grid grid-cols-2 gap-2">
                    {PRICING_MODELS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setField("pricingModel", m)}
                        className={`py-2 px-3 rounded-field text-xs font-bold border transition-all ${
                          form.pricingModel === m
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "border-base-300 text-base-content/50 hover:border-primary"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
                <FieldGroup label="Total Max Budget (₹)" note="Campaign hard cap limit">
                  <input
                    type="number"
                    min={100}
                    className="input-field w-full"
                    value={form.budget.totalMax}
                    onChange={(e) => setField("budget.totalMax", Number(e.target.value))}
                    required
                  />
                </FieldGroup>
                <FieldGroup label="Daily Max Budget (₹)" note="Leave 0 for no daily limit">
                  <input
                    type="number"
                    min={0}
                    className="input-field w-full"
                    value={form.budget.dailyMax}
                    onChange={(e) => setField("budget.dailyMax", Number(e.target.value))}
                  />
                </FieldGroup>

                {editAd && (
                  <div className="bg-base-200 rounded-field p-4 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span>Current Spend</span>
                      <span className="text-primary">
                        ₹{(form.budget.currentSpend ?? 0).toLocaleString()}
                        {" / "}
                        ₹{(form.budget.totalMax ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(
                            100,
                            ((form.budget.currentSpend ?? 0) / (form.budget.totalMax || 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-base-content/40">
                      {(
                        ((form.budget.currentSpend ?? 0) / (form.budget.totalMax || 1)) * 100
                      ).toFixed(1)}% of budget spent
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-base-300 shrink-0">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary-cta px-8 py-2.5 flex items-center gap-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : editAd ? (
                <Edit3 size={14} />
              ) : (
                <Plus size={14} />
              )}
              {editAd ? "Save Changes" : "Launch Campaign"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
AdFormModal.displayName = "AdFormModal";

// ─────────────────────────────────────────────────────────────────────────────
// AD TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────

const AdRow = memo(({ ad, onEdit, onArchive }) => {
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);

  // BUG FIX: Secure budget evaluation against missing objects
  const spendPct = Math.min(
    100,
    ((ad.budget?.currentSpend ?? 0) / (ad.budget?.totalMax || 1)) * 100
  );
  
  // BUG FIX: Ensure strict evaluation of analytics variables
  const views = ad.analytics?.views ?? 0;
  const clicks = ad.analytics?.clicks ?? 0;
  const ctr = views > 0 ? ((clicks / views) * 100).toFixed(2) : "0.00";

  const quickStatus = useCallback(
    async (status) => {
      await dispatch(updateAd({ id: ad._id, adData: { status } }));
      setMenuOpen(false);
    },
    [dispatch, ad._id]
  );

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group hover:bg-base-200/40 transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-field overflow-hidden bg-base-200 shrink-0 border border-base-300">
            {ad.adContent?.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ad.adContent.mediaUrl}
                alt={ad.adContent?.headline}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-base-content/20">
                <ImageIcon size={16} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-base-content truncate max-w-[160px]">
              {ad.adContent?.headline}
            </p>
            <p className="text-xs text-base-content/40 truncate">{ad.advertiser?.name}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="space-y-1">
          <span className="badge badge-info badge-xs">{ad.placement?.page}</span>
          <br />
          <span className="badge badge-xs bg-base-300/60 text-base-content/60 border-base-300">
            {ad.placement?.slot}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <StatusBadge status={ad.status} />
      </td>

      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs">
            <Eye size={10} className="text-base-content/40" />
            <span className="font-bold">{views.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <MousePointerClick size={10} className="text-base-content/40" />
            <span className="font-bold">{clicks.toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-primary font-bold">CTR {ctr}%</div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="space-y-1 min-w-[100px]">
          <div className="flex justify-between text-[10px] font-bold">
            <span>₹{(ad.budget?.currentSpend ?? 0).toLocaleString()}</span>
            <span className="text-base-content/40">
              / ₹{(ad.budget?.totalMax ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="progress-bar" style={{ height: "4px" }}>
            <div className="progress-bar-fill" style={{ width: `${spendPct}%` }} />
          </div>
          <div className="text-[10px] text-base-content/40">{spendPct.toFixed(0)}% used</div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="badge badge-xs bg-accent/5 text-accent border-accent/30">
          {ad.pricingModel}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
          <button onClick={() => onEdit(ad)} className="btn btn-ghost btn-xs btn-circle" aria-label="Edit ad">
            <Edit3 size={13} />
          </button>
          <button onClick={() => setMenuOpen((p) => !p)} className="btn btn-ghost btn-xs btn-circle" aria-label="More options">
            <MoreVertical size={13} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 z-50 bg-base-100 border border-base-300 rounded-field shadow-xl py-1 min-w-[150px]"
              >
                {ad.status !== "Active" && (
                  <MenuBtn onClick={() => quickStatus("Active")} icon={CheckCircle} label="Set Active" color="text-success" />
                )}
                {ad.status === "Active" && (
                  <MenuBtn onClick={() => quickStatus("Paused")} icon={PauseCircle} label="Pause" color="text-warning" />
                )}
                <MenuBtn onClick={() => onArchive(ad._id)} icon={Archive} label="Archive" color="text-error" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </td>
    </motion.tr>
  );
});
AdRow.displayName = "AdRow";

const MenuBtn = ({ onClick, icon: Icon, label, color }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-base-200 transition-colors ${color}`}
  >
    <Icon size={12} /> {label}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = memo(({ search, onReset, onCreate }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-4">
      <AlertTriangle size={28} className="text-base-content/20" />
    </div>
    <p className="font-poppins text-base-content mb-1">
      {search ? "No ads found" : "No campaigns yet"}
    </p>
    <p className="text-sm text-base-content/40 mb-6 max-w-xs">
      {search
        ? `No ads matching "${search}". Try a different search term or clear filters.`
        : "Create your first ad campaign to start driving traffic."}
    </p>
    <div className="flex gap-2">
      {search && (
        <button onClick={onReset} className="btn btn-outline btn-sm">
          Clear filters
        </button>
      )}
      <button
        onClick={onCreate}
        className="btn-primary-cta px-4 py-2 text-sm flex items-center gap-1.5"
      >
        <Plus size={14} /> New Campaign
      </button>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AdsManagement() {
  const dispatch = useDispatch();
  const { allAds, analytics, loading, isRefreshing } = useSelector((s) => s.ads);

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [pageFilter, setPageFilter]   = useState("All");
  const [showForm, setShowForm]       = useState(false);
  const [editAd, setEditAd]           = useState(null);
  const [showChart, setShowChart]     = useState(false);
  const [sortKey, setSortKey]         = useState("priority"); 
  const [sortDir, setSortDir]         = useState("desc");

  useEffect(() => {
    dispatch(fetchAllAds());
    dispatch(getAdAnalytics());
  }, [dispatch]);

  useEffect(() => {
    const id = setInterval(() => dispatch(getAdAnalytics()), 30_000);
    return () => clearInterval(id);
  }, [dispatch]);

  const handleEdit = useCallback((ad) => {
    setEditAd(ad);
    setShowForm(true);
  }, []);

  const handleArchive = useCallback(
    (id) => {
      if (window.confirm("Archive this ad? It will be removed from active rotation.")) {
        dispatch(archiveAd(id));
      }
    },
    [dispatch]
  );

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditAd(null);
  }, []);

  const toggleSort = useCallback(
    (key) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortKey(key); setSortDir("desc"); }
    },
    [sortKey]
  );

  const filteredAds = useMemo(() => {
    let res = allAds || []; // safeguard

    if (statusFilter !== "All") res = res.filter((a) => a.status === statusFilter);
    if (pageFilter !== "All")   res = res.filter((a) => a.placement?.page === pageFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (a) =>
          a.adContent?.headline?.toLowerCase().includes(q) ||
          a.advertiser?.name?.toLowerCase().includes(q)
      );
    }

    return [...res].sort((a, b) => {
      let va, vb;
      if (sortKey === "priority") {
        va = a.placement?.priority ?? 0;
        vb = b.placement?.priority ?? 0;
      } else if (sortKey === "spend") {
        va = a.budget?.currentSpend ?? 0;
        vb = b.budget?.currentSpend ?? 0;
      } else {
        // BUG FIX: Secure calculation against missing analytics objects completely
        const viewsA = a.analytics?.views ?? 0;
        const clicksA = a.analytics?.clicks ?? 0;
        va = viewsA > 0 ? clicksA / viewsA : 0;

        const viewsB = b.analytics?.views ?? 0;
        const clicksB = b.analytics?.clicks ?? 0;
        vb = viewsB > 0 ? clicksB / viewsB : 0;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [allAds, statusFilter, pageFilter, search, sortKey, sortDir]);

  const stats = useMemo(() => ({
    activeCount: (allAds || []).filter((a) => a.status === "Active").length,
    totalSpend:  (allAds || []).reduce((s, a) => s + (a.budget?.currentSpend ?? 0), 0),
  }), [allAds]);

  const SortIcon = ({ k }) =>
    sortKey === k
      ? sortDir === "desc"
        ? <ChevronDown size={12} className="inline ml-1 text-primary" />
        : <ChevronUp   size={12} className="inline ml-1 text-primary" />
      : null;

  return (
    <div className="min-h-screen bg-base-100">
      <header className="sticky top-0 z-40 bg-base-100/90 backdrop-blur-strong border-b border-base-300">
        <div className="container-custom py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-poppins tracking-tight flex items-center gap-2">
              <Activity className="text-primary" size={22} />
              Ads Management
            </h1>
            <p className="text-xs text-base-content/50">
              {(allAds || []).length} campaigns · {stats.activeCount} active
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { dispatch(fetchAllAds()); dispatch(getAdAnalytics()); }}
              className="btn btn-ghost btn-sm gap-1"
              disabled={isRefreshing}
              aria-label="Refresh data"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setShowChart((p) => !p)}
              className={`btn btn-sm gap-1 ${showChart ? "btn-primary" : "btn-outline"}`}
            >
              <BarChart2 size={14} /> Analytics
            </button>

            <button
              onClick={() => { setEditAd(null); setShowForm(true); }}
              className="btn-primary-cta px-4 py-2 flex items-center gap-2 text-sm"
            >
              <Plus size={15} /> New Ad
            </button>
          </div>
        </div>
      </header>

      <main className="container-custom py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading && (allAds || []).length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                icon={Activity}
                label="Active Campaigns"
                value={stats.activeCount}
                sub={`of ${(allAds || []).length} total`}
                trend="up"
              />
              <StatCard
                icon={Eye}
                label="Total Impressions"
                value={(analytics?.totalViews ?? 0).toLocaleString()}
                sub="all time"
                color="text-info"
              />
              <StatCard
                icon={MousePointerClick}
                label="Total Clicks"
                value={(analytics?.totalClicks ?? 0).toLocaleString()}
                sub={`CTR ${(analytics?.avgCtr ?? 0).toFixed(2)}%`}
                color="text-success"
                trend="up"
              />
              <StatCard
                icon={DollarSign}
                label="Total Spend"
                value={`₹${stats.totalSpend.toLocaleString()}`}
                sub="across all campaigns"
                color="text-accent"
              />
            </>
          )}
        </div>

        <AnimatePresence>
          {showChart && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="card p-5">
                <h3 className="text-base font-poppins mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  Campaign Performance
                </h3>
                <RechartsPanel ads={allAds || []} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              className="input-field w-full pl-9"
              placeholder="Search by headline or advertiser…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search advertisements"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field appearance-none pr-8"
              aria-label="Filter by status"
            >
              <option value="All">All Status</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/40" />
          </div>

          <div className="relative">
            <select
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              className="input-field appearance-none pr-8"
              aria-label="Filter by page"
            >
              <option value="All">All Pages</option>
              {PAGES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/40" />
          </div>

          <span className="text-xs text-base-content/40 ml-auto">
            {filteredAds.length} result{filteredAds.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="table w-full"
              role="table"
              aria-label="Advertisements list"
            >
              <thead>
                <tr>
                  <th>Creative</th>
                  <th>Placement</th>
                  <th>Status</th>
                  <th>
                    <button onClick={() => toggleSort("ctr")} className="flex items-center gap-1 hover:text-primary transition-colors">
                      Analytics <SortIcon k="ctr" />
                    </button>
                  </th>
                  <th>
                    <button onClick={() => toggleSort("spend")} className="flex items-center gap-1 hover:text-primary transition-colors">
                      Budget <SortIcon k="spend" />
                    </button>
                  </th>
                  <th>Model</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (allAds || []).length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
                ) : filteredAds.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        search={search}
                        onReset={() => {
                          setSearch("");
                          setStatusFilter("All");
                          setPageFilter("All");
                        }}
                        onCreate={() => { setEditAd(null); setShowForm(true); }}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredAds.map((ad) => (
                    <AdRow key={ad._id} ad={ad} onEdit={handleEdit} onArchive={handleArchive} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showForm && <AdFormModal editAd={editAd} onClose={handleCloseForm} />}
      </AnimatePresence>
    </div>
  );
}