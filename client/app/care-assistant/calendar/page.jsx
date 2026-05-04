'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Heart,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Wifi,
  WifiOff,
  Star,
  MapPin,
  Phone,
  Filter,
  RefreshCw,
  Sun,
  Moon,
  Sunset,
  Activity,
  TrendingUp,
  Eye,
  X,
  ChevronDown,
  Zap,
} from 'lucide-react';

// ── Redux imports (update paths to match your project) ────────────────────────
import {
  fetchCareAssistantWeekly,
  fetchCareAssistantTasks,
  fetchHospitalDoctorsSchedules,
  selectCareAssistantWeekly,
  selectCareAssistantTasks,
  selectCareAssistantIsOnline,
  selectCareAssistantStatus,
  selectAvailabilityLoading,
  selectAvailabilityError,
} from '@/store/slices/availabilitySlice';

// import { selectUser } from '@/store/slices/userSlice';
const selectUser = (s) => s.user.user;

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_KEYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_FULL   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const STATUS_CONFIG = {
  Available:  { color: 'var(--success)',  bg: 'color-mix(in srgb, var(--success) 15%, transparent)',  icon: CheckCircle2,  label: 'Available'   },
  'On-Task':  { color: 'var(--warning)',  bg: 'color-mix(in srgb, var(--warning) 15%, transparent)',  icon: Activity,      label: 'On Task'     },
  'On-Break': { color: 'var(--info)',     bg: 'color-mix(in srgb, var(--info)    15%, transparent)',  icon: Coffee,        label: 'On Break'    },
  Offline:    { color: 'var(--error)',    bg: 'color-mix(in srgb, var(--error)   15%, transparent)',  icon: WifiOff,       label: 'Offline'     },
  Suspended:  { color: 'var(--neutral)',  bg: 'color-mix(in srgb, var(--neutral) 15%, transparent)',  icon: AlertCircle,   label: 'Suspended'   },
};

const SHIFT_COLORS = [
  'var(--primary)', 'var(--secondary)', 'var(--accent)',
  'var(--info)',    'var(--success)',   'var(--warning)',
];

// ── Utility helpers ────────────────────────────────────────────────────────────

function getWeekDates(baseDate) {
  const d   = new Date(baseDate);
  const day = d.getDay(); // 0=Sun
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return dd;
  });
}

function timeToMinutes(t = '') {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function shiftPercent(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const left  = (s / 1440) * 100;
  const width = ((e - s) / 1440) * 100;
  return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function isToday(d) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function getShiftLabel(start, end) {
  const s = timeToMinutes(start);
  if (s < 480)  return { label: 'Night',   icon: Moon };
  if (s < 720)  return { label: 'Morning', icon: Sun };
  if (s < 1080) return { label: 'Evening', icon: Sunset };
  return { label: 'Night', icon: Moon };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OnlineDot({ isOnline, pulse = true }) {
  return (
    <span className="relative inline-flex">
      <span
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: isOnline ? 'var(--success)' : 'var(--error)',
          display: 'inline-block',
        }}
      />
      {isOnline && pulse && (
        <motion.span
          animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'var(--success)', display: 'block',
          }}
        />
      )}
    </span>
  );
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Offline;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function ShiftBar({ start, end, colorIdx = 0, label }) {
  const pos   = shiftPercent(start, end);
  const color = SHIFT_COLORS[colorIdx % SHIFT_COLORS.length];
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{
        position: 'absolute', top: 4, height: 18,
        left: pos.left, width: pos.width,
        background: `color-mix(in srgb, ${color} 25%, transparent)`,
        border: `1.5px solid ${color}`,
        borderRadius: 6,
        transformOrigin: 'left',
        cursor: 'default',
        display: 'flex', alignItems: 'center',
        padding: '0 4px',
        overflow: 'hidden',
        minWidth: 24,
      }}
      title={`${label ?? ''} ${start} – ${end}`}
    >
      <span style={{ fontSize: 9, color, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {start}–{end}
      </span>
    </motion.div>
  );
}

