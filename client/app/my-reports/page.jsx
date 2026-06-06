// PatientRecord.jsx
// Full patient profile & history page — Redux-wired, no mock data
// Stack: React + Framer Motion + Lucide icons + Tailwind CSS + Redux Toolkit
"use client"
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  Pill,
  Activity,
  Star,
  ChevronDown,
  ChevronUp,
  Phone,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Scale,
  Ruler,
  Video,
  AudioLines,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  Download,
  RefreshCw,
  Users,
  Stethoscope,
  ClipboardList,
  FilePlus,
  MoreHorizontal,
  Shield,
  Zap,
  TrendingUp,
  Eye,
  Mic,
  MicOff,
  LogOut,
} from "lucide-react";

// ── Redux imports ─────────────────────────────────────────────────────────────
import {
  fetchConsultationById,
  fetchNotes,
  fetchPrescriptions,
  fetchChatHistory,
  fetchFollowUpHistory,
  fetchParticipants,
  fetchPatientHistory,
  muteParticipant,
  unmuteParticipant,
  kickParticipant,
  selectConsultation,
  selectConsultationStatus,
  selectVitals,
  selectNotes,
  selectPrescriptions,
  selectChatMessages,
  selectFollowUp,
  selectDocuments,
  selectMutedParticipants,
  selectPatientHistory,
  selectLoading,
  selectError,
} from "@/store/slices/consultationSlice";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtDuration = (sec) => {
  if (!sec) return "—";
  return `${Math.floor(sec / 60)} min`;
};

const STATUS_CONFIG = {
  completed:       { label: "Completed",  color: "bg-success/10 text-success border-success/30",  icon: CheckCircle2 },
  scheduled:       { label: "Scheduled",  color: "bg-info/10 text-info border-info/30",           icon: Calendar },
  cancelled:       { label: "Cancelled",  color: "bg-error/10 text-error border-error/30",        icon: XCircle },
  in_progress:     { label: "Live",       color: "bg-warning/10 text-warning border-warning/30",  icon: Zap },
  waiting:         { label: "Waiting",    color: "bg-info/10 text-info border-info/30",           icon: Clock },
  missed:          { label: "Missed",     color: "bg-error/10 text-error border-error/30",        icon: AlertCircle },
  no_show_patient: { label: "No Show",    color: "bg-error/10 text-error border-error/30",        icon: AlertCircle },
  paused:          { label: "Paused",     color: "bg-warning/10 text-warning border-warning/30",  icon: Timer },
};

const TYPE_ICON = {
  video:      Video,
  audio:      AudioLines,
  chat:       MessageSquare,
  in_person:  Users,
  home_visit: Shield,
};

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: "easeOut" },
  }),
};

const collapseVariants = {
  open:   { height: "auto", opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  closed: { height: 0,      opacity: 0, transition: { duration: 0.25, ease: "easeIn" } },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    color: "bg-base-300 text-base-content",
    icon: Clock,
  };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.color}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function VitalCard({ icon: Icon, label, value, unit, color = "text-primary" }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-base-200 rounded-xl p-3.5 flex flex-col gap-1.5 border border-base-300 hover:border-primary/30 transition-colors"
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center bg-base-300 ${color}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
        {label}
      </p>
      <p className="text-xl font-black font-montserrat text-base-content">
        {value ?? "—"}
        {unit && (
          <span className="text-xs font-medium text-base-content/50 ml-1">
            {unit}
          </span>
        )}
      </p>
    </motion.div>
  );
}

function CollapsibleSection({ title, icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-base-200/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <span className="text-base font-bold text-base-content font-montserrat">
            {title}
            {count !== undefined && (
              <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {count}
              </span>
            )}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-base-content/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-content/40" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial="closed"
            animate="open"
            exit="closed"
            variants={collapseVariants}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="loading loading-md loading-spinner" />
    </div>
  );
}

function EmptyState({ message = "No data." }) {
  return (
    <p className="text-sm text-base-content/40 text-center py-6">{message}</p>
  );
}

// ── Panels ────────────────────────────────────────────────────────────────────

function PatientHeader({ snapshot, prescriptionsCount = 0 }) {
  const patient = snapshot ?? {};
  const name = patient.name ?? "Unknown Patient";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="bg-base-100 border border-base-300 rounded-2xl p-5 md:p-6"
    >
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
          <span className="text-2xl font-black font-montserrat text-primary">
            {initials}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-black font-montserrat text-base-content">
              {name}
            </h1>
            {patient.bloodGroup && (
              <span className="badge badge-primary text-[10px]">
                {patient.bloodGroup}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-base-content/60">
            {(patient.age || patient.gender) && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {patient.age && `${patient.age}y`}
                {patient.age && patient.gender && " · "}
                {patient.gender}
              </span>
            )}
            {patient.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {patient.phone}
              </span>
            )}
          </div>
          {patient.allergies?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs text-error/70 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Allergies:
              </span>
              {patient.allergies.map((a) => (
                <span
                  key={a}
                  className="text-xs px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/25 font-medium"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-row sm:flex-col gap-3 sm:gap-2 text-right">
          <div>
            <p className="text-2xl font-black font-montserrat text-primary">
              {prescriptionsCount}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/50">
              Prescriptions
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function VitalsPanel({ vitals }) {
  const isLoading = useSelector(selectLoading("clinical"));

  const items = vitals
    ? [
        {
          icon: Heart,
          label: "Blood Pressure",
          value:
            vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic
              ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
              : null,
          unit: "mmHg",
          color: "text-error",
        },
        { icon: Activity,    label: "Pulse Rate",   value: vitals.pulseRate,        unit: "bpm",   color: "text-primary" },
        { icon: Thermometer, label: "Temperature",  value: vitals.temperatureC,     unit: "°C",    color: "text-warning" },
        { icon: Droplets,    label: "SpO₂",         value: vitals.spO2 != null ? `${vitals.spO2}%` : null, unit: "", color: "text-info" },
        { icon: Wind,        label: "Resp. Rate",   value: vitals.respiratoryRate,  unit: "/min",  color: "text-accent" },
        { icon: Scale,       label: "Weight",       value: vitals.weightKg,         unit: "kg",    color: "text-success" },
        { icon: Ruler,       label: "Height",       value: vitals.heightCm,         unit: "cm",    color: "text-secondary" },
        { icon: Zap,         label: "Blood Glucose",value: vitals.bloodGlucose,     unit: "mg/dL", color: "text-warning" },
      ]
    : [];

  return (
    <CollapsibleSection
      title="Vitals (Active Session)"
      icon={<Activity className="w-4 h-4 text-primary" />}
      defaultOpen
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : !vitals ? (
        <EmptyState message="No vitals recorded for the selected session." />
      ) : (
        <>
          <p className="text-xs text-base-content/40 mb-3">
            Recorded {fmtDate(vitals.recordedAt)} · {fmtTime(vitals.recordedAt)}
          </p>
          <motion.div
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
          >
            {items.map((v, i) => (
              <motion.div key={v.label} custom={i} variants={fadeUp}>
                <VitalCard {...v} />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </CollapsibleSection>
  );
}

function ConsultationCard({ c, index, isActive, onClick }) {
  const TypeIcon = TYPE_ICON[c.consultationType] || Video;
  const isLive = c.status === "in_progress";

  return (
    <motion.div
      onClick={onClick}
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={`relative border rounded-xl p-4 transition-all cursor-pointer hover:shadow-sm ${
        isActive
          ? "border-primary ring-1 ring-primary shadow-md"
          : "hover:border-primary/40 border-base-300"
      } ${isLive ? "bg-warning/5" : "bg-base-100"}`}
    >
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-warning">
            Live
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isActive
              ? "bg-primary text-primary-content"
              : isLive
              ? "bg-warning/15 text-warning"
              : "bg-primary/10 text-primary"
          }`}
        >
          <TypeIcon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <p className="text-xs font-mono text-base-content/40">
              {c.consultationCode}
            </p>
            <StatusBadge status={c.status} />
            {c.isFollowUp && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25 font-bold uppercase tracking-wider">
                Follow-up
              </span>
            )}
          </div>
          <p className="font-bold text-base-content text-sm truncate">
            {c.doctorSnapshot?.name ?? "—"}
          </p>
          <p className="text-xs text-base-content/50">
            {c.doctorSnapshot?.specialization ?? ""}
          </p>

          <div className="flex flex-wrap gap-3 mt-2 text-xs text-base-content/50">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {fmtDate(c.scheduledAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {fmtTime(c.scheduledAt)}
            </span>
            {c.actualDurationSec && (
              <span className="flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />{" "}
                {fmtDuration(c.actualDurationSec)}
              </span>
            )}
          </div>
        </div>

        {c.isRated && c.rating && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3.5 h-3.5 ${
                  s <= c.rating.overallRating
                    ? "text-warning fill-warning"
                    : "text-base-300"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Display patient's overall history fetched from Redux
function ConsultationsPanel({ history, activeId, onSelect }) {
  const [filter, setFilter] = useState("all");
  const filters = ["all", "completed", "scheduled", "in_progress", "cancelled"];
  const isLoading = useSelector(selectLoading("fetch"));

  const visible =
    filter === "all"
      ? history
      : history.filter((c) => c.status === filter);

  return (
    <CollapsibleSection
      title="Consultation History"
      icon={<Stethoscope className="w-4 h-4 text-primary" />}
      count={history.length}
      defaultOpen
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${
              filter === f
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content/60 hover:bg-base-300"
            }`}
          >
            {f === "all" ? "All" : STATUS_CONFIG[f]?.label ?? f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
        {isLoading && history.length === 0 ? (
           <LoadingSpinner />
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.length === 0 ? (
              <EmptyState message="No consultations found." />
            ) : (
              visible.map((c, i) => (
                <ConsultationCard
                  key={c._id}
                  c={c}
                  index={i}
                  isActive={c._id === activeId}
                  onClick={() => onSelect(c._id)}
                />
              ))
            )}
          </AnimatePresence>
        )}
      </div>
    </CollapsibleSection>
  );
}

function PrescriptionsPanel() {
  const prescriptions = useSelector(selectPrescriptions);
  const isLoading = useSelector(selectLoading("clinical"));
  const [expanded, setExpanded] = useState(null);

  return (
    <CollapsibleSection
      title="Prescriptions"
      icon={<Pill className="w-4 h-4 text-primary" />}
      count={prescriptions.length}
      defaultOpen
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : prescriptions.length === 0 ? (
        <EmptyState message="No prescriptions." />
      ) : (
        <div className="flex flex-col gap-3">
          {prescriptions.map((rx, i) => (
            <motion.div
              key={rx._id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <div className="border border-base-300 rounded-xl overflow-hidden">
                <button
                  onClick={() =>
                    setExpanded(expanded === rx._id ? null : rx._id)
                  }
                  className="w-full flex items-center justify-between p-3.5 hover:bg-base-200/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        rx.status === "issued" ? "bg-success/10" : "bg-base-300"
                      }`}
                    >
                      <Pill
                        className={`w-4 h-4 ${
                          rx.status === "issued"
                            ? "text-success"
                            : "text-base-content/40"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-base-content/40">
                        {rx.rxNumber}
                      </p>
                      <p className="text-sm font-bold text-base-content truncate">
                        {rx.diagnosis ?? "—"}
                      </p>
                      <p className="text-xs text-base-content/50">
                        {rx.doctor?.name ?? "—"} · {fmtDate(rx.issuedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        rx.status === "issued"
                          ? "bg-success/10 text-success border-success/30"
                          : rx.status === "expired"
                          ? "bg-error/10 text-error border-error/30"
                          : "bg-base-300 text-base-content/50 border-base-300"
                      }`}
                    >
                      {rx.status}
                    </span>
                    {expanded === rx._id ? (
                      <ChevronUp className="w-4 h-4 text-base-content/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-base-content/40" />
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {expanded === rx._id && (
                    <motion.div
                      initial="closed"
                      animate="open"
                      exit="closed"
                      variants={collapseVariants}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-base-300 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-2">
                          Medicines ({rx.medicines?.length ?? 0})
                        </p>
                        <div className="flex flex-col gap-2">
                          {(rx.medicines ?? []).map((m, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-2.5 bg-base-200 rounded-lg"
                            >
                              <p className="text-sm font-semibold text-base-content flex-1">
                                {m.medicineName}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                                  {m.frequency}
                                </span>
                                {m.durationDays && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/60 font-medium">
                                    {m.durationDays}d
                                  </span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/60 font-medium">
                                  {m.timing}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-300">
                          <p className="text-xs text-base-content/40">
                            Expires {fmtDate(rx.expiresAt)}
                          </p>
                          <button className="btn btn-xs btn-outline flex items-center gap-1">
                            <Download className="w-3 h-3" /> Download
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function ChatPanel() {
  const messages = useSelector(selectChatMessages);
  const isLoading = useSelector(selectLoading("chat"));

  return (
    <CollapsibleSection
      title="Session Chat"
      icon={<MessageSquare className="w-4 h-4 text-primary" />}
      count={messages.length}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : messages.length === 0 ? (
        <EmptyState message="No chat messages." />
      ) : (
        <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
          {messages
            .filter((m) => !m.isDeleted)
            .map((msg, i) => {
              const isDoctor = msg.senderRole === "doctor";
              return (
                <motion.div
                  key={msg._id}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className={`flex ${isDoctor ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                      isDoctor
                        ? "bg-base-200 text-base-content rounded-tl-none"
                        : "bg-primary text-primary-content rounded-tr-none"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                        isDoctor ? "text-primary" : "text-primary-content/70"
                      }`}
                    >
                      {isDoctor ? "Doctor" : "Patient"}
                    </p>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        isDoctor
                          ? "text-base-content/40"
                          : "text-primary-content/60"
                      }`}
                    >
                      {fmtTime(msg.sentAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
        </div>
      )}
    </CollapsibleSection>
  );
}

function DocumentsPanel() {
  const documents = useSelector(selectDocuments);

  const DOC_ICONS = {
    lab_report:   { icon: ClipboardList, color: "text-info" },
    imaging:      { icon: Eye,           color: "text-accent" },
    prescription: { icon: FileText,      color: "text-success" },
    other:        { icon: FileText,      color: "text-base-content/50" },
  };

  return (
    <CollapsibleSection
      title="Documents"
      icon={<FileText className="w-4 h-4 text-primary" />}
      count={documents.length}
    >
      {documents.length === 0 ? (
        <EmptyState message="No documents uploaded." />
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc, i) => {
            const dcfg = DOC_ICONS[doc.docType] || DOC_ICONS.other;
            const DocIcon = dcfg.icon;
            return (
              <motion.div
                key={doc._id ?? i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="flex items-center gap-3 p-3 bg-base-200 rounded-xl hover:bg-base-300/50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-base-300 flex items-center justify-center flex-shrink-0">
                  <DocIcon className={`w-4 h-4 ${dcfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-base-content truncate">
                    {doc.originalName}
                  </p>
                  <p className="text-xs text-base-content/40 capitalize">
                    {doc.docType?.replace("_", " ")} · {fmtDate(doc.uploadedAt)}
                  </p>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-xs btn-ghost"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </motion.div>
            );
          })}
        </div>
      )}
      <button className="mt-3 w-full btn btn-outline btn-sm flex items-center gap-2">
        <FilePlus className="w-4 h-4" /> Upload Document
      </button>
    </CollapsibleSection>
  );
}

function ClinicalNotesPanel() {
  const notes = useSelector(selectNotes);
  const isLoading = useSelector(selectLoading("clinical"));

  const sections = notes
    ? [
        { label: "Chief Complaint", value: notes.chiefComplaint },
        { label: "Subjective",      value: notes.subjective },
        { label: "Objective",       value: notes.objective },
        { label: "Assessment",      value: notes.assessment },
        { label: "Plan",            value: notes.plan },
        { label: "Lifestyle",       value: notes.lifestyleAdvice },
      ]
    : [];

  return (
    <CollapsibleSection
      title="Clinical Notes"
      icon={<ClipboardList className="w-4 h-4 text-primary" />}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : !notes ? (
        <EmptyState message="No clinical notes for this session." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sections.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <div className="bg-base-200 rounded-xl p-3.5 h-full">
                <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">
                  {s.label}
                </p>
                <p className="text-sm text-base-content leading-relaxed">
                  {s.value || "—"}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

function FollowUpPanel() {
  const { chain } = useSelector(selectFollowUp);
  const isLoading = useSelector(selectLoading("followUp"));

  return (
    <CollapsibleSection
      title="Follow-up Chain"
      icon={<RefreshCw className="w-4 h-4 text-primary" />}
      count={chain.length}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : chain.length === 0 ? (
        <EmptyState message="No follow-up chain established." />
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-base-300" />
          <div className="flex flex-col gap-3 pl-10">
            {chain.map((c, i) => (
              <motion.div
                key={c._id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="relative"
              >
                <div
                  className={`absolute -left-10 top-3.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    c.status === "completed"
                      ? "bg-success border-success"
                      : "bg-base-100 border-primary"
                  }`}
                >
                  {c.status === "completed" ? (
                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>

                <div
                  className={`border rounded-xl p-3.5 ${
                    c.status === "completed"
                      ? "bg-base-100 border-base-300"
                      : "bg-primary/5 border-primary/25"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-xs font-mono text-base-content/40">
                      {c.consultationCode}
                    </p>
                    <StatusBadge status={c.status} />
                    {c.isFollowUp && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25 font-bold uppercase">
                        Follow-up
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-base-content">
                    {c.doctorSnapshot?.name ?? "—"}
                  </p>
                  <p className="text-xs text-base-content/50 mt-0.5">
                    {fmtDate(c.scheduledAt)} · {fmtTime(c.scheduledAt)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <button className="mt-4 w-full btn btn-outline btn-sm flex items-center gap-2">
        <FilePlus className="w-4 h-4" /> Schedule Follow-up
      </button>
    </CollapsibleSection>
  );
}

function ParticipantControls({ consultationId }) {
  const dispatch = useDispatch();
  const mutedParticipants = useSelector(selectMutedParticipants);
  const consultation = useSelector(selectConsultation);

  const pId = consultation?.patient?.toString?.() ?? consultation?.patient;
  const isPatientMuted = pId ? mutedParticipants.includes(pId) : false;

  const handleMuteToggle = () => {
    if (!pId || !consultationId) return;
    if (isPatientMuted) {
      dispatch(unmuteParticipant({ id: consultationId, userId: pId }));
    } else {
      dispatch(muteParticipant({ id: consultationId, userId: pId }));
    }
  };

  const handleKick = () => {
    if (!pId || !consultationId) return;
    dispatch(kickParticipant({ id: consultationId, userId: pId, reason: "Removed by doctor" }));
  };

  return (
    <CollapsibleSection
      title="Session Controls"
      icon={<Users className="w-4 h-4 text-primary" />}
    >
      <p className="text-xs text-base-content/40 mb-3">
        Doctor controls for active session participants
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleMuteToggle}
          disabled={!pId || !consultationId}
          className={`btn btn-sm flex items-center gap-1.5 ${
            isPatientMuted ? "btn-warning" : "btn-outline"
          }`}
        >
          {isPatientMuted ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
          {isPatientMuted ? "Unmute" : "Mute"} Patient
        </button>
        <button
          onClick={handleKick}
          disabled={!pId || !consultationId}
          className="btn btn-sm btn-error btn-outline flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Kick Participant
        </button>
      </div>
    </CollapsibleSection>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PatientRecord() {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("overview");
  const [activeConsultId, setActiveConsultId] = useState(null);

  // Retrieve the logged-in user to derive the patientId
  const user = useSelector((state) => state.user?.user);
  const patientId = user?._id || user?.id;

  const patientHistory = useSelector(selectPatientHistory);
  const consultation = useSelector(selectConsultation);
  const vitals = useSelector(selectVitals);
  const isFetchLoading = useSelector(selectLoading("fetch"));
  const error = useSelector(selectError);

  // 1. Bootstrap: fetch complete patient history on mount
  useEffect(() => {
    if (!patientId) return;
    dispatch(fetchPatientHistory({ patient: patientId }));
  }, [dispatch, patientId]);

  // 2. Select initial active consultation if none selected
  useEffect(() => {
    if (patientHistory?.length > 0 && !activeConsultId) {
      setActiveConsultId(patientHistory[0]._id);
    }
  }, [patientHistory, activeConsultId]);

  // 3. Fetch specific consultation details when active ID changes
  useEffect(() => {
    if (!activeConsultId) return;
    dispatch(fetchConsultationById(activeConsultId));
    dispatch(fetchNotes(activeConsultId));
    dispatch(fetchPrescriptions(activeConsultId));
    dispatch(fetchChatHistory(activeConsultId));
    dispatch(fetchFollowUpHistory(activeConsultId));
    dispatch(fetchParticipants(activeConsultId));
  }, [dispatch, activeConsultId]);

  const tabs = [
    { id: "overview",  label: "Overview",  icon: TrendingUp },
    { id: "clinical",  label: "Clinical",  icon: Stethoscope },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "followup",  label: "Follow-up", icon: RefreshCw },
  ];

  if (isFetchLoading && !patientHistory.length) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="loading loading-lg loading-spinner" />
      </div>
    );
  }

  if (error && !patientHistory.length) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="alert alert-error max-w-sm">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Derive patient info fallback since we fetch via history now
  const patientSnapshot =
    consultation?.patientSnapshot || patientHistory[0]?.patientSnapshot;
  const patientName = patientSnapshot?.name ?? "Unknown Patient";

  return (
    <div className="min-h-screen bg-base-200">
      {/* Top bar */}
      <div className="bg-base-100 border-b border-base-300 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-primary-content" />
          </div>
          <div>
            <p className="text-xs font-semibold text-base-content/50 leading-none">
              Patient Record
            </p>
            <p className="text-sm font-bold text-base-content font-montserrat">
              {patientName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-xs btn-ghost">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button className="btn btn-xs btn-primary flex items-center gap-1">
            <FilePlus className="w-3.5 h-3.5" /> New Consultation
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-5">
        {/* Patient header */}
        <PatientHeader 
          snapshot={patientSnapshot} 
          prescriptionsCount={consultation?.prescriptions?.length ?? 0} 
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-base-100 border border-base-300 rounded-xl p-1 overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-content shadow-sm"
                    : "text-base-content/60 hover:text-base-content hover:bg-base-200"
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <ConsultationsPanel 
                history={patientHistory} 
                activeId={activeConsultId} 
                onSelect={(id) => setActiveConsultId(id)} 
              />
              <VitalsPanel vitals={vitals} />
              <ParticipantControls consultationId={activeConsultId} />
            </motion.div>
          )}

          {activeTab === "clinical" && (
            <motion.div
              key="clinical"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <ClinicalNotesPanel />
              <PrescriptionsPanel />
              <ChatPanel />
            </motion.div>
          )}

          {activeTab === "documents" && (
            <motion.div
              key="documents"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <DocumentsPanel />
            </motion.div>
          )}

          {activeTab === "followup" && (
            <motion.div
              key="followup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <FollowUpPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}