function HourTicks() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {[0,6,12,18,24].map(h => (
        <div key={h} style={{
          position: 'absolute', left: `${(h/24)*100}%`,
          top: 0, bottom: 0,
          borderLeft: '1px dashed color-mix(in srgb, var(--base-content) 12%, transparent)',
        }}>
          {h < 24 && (
            <span style={{
              position: 'absolute', top: '100%', marginTop: 2,
              fontSize: 9, color: 'color-mix(in srgb, var(--base-content) 40%, transparent)',
              transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            }}>
              {h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h-12}pm`}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Task chip ──────────────────────────────────────────────────────────────────

function TaskChip({ task, onClick }) {
  const at = task.scheduledAt ? new Date(task.scheduledAt) : null;
  const time = at ? at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(task)}
      style={{
        background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
        borderRadius: 8,
        padding: '4px 8px',
        marginBottom: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Heart size={10} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--base-content)', truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.patientInfo?.name ?? 'Patient'}
        </div>
        {time && (
          <div style={{ fontSize: 9, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)' }}>
            {time}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Day cell (single CA, self view) ───────────────────────────────────────────

function SelfDayCell({ date, dayKey, schedule, tasks = [] }) {
  const daySchedule = schedule?.[dayKey] ?? {};
  const isAvail     = daySchedule.isAvailable;
  const today       = isToday(date);
  const tasksToday  = tasks.filter(t => {
    if (!t.scheduledAt) return false;
    const d = new Date(t.scheduledAt);
    return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
  });

  const [showTasks, setShowTasks] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
      style={{
        background: today
          ? 'color-mix(in srgb, var(--primary) 8%, var(--base-100))'
          : 'var(--base-100)',
        border: `1.5px solid ${today ? 'var(--primary)' : 'var(--base-300)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 12px 8px',
        background: today
          ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
          : 'var(--base-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--base-300)',
      }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: today ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content) 55%, transparent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {DAY_LABELS[DAY_KEYS.indexOf(dayKey)]}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: today ? 'var(--primary)' : 'var(--base-content)', lineHeight: 1 }}>
            {date.getDate()}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span
            style={{
              fontSize: 7, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: isAvail
                ? 'color-mix(in srgb, var(--success) 18%, transparent)'
                : 'color-mix(in srgb, var(--error) 14%, transparent)',
              color: isAvail ? 'var(--success)' : 'var(--error)',
              border: `1px solid ${isAvail ? 'var(--success)' : 'var(--error)'}40`,
            }}
          >
            {isAvail ? 'Available' : 'Off'}
          </span>
          {tasksToday.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>
              {tasksToday.length} task{tasksToday.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Timeline bar */}
      {isAvail && daySchedule.startTime && daySchedule.endTime && (
        <div style={{ padding: '10px 12px 6px', position: 'relative', height: 42 }}>
          <HourTicks />
          <ShiftBar start={daySchedule.startTime} end={daySchedule.endTime} colorIdx={0} />
        </div>
      )}

      {/* Shift details */}
      {isAvail && daySchedule.startTime && (
        <div style={{ padding: '4px 12px 8px',marginTop:20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--base-content)' }}>
              {daySchedule.startTime} – {daySchedule.endTime}
            </span>
          </div>
          {daySchedule.maxHoursPerDay && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={11} style={{ color: 'var(--secondary)' }} />
              <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--base-content) 65%, transparent)' }}>
                Max {daySchedule.maxHoursPerDay}h
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {tasksToday.length > 0 && (
        <div style={{ padding: '4px 12px 10px', flex: 1 }}>
          <button
            onClick={() => setShowTasks(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--primary)', fontSize: 11, fontWeight: 700,
            }}
          >
            <Heart size={11} />
            Tasks ({tasksToday.length})
            <ChevronDown size={11} style={{ transform: showTasks ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </button>
          <AnimatePresence>
            {showTasks && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                {tasksToday.slice(0, 4).map(t => (
                  <div key={t._id} style={{
                    fontSize: 11, padding: '3px 0',
                    color: 'var(--base-content)',
                    borderBottom: '1px solid var(--base-300)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Heart size={9} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.patientInfo?.name ?? 'Patient'}
                    </span>
                  </div>
                ))}
                {tasksToday.length > 4 && (
                  <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)', marginTop: 4 }}>
                    +{tasksToday.length - 4} more
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!isAvail && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'color-mix(in srgb, var(--base-content) 25%, transparent)',
          fontSize: 12, fontStyle: 'italic',
        }}>
          Day off
        </div>
      )}
    </motion.div>
  );
}

// ── Care assistant row (hospital view) ─────────────────────────────────────────

function AssistantRow({ assistant, weekDates, colorIdx, onSelect }) {
  const schedule = assistant.weeklySchedule ?? {};
  const tasks    = assistant.tasks ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: colorIdx * 0.06 }}
      style={{
        background: 'var(--base-100)',
        border: '1px solid var(--base-300)',
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* Assistant header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: `color-mix(in srgb, ${SHIFT_COLORS[colorIdx % SHIFT_COLORS.length]} 8%, var(--base-200))`,
        borderBottom: '1px solid var(--base-300)',
        cursor: 'pointer',
      }}
        onClick={() => onSelect(assistant)}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `color-mix(in srgb, ${SHIFT_COLORS[colorIdx % SHIFT_COLORS.length]} 25%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800,
          color: SHIFT_COLORS[colorIdx % SHIFT_COLORS.length],
          border: `2px solid ${SHIFT_COLORS[colorIdx % SHIFT_COLORS.length]}40`,
          flexShrink: 0,
        }}>
          {(assistant.fullName ?? 'CA')[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--base-content)' }}>
            {assistant.fullName ?? 'Care Assistant'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <StatusPill status={assistant.status ?? 'Offline'} />
            {assistant.workType && (
              <span style={{
                fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Zap size={9} style={{ color: 'var(--accent)' }} />
                {assistant.workType}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <OnlineDot isOnline={assistant.availability?.isOnline ?? false} />
          <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
          <Eye size={14} style={{ color: 'color-mix(in srgb, var(--base-content) 35%, transparent)' }} />
        </div>
      </div>

      {/* 7-day timeline grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 0,
      }}>
        {weekDates.map((date, i) => {
          const dk       = DAY_KEYS[i];
          const dayData  = schedule[dk] ?? {};
          const isAvail  = dayData.isAvailable;
          const today    = isToday(date);
          const dayTasks = tasks.filter(t => {
            if (!t.scheduledAt) return false;
            const d = new Date(t.scheduledAt);
            return d.getDate() === date.getDate() && d.getMonth() === date.getMonth();
          });

          return (
            <div key={i} style={{
              borderRight: i < 6 ? '1px solid var(--base-300)' : 'none',
              padding: '8px 6px',
              background: today
                ? `color-mix(in srgb, ${SHIFT_COLORS[colorIdx % SHIFT_COLORS.length]} 6%, transparent)`
                : 'transparent',
              minHeight: 90,
              position: 'relative',
            }}>
              {/* Day label */}
              <div style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: 4,
                color: today ? SHIFT_COLORS[colorIdx % SHIFT_COLORS.length] : 'color-mix(in srgb, var(--base-content) 45%, transparent)',
              }}>
                {DAY_LABELS[i]} {date.getDate()}
              </div>

              {/* Availability indicator */}
              {isAvail && dayData.startTime ? (
                <>
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: SHIFT_COLORS[colorIdx % SHIFT_COLORS.length],
                    display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4,
                  }}>
                    <Clock size={9} />
                    {dayData.startTime}
                  </div>
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: `color-mix(in srgb, ${SHIFT_COLORS[colorIdx % SHIFT_COLORS.length]} 35%, transparent)`,
                    border: `1px solid ${SHIFT_COLORS[colorIdx % SHIFT_COLORS.length]}50`,
                    marginBottom: 4,
                  }} />
                  <div style={{
                    fontSize: 10,
                    color: 'color-mix(in srgb, var(--base-content) 50%, transparent)',
                  }}>
                    –{dayData.endTime}
                  </div>
                </>
              ) : (
                <div style={{
                  fontSize: 9, color: 'color-mix(in srgb, var(--base-content) 25%, transparent)',
                  fontStyle: 'italic', marginTop: 8,
                }}>
                  off
                </div>
              )}

              {/* Task dots */}
              {dayTasks.length > 0 && (
                <div style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: 2 }}>
                  {dayTasks.slice(0, 3).map((_, ti) => (
                    <div key={ti} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--primary)',
                    }} />
                  ))}
                  {dayTasks.length > 3 && (
                    <span style={{ fontSize: 8, color: 'var(--primary)', fontWeight: 700 }}>+</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Task detail modal ──────────────────────────────────────────────────────────

function TaskModal({ task, onClose }) {
  if (!task) return null;
  const at = task.scheduledAt ? new Date(task.scheduledAt) : null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            borderRadius: 20,
            padding: 24,
            width: '100%', maxWidth: 420,
            boxShadow: 'var(--shadow-depth)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Heart size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--base-content)' }}>Task Details</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--base-content)' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: User,     label: 'Patient',    value: task.patientInfo?.name ?? '—' },
              { icon: Calendar, label: 'Date',       value: at ? at.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : '—' },
              { icon: Clock,    label: 'Time',       value: at ? at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—' },
              { icon: Activity, label: 'Type',       value: task.bookingType?.replace(/_/g, ' ') ?? '—' },
              { icon: Star,     label: 'Status',     value: task.status ?? '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={14} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 50%, transparent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--base-content)', textTransform: 'capitalize' }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 20 }}
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Assistant detail panel (hospital view) ─────────────────────────────────────

function AssistantDetailPanel({ assistant, weekDates, onClose }) {
  if (!assistant) return null;
  const schedule = assistant.weeklySchedule ?? {};
  const tasks    = assistant.tasks ?? [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: 16,
        }}
      >
        <motion.div
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 60, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            borderRadius: 20,
            width: '100%', maxWidth: 400,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-depth)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 20px 16px',
            background: 'color-mix(in srgb, var(--primary) 8%, var(--base-200))',
            borderBottom: '1px solid var(--base-300)',
            position: 'sticky', top: 0, zIndex: 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 50, height: 50, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--primary) 20%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 800, color: 'var(--primary)',
                  border: '2px solid color-mix(in srgb, var(--primary) 35%, transparent)',
                }}>
                  {(assistant.fullName ?? 'CA')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--base-content)' }}>
                    {assistant.fullName ?? 'Care Assistant'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <StatusPill status={assistant.status ?? 'Offline'} />
                    <OnlineDot isOnline={assistant.availability?.isOnline ?? false} />
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--base-content)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Weekly schedule */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--base-content)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} style={{ color: 'var(--primary)' }} />
                Weekly Schedule
              </div>
              {DAY_KEYS.map((dk, i) => {
                const d = schedule[dk] ?? {};
                return (
                  <div key={dk} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--base-300)',
                  }}>
                    <span style={{
                      width: 28, fontSize: 11, fontWeight: 700,
                      color: d.isAvailable ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content) 30%, transparent)',
                    }}>
                      {DAY_LABELS[i]}
                    </span>
                    {d.isAvailable ? (
                      <>
                        <div style={{
                          flex: 1, height: 8, borderRadius: 4,
                          background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
                          position: 'relative', overflow: 'hidden',
                        }}>
                          {d.startTime && d.endTime && (
                            <div style={{
                              position: 'absolute',
                              left: shiftPercent(d.startTime, d.endTime).left,
                              width: shiftPercent(d.startTime, d.endTime).width,
                              top: 0, bottom: 0,
                              background: 'var(--primary)',
                              borderRadius: 4,
                            }} />
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--base-content)', whiteSpace: 'nowrap', minWidth: 80 }}>
                          {d.startTime} – {d.endTime}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 30%, transparent)', fontStyle: 'italic' }}>Off</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Upcoming tasks */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--base-content)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Heart size={14} style={{ color: 'var(--primary)' }} />
                Upcoming Tasks ({tasks.length})
              </div>
              {tasks.length === 0 ? (
                <div style={{ fontSize: 12, color: 'color-mix(in srgb, var(--base-content) 40%, transparent)', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                  No upcoming tasks
                </div>
              ) : (
                tasks.slice(0, 8).map(t => {
                  const at = t.scheduledAt ? new Date(t.scheduledAt) : null;
                  return (
                    <div key={t._id} style={{
                      padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                      background: 'color-mix(in srgb, var(--primary) 8%, var(--base-200))',
                      border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--base-content)' }}>
                        {t.patientInfo?.name ?? 'Patient'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                        {at && (
                          <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={9} />
                            {at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} {at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        )}
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 999,
                          background: 'color-mix(in srgb, var(--success) 20%, transparent)',
                          color: 'var(--success)', fontWeight: 600,
                          textTransform: 'capitalize',
                        }}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────

function StatsBar({ stats }) {
  const items = [
    { icon: Users,        label: 'Total CAs',   value: stats.total,     color: 'var(--primary)'   },
    { icon: CheckCircle2, label: 'Available',   value: stats.available, color: 'var(--success)'   },
    { icon: Activity,     label: 'On Task',     value: stats.onTask,    color: 'var(--warning)'   },
    { icon: WifiOff,      label: 'Offline',     value: stats.offline,   color: 'var(--error)'     },
    { icon: Heart,        label: 'Tasks This Week', value: stats.tasks, color: 'var(--secondary)' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
      gap: 10, marginBottom: 20,
    }}>
      {items.map(({ icon: Icon, label, value, color }) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'var(--base-100)',
            border: '1px solid var(--base-300)',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={13} style={{ color }} />
            <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)', fontWeight: 600 }}>{label}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export default function CareAssistantAvailabilityCalendar() {
  const dispatch = useDispatch();

  // Redux state
  const user         = useSelector(selectUser);
  const weeklyData   = useSelector(selectCareAssistantWeekly);
  const tasks        = useSelector(selectCareAssistantTasks);
  const isOnline     = useSelector(selectCareAssistantIsOnline);
  const status       = useSelector(selectCareAssistantStatus);
  const loading      = useSelector(selectAvailabilityLoading);
  const error        = useSelector(selectAvailabilityError);

  // Local state
  const [baseDate,          setBaseDate]          = useState(new Date());
  const [selectedTask,      setSelectedTask]      = useState(null);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [statusFilter,      setStatusFilter]      = useState('all');
  const [refreshing,        setRefreshing]        = useState(false);

  const role = user?.role ?? 'care assistant';

  // Mock multi-CA data for hospital view (replace with real API when available)
  const [allAssistants] = useState(() => {
    if (role !== 'hospital') return [];
    const names     = ['Priya Sharma','Kavitha Reddy','Meena Rao','Anita Naidu','Sravani Devi'];
    const statuses  = ['Available','On-Task','Available','On-Break','Offline'];
    const workTypes = ['Full-Time','Part-Time','Full-Time','On-Call','Part-Time'];
    return names.map((fullName, i) => ({
      _id:      `mock-${i}`,
      fullName,
      status:   statuses[i],
      workType: workTypes[i],
      availability: { isOnline: i < 3 },
      weeklySchedule: {
        monday:    { isAvailable: i !== 4, startTime: `0${7+i}:00`, endTime: `${15+i}:00`, maxHoursPerDay: 8 },
        tuesday:   { isAvailable: i !== 4, startTime: `0${7+i}:00`, endTime: `${15+i}:00`, maxHoursPerDay: 8 },
        wednesday: { isAvailable: i % 2 === 0, startTime: `0${8+i}:00`, endTime: `${16+i}:00`, maxHoursPerDay: 8 },
        thursday:  { isAvailable: i !== 4, startTime: `0${7+i}:00`, endTime: `${15+i}:00`, maxHoursPerDay: 8 },
        friday:    { isAvailable: true,    startTime: `09:00`,        endTime: `17:00`,        maxHoursPerDay: 8 },
        saturday:  { isAvailable: i < 2,   startTime: `09:00`,        endTime: `14:00`,        maxHoursPerDay: 5 },
        sunday:    { isAvailable: false },
      },
      tasks: i < 3 ? [
        {
          _id: `task-${i}-1`,
          patientInfo: { name: ['Raju Verma','Lakshmi Bai','Anand Kumar'][i % 3] },
          scheduledAt: new Date(Date.now() + (i+1) * 86400000 * (i+1) / 2).toISOString(),
          bookingType: 'care_assistant',
          status: 'confirmed',
        },
        {
          _id: `task-${i}-2`,
          patientInfo: { name: ['Suresh Pillai','Durga Devi','Venkat Rao'][i % 3] },
          scheduledAt: new Date(Date.now() + (i+2) * 86400000).toISOString(),
          bookingType: 'full_care_ride',
          status: 'pending',
        },
      ] : [],
    }));
  });

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

  useEffect(() => {
    if (role === 'care assistant') {
      dispatch(fetchCareAssistantWeekly());
      dispatch(fetchCareAssistantTasks({ days: 14 }));
    }
  }, [dispatch, role]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (role === 'care assistant') {
      await Promise.all([
        dispatch(fetchCareAssistantWeekly()),
        dispatch(fetchCareAssistantTasks({ days: 14 })),
      ]);
    }
    setTimeout(() => setRefreshing(false), 600);
  }, [dispatch, role]);

  const navWeek = (dir) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dir * 7);
    setBaseDate(d);
  };

  // Hospital stats
  const stats = useMemo(() => {
    if (role !== 'hospital') return null;
    const list = filteredAssistants;
    return {
      total:     allAssistants.length,
      available: allAssistants.filter(a => a.status === 'Available').length,
      onTask:    allAssistants.filter(a => a.status === 'On-Task').length,
      offline:   allAssistants.filter(a => a.status === 'Offline' || a.status === 'On-Break').length,
      tasks:     allAssistants.reduce((s, a) => s + (a.tasks?.length ?? 0), 0),
    };
  }, [allAssistants, role]);

  const filteredAssistants = useMemo(() => {
    if (statusFilter === 'all') return allAssistants;
    return allAssistants.filter(a => a.status === statusFilter);
  }, [allAssistants, statusFilter]);

  // Week label
  const weekLabel = useMemo(() => {
    const s = weekDates[0], e = weekDates[6];
    if (s.getMonth() === e.getMonth())
      return `${s.getDate()} – ${e.getDate()} ${s.toLocaleString('en-IN', { month: 'long' })} ${s.getFullYear()}`;
    return `${formatDate(s)} – ${formatDate(e)}`;
  }, [weekDates]);

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div
      data-theme="care-assistant"
      style={{
        minHeight: '100vh',
        background: 'var(--base-200)',
        fontFamily: 'var(--font-family-poppins)',
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'color-mix(in srgb, var(--primary) 20%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Heart size={20} style={{ color: 'var(--primary)' }} />
                </div>
                <h1 style={{
                  fontFamily: 'var(--font-family-montserrat)',
                  fontSize: 24, fontWeight: 800,
                  color: 'var(--base-content)', margin: 0,
                }}>
                  {role === 'hospital' ? 'Care Team Availability' : 'My Availability'}
                </h1>
              </div>
              <p style={{ fontSize: 13, color: 'color-mix(in srgb, var(--base-content) 55%, transparent)', margin: 0 }}>
                {role === 'hospital'
                  ? 'Weekly schedule overview for all care assistants'
                  : 'Manage your weekly schedule and upcoming tasks'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Online status (self only) */}
              {role === 'care assistant' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--base-100)',
                  border: '1px solid var(--base-300)',
                  borderRadius: 10, padding: '8px 14px',
                }}>
                  <OnlineDot isOnline={isOnline} />
                  <StatusPill status={status} />
                </div>
              )}

              {/* Refresh */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={handleRefresh}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--base-100)', border: '1px solid var(--base-300)',
                  borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
                  color: 'var(--base-content)', fontSize: 13, fontWeight: 600,
                }}
              >
                <motion.div animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.6 }}>
                  <RefreshCw size={14} />
                </motion.div>
                Refresh
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="alert alert-error"
            style={{ marginBottom: 16, borderRadius: 12 }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* ── Hospital: Stats bar ───────────────────────────────────────────── */}
        {role === 'hospital' && stats && <StatsBar stats={stats} />}

        {/* ── Week navigation ────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              { dir: -1, icon: ChevronLeft  },
              { dir:  1, icon: ChevronRight },
            ].map(({ dir, icon: Icon }) => (
              <motion.button
                key={dir}
                whileTap={{ scale: 0.9 }}
                onClick={() => navWeek(dir)}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--base-100)', border: '1px solid var(--base-300)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--base-content)',
                }}
              >
                <Icon size={18} />
              </motion.button>
            ))}
            <button
              onClick={() => setBaseDate(new Date())}
              style={{
                padding: '6px 14px', borderRadius: 10, fontSize: 12,
                fontWeight: 700, cursor: 'pointer',
                background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
                color: 'var(--primary)',
              }}
            >
              Today
            </button>
          </div>

          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--base-content)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} style={{ color: 'var(--primary)' }} />
            {weekLabel}
          </div>

          {/* Hospital: status filter */}
          {role === 'hospital' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {['all','Available','On-Task','Offline'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', transition: '0.2s',
                    background: statusFilter === f ? 'var(--primary)' : 'var(--base-100)',
                    color: statusFilter === f ? 'var(--primary-content)' : 'var(--base-content)',
                    border: `1px solid ${statusFilter === f ? 'var(--primary)' : 'var(--base-300)'}`,
                  }}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Loading skeleton ──────────────────────────────────────────────── */}
        {loading && !refreshing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 20 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
                className="skeleton"
                style={{ height: 160, borderRadius: 12 }}
              />
            ))}
          </div>
        )}

        {/* ── SELF VIEW (care assistant) ─────────────────────────────────────── */}
        {role === 'care assistant' && !loading && (
          <>
            {/* 7-day calendar grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 10, marginBottom: 24,
            }}>
              {weekDates.map((date, i) => (
                <SelfDayCell
                  key={i}
                  date={date}
                  dayKey={DAY_KEYS[i]}
                  schedule={weeklyData}
                  tasks={tasks}
                />
              ))}
            </div>

            {/* Upcoming tasks list */}
            {tasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--base-100)',
                  border: '1px solid var(--base-300)',
                  borderRadius: 16, overflow: 'hidden',
                }}
              >
                <div style={{
                  padding: '14px 20px',
                  background: 'color-mix(in srgb, var(--primary) 8%, var(--base-200))',
                  borderBottom: '1px solid var(--base-300)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Heart size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--base-content)' }}>
                    Upcoming Tasks ({tasks.length})
                  </span>
                </div>
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {tasks.map(t => (
                    <TaskChip key={t._id} task={t} onClick={setSelectedTask} />
                  ))}
                </div>
              </motion.div>
            )}

            {tasks.length === 0 && !loading && (
              <div style={{
                textAlign: 'center', padding: '32px 20px',
                color: 'color-mix(in srgb, var(--base-content) 40%, transparent)',
                fontSize: 14, fontStyle: 'italic',
              }}>
                No upcoming tasks this week
              </div>
            )}
          </>
        )}

        {/* ── HOSPITAL VIEW ──────────────────────────────────────────────────── */}
        {role === 'hospital' && !loading && (
          <>
            {/* Day header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '260px repeat(7, 1fr)',
              gap: 0,
              marginBottom: 10,
              padding: '0 0 0 0',
            }}>
              <div />
              {weekDates.map((date, i) => (
                <div key={i} style={{
                  textAlign: 'center', padding: '8px 4px',
                  fontSize: 11, fontWeight: 700,
                  color: isToday(date) ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content) 55%, transparent)',
                  background: isToday(date) ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                  borderRadius: isToday(date) ? 8 : 0,
                }}>
                  <div style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DAY_LABELS[i]}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: isToday(date) ? 'var(--primary)' : 'var(--base-content)' }}>
                    {date.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Rows */}
            {filteredAssistants.map((assistant, idx) => (
              <AssistantRow
                key={assistant._id}
                assistant={assistant}
                weekDates={weekDates}
                colorIdx={idx}
                onSelect={setSelectedAssistant}
              />
            ))}

            {filteredAssistants.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '40px 20px',
                color: 'color-mix(in srgb, var(--base-content) 40%, transparent)',
                fontSize: 14,
              }}>
                No care assistants match the current filter.
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      <AssistantDetailPanel
        assistant={selectedAssistant}
        weekDates={weekDates}
        onClose={() => setSelectedAssistant(null)}
      />
    </div>
  );
}