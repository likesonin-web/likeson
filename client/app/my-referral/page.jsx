'use client';

 
import Container from "@/components/ui/Container";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Gift, Copy, Check, Coins, TrendingUp, Users,
  Wallet, ChevronRight, RefreshCw, Sparkles,
  ArrowDownToLine, Star, Zap, Clock, BadgeCheck,
  Share2, ExternalLink, Trophy, Crown, ArrowUpRight,
  Flame, Download, ImageIcon, MessageCircle,
} from 'lucide-react';

import {
  getReferralCode,
  redeemCoins,
  selectReferral,
  selectLoaders,
  selectWalletBalance,
} from '@/store/slices/userSlice';
import BackButton from "../../components/BackButton";

// ─── Constants ───────────────────────────────────────────────────────────────
const COINS_PER_RUPEE = 100;
const MIN_REDEEM      = 500;
const BASE_URL        = process.env.NEXT_PUBLIC_FORNTEND_URL ?? 'https://app.likenson.com';

// ─── WhatsApp caption templates ──────────────────────────────────────────────
const WA_CAPTIONS = (code, link) => [
  {
    id: 'reward',
    label: '🎁 Reward Focus',
    text:
      `🌟 *Join Likenson Healthcare & Get ₹5 FREE!*\n\n` +
      `India's most trusted health platform is rewarding you!\n\n` +
      `✅ Order medicines at doorstep\n` +
      `✅ Book doctor consultations online\n` +
      `✅ Affordable lab tests at home\n\n` +
      `👉 Use my referral code *${code}* while signing up:\n` +
      `${link}\n\n` +
      `💰 *You get ₹5 instantly + I earn ₹10 too!*\n` +
      `No catch. Just sign up and enjoy healthcare made simple. 🏥`,
  },
  {
    id: 'casual',
    label: '💬 Casual & Friendly',
    text:
      `Hey! 👋 I've been using *Likenson Healthcare* for my medicines and doctor consultations — super easy and reliable!\n\n` +
      `They're giving *₹5 free wallet cash* to anyone who signs up with my code.\n\n` +
      `🔑 Code: *${code}*\n` +
      `🔗 ${link}\n\n` +
      `Takes 2 minutes. Give it a try! 😊`,
  },
  {
    id: 'urgent',
    label: '⚡ Urgency / FOMO',
    text:
      `⚠️ *Limited time! Free ₹5 on Likenson Healthcare!*\n\n` +
      `Sign up NOW using my referral code and get ₹5 instantly in your health wallet.\n\n` +
      `💊 Medicines | 🩺 Doctors | 🧪 Lab Tests — all at your fingertips.\n\n` +
      `🔑 Referral Code: *${code}*\n` +
      `➡️ Register here: ${link}\n\n` +
      `Don't miss this — share with family too! 🙏`,
  },
];

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '' }) {
  const mv        = useMotionValue(0);
  const formatted = useTransform(mv, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);
  const [display, setDisplay] = useState(`${prefix}${(0).toFixed(decimals)}${suffix}`);

  useEffect(() => {
    const c = animate(mv, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    const u = formatted.on('change', setDisplay);
    return () => { c.stop(); u(); };
  }, [value]);

  return <span>{display}</span>;
}

// ─── Particle Field ───────────────────────────────────────────────────────────
function ParticleField() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: `${3 + (i * 3.2) % 94}%`,
    y: `${5 + (i * 6.3) % 88}%`,
    size: 1.5 + (i % 5) * 0.8,
    delay: (i * 0.22) % 4,
    dur: 3 + (i % 4) * 0.9,
    opacity: 0.1 + (i % 4) * 0.08,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x, top: p.y,
            width: p.size, height: p.size,
            background: p.id % 3 === 0
              ? 'rgba(253,230,138,0.6)'
              : p.id % 3 === 1
              ? 'rgba(255,255,255,0.35)'
              : 'rgba(147,197,253,0.4)',
          }}
          animate={{
            opacity: [p.opacity, p.opacity * 5, p.opacity],
            scale: [0.7, 1.6, 0.7],
            y: [0, -(8 + (p.id % 3) * 6), 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Large glow orbs */}
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        top: '-20%', right: '-5%',
        background: 'radial-gradient(circle, rgba(99,179,237,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        bottom: '-15%', left: '10%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ─── Real 3D Coin ─────────────────────────────────────────────────────────────
function RealCoin3D({ size = 120 }) {
  // Coin dimensions
  const thickness = size * 0.12; 
  const radius = size / 2;
  
  // Edge polygon calculations
  const edgeFaces = 60;
  const angle = 360 / edgeFaces;
  const edgeWidth = 2 * radius * Math.tan(Math.PI / edgeFaces) + 0.5;

  // Direct, hardcoded IDs for the SVG paths
  const frontPathId = "coin-front-path";
  const backPathId = "coin-back-path";

  // Reusable metallic finish
  const goldFinish = `
    radial-gradient(circle at 50% 50%, transparent 65%, rgba(120,53,15,0.8) 95%, #78350f 100%),
    conic-gradient(from 25deg, #b45309 0deg, #fef08a 45deg, #b45309 90deg, #78350f 135deg, #b45309 180deg, #fef08a 225deg, #b45309 270deg, #78350f 315deg, #b45309 360deg)
  `;

  // Reusable Circular Text Component
  const CircularText = ({ pathId }) => (
    <svg 
      viewBox="0 0 100 100" 
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2 }}
    >
      <defs>
        {/* Draws an invisible circle with a radius of 34 centered at 50,50 */}
        <path 
          id={pathId} 
          d="M 50, 50 m -34, 0 a 34,34 0 1,1 68,0 a 34,34 0 1,1 -68,0" 
        />
      </defs>
      <text 
        fill="#b45309" 
        fontSize="7.5" 
        fontWeight="900" 
        letterSpacing="1"
        style={{ textShadow: '0 1px 1px rgba(255,255,255,0.4), 0 -1px 1px rgba(0,0,0,0.5)' }}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          • LIKESON HEALTH CARE • LIKESON HEALTH CARE
        </textPath>
      </text>
    </svg>
  );

  return (
    <div style={{ width: size, height: size, perspective: 1000 }}>
      <motion.div
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          position: 'relative',
        }}
      >
        {/* ── FRONT FACE ── */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          background: goldFinish,
          transform: `translateZ(${thickness / 2}px)`,
          backfaceVisibility: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          border: `${size * 0.03}px solid #d97706`,
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)',
        }}>
          {/* Inner Stamped Ring */}
          <div style={{
            position: 'absolute', inset: size * 0.06,
            borderRadius: '50%', border: `${size * 0.015}px dashed rgba(180,83,9,0.5)`,
          }} />
          
          {/* Circular Text */}
          <CircularText pathId={frontPathId} />

          {/* Center 3D Embossed Rupee */}
          <span style={{
            color: '#fcd34d',
            fontWeight: 900,
            fontSize: size * 0.40,
            lineHeight: 1,
            fontFamily: 'Georgia, serif',
            textShadow: `
              -1px -1px 0 #78350f,
              1px 1px 0 #fef08a,
              0 2px 4px rgba(120,53,15,0.8),
              0 4px 8px rgba(0,0,0,0.4)
            `,
            zIndex: 1,
          }}>
            ₹
          </span>
        </div>

        {/* ── BACK FACE ── */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          background: goldFinish,
          transform: `rotateY(180deg) translateZ(${thickness / 2}px)`,
          backfaceVisibility: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `${size * 0.03}px solid #d97706`,
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)',
        }}>
          {/* Inner Stamped Ring */}
          <div style={{
            position: 'absolute', inset: size * 0.06,
            borderRadius: '50%', border: `${size * 0.015}px dashed rgba(180,83,9,0.5)`,
          }} />

          {/* Circular Text */}
          <CircularText pathId={backPathId} />
          
          <div style={{
            width: '45%', height: '45%',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(180,83,9,0.1)',
            boxShadow: 'inset 0 2px 6px rgba(120,53,15,0.6), 0 2px 4px rgba(255,255,255,0.3)',
            zIndex: 1,
          }}>
            <span style={{
              color: '#fcd34d', fontSize: size * 0.25, fontWeight: 900,
              textShadow: '-1px -1px 0 #78350f, 1px 1px 0 #fef08a',
            }}>
              L
            </span>
          </div>
        </div>

        {/* ── EDGE (The Ridges / Milling) ── */}
        {Array.from({ length: edgeFaces }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: edgeWidth,
            height: thickness,
            left: '50%',
            top: '50%',
            marginLeft: -edgeWidth / 2,
            marginTop: -thickness / 2,
            background: 'linear-gradient(to right, #92400e 0%, #fcd34d 50%, #78350f 100%)',
            transform: `rotateZ(${i * angle}deg) translateY(${-radius}px) rotateX(90deg)`,
            backfaceVisibility: 'hidden',
          }} />
        ))}
      </motion.div>
    </div>
  );
}

// ─── Orbiting Coin Ring ────────────────────────────────────────────────────────
function CoinOrbitSystem() {
  return (
    <div style={{ position: 'relative', width: 240, height: 240, aspectRatio: '1 / 1', flexShrink: 0 }}>
      {/* Outer glow */}
      <div style={{
        position: 'absolute', inset: -20,
        background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(20px)',
      }} />

      {/* Orbit ring 1 (Mini Gold Coins) */}
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: 16 }}
      >
        {/* The visual dashed track */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '1.5px dashed rgba(245,158,11,0.25)',
        }} />

        {/* Coins locked perfectly to the bounding box */}
        {[0, 120, 240].map((angle, i) => (
          <div key={i} style={{
            position: 'absolute',
            inset: 0, // Matches the exact size of the dashed track
            transform: `rotate(${angle}deg)`, // Rotates the invisible box
          }}>
            <div style={{
              position: 'absolute',
              top: 0, left: '50%', // Pins exactly to the top-center edge of the box
              transform: 'translate(-50%, -50%)', // Centers the coin on that line flawlessly
              zIndex: 20,
            }}>
              {/* COUNTER-ROTATION: Upgraded to keep the '₹' perfectly upright */}
              <motion.div
                initial={{ rotate: -angle }} // Offsets the static spoke angle
                animate={{ rotate: [-angle, -360 - angle] }} // Counters the orbit
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #fef08a 0%, #f59e0b 45%, #b45309 80%, #78350f 100%)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 6px rgba(0,0,0,0.3), 0 0 10px rgba(245,158,11,0.5)',
                  border: '1px solid #d97706',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 900, color: '#fcd34d',
                  textShadow: '-1px -1px 0 #78350f, 1px 1px 0 #fef08a',
                }}>
                  ₹
                </span>
              </motion.div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Orbit ring 2 (Blue Gems) */}
      <motion.div
        animate={{ rotate: [360, 0] }} // Rotates Counter-Clockwise
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: 48 }}
      >
        {/* The visual dashed track */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '1px dashed rgba(99,179,237,0.2)',
        }} />

        {[60, 210].map((angle, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0,
            transform: `rotate(${angle}deg)`,
          }}>
            <div style={{
              position: 'absolute', top: 0, left: '50%',
              transform: 'translate(-50%, -50%)',
            }}>
               {/* Counter-rotation to keep the lighting highlight facing top-left */}
              <motion.div
                initial={{ rotate: -angle }}
                animate={{ rotate: [-angle, 360 - angle] }} // Counters CCW rotation
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 14, height: 14,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #bfdbfe 0%, #3b82f6 50%, #1e40af 100%)',
                  boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.7), 0 2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(59,130,246,0.5)',
                }}
              />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Center main coin */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
      }}>
        <RealCoin3D size={110} />
      </div>
    </div>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ value, label = 'Copy', size = 'md' }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch {}
  }, [value]);
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <motion.button onClick={handle} whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.04 }}
      className={`flex items-center gap-1.5 rounded-xl font-bold transition-all duration-200 ${pad}`}
      style={{
        background: copied ? 'color-mix(in oklch,var(--success) 18%,var(--base-200))' : 'color-mix(in oklch,var(--primary) 12%,var(--base-200))',
        color: copied ? 'var(--success)' : 'var(--primary)',
        border: `1.5px solid ${copied ? 'color-mix(in oklch,var(--success) 38%,transparent)' : 'color-mix(in oklch,var(--primary) 32%,transparent)'}`,
      }}>
      <AnimatePresence mode="wait">
        {copied
          ? <motion.span key="chk" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Check size={13} /></motion.span>
          : <motion.span key="cpy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={13} /></motion.span>
        }
      </AnimatePresence>
      {copied ? 'Copied!' : label}
    </motion.button>
  );
}

// ─── Rank Badge ───────────────────────────────────────────────────────────────
function RankBadge({ referrals }) {
  const tier =
    referrals >= 20 ? { label: 'Diamond', color: '#38bdf8', icon: Crown } :
    referrals >= 10 ? { label: 'Gold',    color: '#f59e0b', icon: Trophy } :
    referrals >= 5  ? { label: 'Silver',  color: '#94a3b8', icon: Star } :
                      { label: 'Bronze',  color: '#c2713f', icon: Flame };
  const Icon = tier.icon;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs"
      style={{ background: `color-mix(in oklch,${tier.color} 14%,var(--base-200))`, color: tier.color, border: `1px solid color-mix(in oklch,${tier.color} 30%,transparent)` }}>
      <Icon size={12} />{tier.label}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, delay = 0, prefix = '', suffix = '', decimals = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-3xl p-5"
      style={{
        background: 'var(--base-100)',
        border: `1.5px solid color-mix(in oklch,${color} 22%,var(--base-300))`,
        boxShadow: `0 4px 24px color-mix(in oklch,${color} 10%,transparent)`,
      }}>
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
        style={{ background: `color-mix(in oklch,${color} 12%,transparent)`, filter: 'blur(20px)' }} />
      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-3xl"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)`, opacity: 0.5 }} />
      <div className="relative z-10">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
          style={{
            background: `color-mix(in oklch,${color} 15%,var(--base-200))`,
            boxShadow: `0 4px 12px color-mix(in oklch,${color} 20%,transparent)`,
          }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div className="text-2xl font-black font-montserrat" style={{ color: 'var(--base-content)' }}>
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        </div>
        <div className="text-xs font-semibold mt-0.5" style={{ color: 'color-mix(in oklch,var(--base-content) 50%,transparent)' }}>{label}</div>
        {sub && <div className="text-xs mt-0.5 font-medium" style={{ color }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl px-4 py-3 shadow-xl text-sm"
      style={{ background: 'var(--base-100)', border: '1.5px solid color-mix(in oklch,var(--primary) 28%,var(--base-300))', color: 'var(--base-content)' }}>
      <div className="font-bold mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'color-mix(in oklch,var(--base-content) 60%,transparent)' }}>{p.name}:</span>
          <span className="font-bold">{p.name === 'Rupees' ? `₹${p.value}` : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Redeem Modal ─────────────────────────────────────────────────────────────
function RedeemModal({ coins, onClose, onConfirm, loading }) {
  const [amount, setAmount] = useState(Math.min(MIN_REDEEM, coins));
  const rupees  = +(amount / COINS_PER_RUPEE).toFixed(2);
  const invalid = amount < MIN_REDEEM || amount > coins;
  const presets = [500, 1000, 2000, 5000].filter((p) => p <= coins);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} onClick={onClose} />
      <motion.div className="relative z-10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--base-100)', border: '1.5px solid color-mix(in oklch,var(--warning) 35%,var(--base-300))' }}
        initial={{ scale: 0.88, y: 60, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,var(--warning),var(--accent),var(--primary))' }} />
        <div className="p-7">
          <div className="flex items-center gap-3 mb-6">
            <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'color-mix(in oklch,var(--warning) 18%,var(--base-200))' }}>
              <Coins size={24} style={{ color: 'var(--warning)' }} />
            </motion.div>
            <div>
              <h3 className="font-montserrat font-black text-xl" style={{ color: 'var(--base-content)' }}>Redeem Coins</h3>
              <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch,var(--base-content) 50%,transparent)' }}>
                Min {MIN_REDEEM} coins · {COINS_PER_RUPEE} coins = ₹1
              </p>
            </div>
          </div>
          <div className="rounded-2xl p-5 text-center mb-5"
            style={{ background: 'linear-gradient(135deg,color-mix(in oklch,var(--warning) 10%,var(--base-200)),color-mix(in oklch,var(--accent) 8%,var(--base-200)))' }}>
            <div className="text-4xl font-black font-montserrat" style={{ color: 'var(--base-content)' }}>{amount.toLocaleString()}</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: 'color-mix(in oklch,var(--base-content) 50%,transparent)' }}>coins</div>
            <div className="text-xl font-bold mt-2" style={{ color: 'var(--success)' }}>→ ₹{rupees} to wallet</div>
          </div>
          {presets.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {presets.map((p) => (
                <motion.button key={p} whileTap={{ scale: 0.93 }} onClick={() => setAmount(p)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{ background: amount === p ? 'var(--primary)' : 'var(--base-200)', color: amount === p ? 'var(--primary-content)' : 'color-mix(in oklch,var(--base-content) 65%,transparent)' }}>
                  {p}
                </motion.button>
              ))}
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => setAmount(coins)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: amount === coins ? 'var(--primary)' : 'var(--base-200)', color: amount === coins ? 'var(--primary-content)' : 'color-mix(in oklch,var(--base-content) 65%,transparent)' }}>
                Max
              </motion.button>
            </div>
          )}
          <div className="mb-6">
            <div className="flex justify-between text-xs font-semibold mb-2" style={{ color: 'color-mix(in oklch,var(--base-content) 50%,transparent)' }}>
              <span>{MIN_REDEEM}</span><span>{coins}</span>
            </div>
            <input type="range" min={MIN_REDEEM} max={coins} step={100} value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--warning)' }} />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl font-bold text-sm"
              style={{ background: 'var(--base-200)', color: 'color-mix(in oklch,var(--base-content) 65%,transparent)' }}>
              Cancel
            </button>
            <motion.button onClick={() => onConfirm(amount)} disabled={invalid || loading} whileTap={{ scale: 0.97 }}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
              style={{
                background: invalid ? 'var(--base-300)' : 'linear-gradient(135deg,var(--warning),var(--accent))',
                color: invalid ? 'color-mix(in oklch,var(--base-content) 40%,transparent)' : '#78350f',
                cursor: invalid ? 'not-allowed' : 'pointer',
                boxShadow: invalid ? 'none' : '0 4px 16px rgba(245,158,11,0.35)',
              }}>
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <><ArrowDownToLine size={16} />Redeem</>}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Share Banner ─────────────────────────────────────────────────────────────
function ShareBanner({ referralCode, totalReferrals = 0, coinsEarned = 0 }) {
  const bannerRef  = useRef(null);
  const signupLink = `${BASE_URL}/signup?ref=${referralCode}`;

  const [captionIdx, setCaptionIdx]       = useState(0);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [downloading, setDownloading]     = useState(false);
  const [downloaded,  setDownloaded]      = useState(false);
  const [showBanner,  setShowBanner]      = useState(false);

  const captions = WA_CAPTIONS(referralCode, signupLink);
  const currentCaption = captions[captionIdx].text;

  const handleDownload = useCallback(async () => {
    if (!bannerRef.current || downloading) return;
    setDownloading(true);
    try {
      const h2c = (await import('html2canvas')).default;
      const canvas = await h2c(bannerRef.current, {
        scale: 2, useCORS: true, backgroundColor: null, logging: false,
      });
      const a = document.createElement('a');
      a.download = `likenson-referral-${referralCode}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (e) {
      console.error('Banner export failed', e);
    } finally {
      setDownloading(false);
    }
  }, [referralCode, downloading]);

  const handleCopyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentCaption);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2200);
    } catch {}
  }, [currentCaption]);

  const handleWhatsApp = useCallback(() => {
    const url = `https://wa.me/?text=${encodeURIComponent(currentCaption)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [currentCaption]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.72 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--base-100)', border: '1.5px solid var(--base-300)' }}>

      <div className="px-6 py-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg,color-mix(in oklch,var(--primary) 8%,var(--base-100)),color-mix(in oklch,var(--secondary) 6%,var(--base-100)))', borderBottom: '1px solid var(--base-300)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'color-mix(in oklch,var(--primary) 15%,var(--base-200))' }}>
          <Share2 size={17} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <div className="font-montserrat font-black text-base" style={{ color: 'var(--base-content)' }}>Share &amp; Earn</div>
          <div className="text-xs" style={{ color: 'color-mix(in oklch,var(--base-content) 50%,transparent)' }}>
            You earn ₹100 · Friend earns ₹50 · No limit
          </div>
        </div>
        <div className="ml-auto">
          <span className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: 'color-mix(in oklch,var(--warning) 15%,var(--base-200))', color: 'var(--warning)' }}>
            <Star size={11} fill="currentColor" /> Unlimited
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Referral Code pill */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'color-mix(in oklch,var(--base-content) 45%,transparent)' }}>Your Referral Code</div>
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3"
            style={{ background: 'var(--base-200)', border: '1.5px dashed color-mix(in oklch,var(--primary) 35%,transparent)' }}>
            <span className="font-montserrat font-black text-2xl tracking-[0.25em]" style={{ color: 'var(--primary)' }}>
              {referralCode}
            </span>
            <div className="ml-auto flex gap-2">
              <CopyButton value={referralCode} label="Copy Code" />
            </div>
          </div>
        </div>

        {/* Signup link */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'color-mix(in oklch,var(--base-content) 45%,transparent)' }}>Direct Signup Link</div>
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}>
            <ExternalLink size={14} style={{ color: 'color-mix(in oklch,var(--base-content) 40%,transparent)', flexShrink: 0 }} />
            <span className="text-xs font-mono truncate flex-1"
              style={{ color: 'color-mix(in oklch,var(--base-content) 60%,transparent)' }}>
              {signupLink}
            </span>
            <CopyButton value={signupLink} label="Copy Link" size="sm" />
          </div>
        </div>
 

        {/* Caption Selector */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'color-mix(in oklch,var(--base-content) 45%,transparent)' }}>
            WhatsApp Caption Templates
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {captions.map((c, i) => (
              <button key={c.id} onClick={() => setCaptionIdx(i)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: captionIdx === i ? 'var(--primary)' : 'var(--base-200)', color: captionIdx === i ? 'var(--primary-content)' : 'color-mix(in oklch,var(--base-content) 65%,transparent)' }}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="rounded-2xl p-4 mb-3 text-xs leading-relaxed whitespace-pre-wrap"
            style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'color-mix(in oklch,var(--base-content) 75%,transparent)', maxHeight: 160, overflow: 'auto' }}>
            {currentCaption}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <motion.button onClick={handleWhatsApp} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', boxShadow: '0 4px 16px rgba(37,211,102,0.28)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.938l6.304-1.652C8.012 23.406 9.972 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.882 0-3.63-.502-5.143-1.38l-.369-.219-3.78.99 1.009-3.684-.24-.378C2.55 15.762 2 13.943 2 12 2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              Share Text
            </motion.button>
            <motion.button onClick={handleCopyCaption} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm transition-all"
              style={{ background: captionCopied ? 'color-mix(in oklch,var(--success) 15%,var(--base-200))' : 'var(--base-200)', color: captionCopied ? 'var(--success)' : 'var(--base-content)', border: `1.5px solid ${captionCopied ? 'color-mix(in oklch,var(--success) 30%,transparent)' : 'var(--base-300)'}` }}>
              <AnimatePresence mode="wait">
                {captionCopied ? <motion.span key="chk" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={16} /></motion.span> : <motion.span key="cpy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><MessageCircle size={16} /></motion.span>}
              </AnimatePresence>
              {captionCopied ? 'Caption Copied!' : 'Copy Caption'}
            </motion.button>
            <motion.a href={signupLink} target="_blank" rel="noopener noreferrer"
              whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--secondary))', color: 'var(--primary-content)', boxShadow: '0 4px 16px color-mix(in oklch,var(--primary) 28%,transparent)' }}>
              <ArrowUpRight size={17} /> Open Link
            </motion.a>
          </div>
         
        </div>

        {/* Brand panel */}
        <div className="rounded-2xl p-5 flex gap-4 items-center"
          style={{ background: 'linear-gradient(135deg,color-mix(in oklch,var(--primary) 6%,var(--base-100)),color-mix(in oklch,var(--secondary) 5%,var(--base-100)))', border: '1.5px solid color-mix(in oklch,var(--primary) 18%,var(--base-300))' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-montserrat font-black text-xl"
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--secondary))', color: 'var(--primary-content)', boxShadow: '0 4px 12px color-mix(in oklch,var(--primary) 28%,transparent)' }}>L</div>
          <div className="flex-1 min-w-0">
            <div className="font-montserrat font-black text-base mb-0.5" style={{ color: 'var(--base-content)' }}>Likenson Healthcare</div>
            <div className="text-xs leading-relaxed" style={{ color: 'color-mix(in oklch,var(--base-content) 60%,transparent)' }}>India's trusted platform for medicine delivery, doctor consultations &amp; health packages.</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {['Medicine Delivery', 'Consultations', 'Lab Tests'].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'color-mix(in oklch,var(--primary) 10%,var(--base-200))', color: 'var(--primary)' }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function MyReferral() {
  const dispatch      = useDispatch();
  const referral      = useSelector(selectReferral);
  const loaders       = useSelector(selectLoaders);
  const walletBalance = useSelector(selectWalletBalance);

  const [showRedeem, setShowRedeem] = useState(false);
  const [activeTab,  setActiveTab]  = useState('overview');

  const isLoadingReferral = loaders.referralCode;
  const isRedeeming       = loaders.redeemCoins;

  useEffect(() => { dispatch(getReferralCode()); }, [dispatch]);

  const handleRedeem = useCallback(async (coins) => {
    await dispatch(redeemCoins(coins));
    setShowRedeem(false);
    dispatch(getReferralCode());
  }, [dispatch]);

  const chartData = (() => {
    if (!referral.referralHistory?.length) return [
      { month: 'Jan', Coins: 0, Rupees: 0 },
      { month: 'Feb', Coins: 0, Rupees: 0 },
      { month: 'Mar', Coins: 0, Rupees: 0 },
    ];
    const map = {};
    referral.referralHistory.forEach((e) => {
      const k = new Date(e.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!map[k]) map[k] = { month: k, Coins: 0, Rupees: 0 };
      map[k].Coins  += e.coinsAwarded ?? 0;
      map[k].Rupees  = +((map[k].Coins) / COINS_PER_RUPEE).toFixed(2);
    });
    return Object.values(map);
  })();

  const totalCoinsInRupees = +(( referral.coins ?? 0) / COINS_PER_RUPEE).toFixed(2);
  const canRedeem          = (referral.coins ?? 0) >= MIN_REDEEM;

  return (

    <Container className=''>
    <div className="min-h-screen font-poppins" >

      {/* ══════════════════════════════════════════════════════════
          HERO — Fixed layout, proper alignment
          ══════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden h-fit bg-gradient-to-br from-primary to-primary/10 "
         
      >
        {/* Noise texture */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.06,
             
            backgroundSize: '200px',
          }} />
        {/* Decorative circles */}
        <div className="absolute pointer-events-none" style={{ width: 600, height: 600, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: -300, right: -200 }} />
        <div className="absolute pointer-events-none" style={{ width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', bottom: -160, left: -80 }} />
        {/* Glow spots */}
        <div className="absolute pointer-events-none" style={{ width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,0.15) 0%,transparent 70%)', top: '10%', right: '15%', filter: 'blur(40px)' }} />
        <div className="absolute pointer-events-none" style={{ width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,179,237,0.15) 0%,transparent 70%)', bottom: '0%', left: '5%', filter: 'blur(30px)' }} />
        <ParticleField />

        {/* ── Hero Content ── */}
          <BackButton className="m-3" />
        <div className="relative z-10 container-custom pt-10 pb-10">
          {/* Programme label */}
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex items-center gap-2 mb-5"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Sparkles size={12} /> Likenson Rewards Programme
            </div>
          </motion.div>

          {/* Main hero grid: left text | right stats */}
          <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">

            {/* ── LEFT: Title + Code ── */}
            <div className="flex-1 min-w-0">
              <motion.h1
                className="font-montserrat font-black text-white leading-tight mb-2 text-2xl md:text-4xl"
                 
                initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
              >
                My Referrals
              </motion.h1>
              <motion.p
                className="mb-6 text-base "
                style={{ color: 'rgba(255,255,255,0.72)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Invite friends · Earn coins · Redeem instantly
              </motion.p>

              {/* Referral Code pill */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 280, damping: 22 }}
                className="inline-flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(20px)',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                  maxWidth: '100%',
                }}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    Your Referral Code
                  </div>
                  {isLoadingReferral
                    ? <div className="skeleton h-8 w-36 rounded-lg" />
                    : <div className="font-montserrat font-black tracking-[0.2em] text-white text-2xl"  >
                        {referral.referralCode ?? '—'}
                      </div>
                  }
                </div>
                {referral.referralCode && (
                  <div className="flex flex-col gap-2 items-start sm:items-end flex-shrink-0">
                    <CopyButton value={referral.referralCode} label="Copy Code" />
                    <RankBadge referrals={referral.totalReferrals ?? 0} />
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── RIGHT: Two stat chips ── */}
            <motion.div
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="flex flex-row lg:flex-col gap-3 flex-shrink-0"
            >
              {/* Coin balance */}
              <div
                className="rounded-2xl px-5 py-4 text-center min-w-40"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Coin Balance</div>
                <div className="font-montserrat font-black text-3xl text-white">
                  <AnimatedNumber value={referral.coins ?? 0} />
                </div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  = ₹<AnimatedNumber value={totalCoinsInRupees} decimals={2} />
                </div>
              </div>

              {/* Total referrals */}
              <div
                className="rounded-2xl px-5 py-4 text-center min-w-40"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Total Referrals</div>
                <div className="font-montserrat font-black text-2xl text-white">
                  <AnimatedNumber value={referral.totalReferrals ?? 0} />
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Users size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>friends joined</span>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN CONTENT
          ══════════════════════════════════════════════════════════ */}
      <div className="container-custom  mt-10 pb-20 space-y-6">

        {/* ── Coin Wallet Card (REDESIGNED with real 3D coin) ── */}
        <motion.div
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl overflow-hidden  shadow-sm"
          style={{
            background: 'var(--base-100)',
            border: '1.5px solid color-mix(in oklch,var(--warning) 22%,var(--base-300))',
          }}
        >
        

          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">

              {/* Coin orbit system */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <CoinOrbitSystem />
              </div>

              {/* Balance info */}
              <div className="flex-1 text-center md:text-left">
                <div className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: 'color-mix(in oklch,var(--base-content) 45%,transparent)' }}>
                  Available Balance
                </div>
                <div className="font-montserrat font-black" style={{ fontSize: 'clamp(2.5rem,6vw,4rem)', lineHeight: 1.05, color: 'var(--base-content)' }}>
                  <AnimatedNumber value={referral.coins ?? 0} />
                  <span className="text-2xl ml-2 font-bold" style={{ color: 'color-mix(in oklch,var(--base-content) 38%,transparent)' }}>coins</span>
                </div>
                <div className="text-xl font-semibold mt-1" style={{ color: 'var(--success)' }}>
                  ≈ ₹<AnimatedNumber value={totalCoinsInRupees} decimals={2} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                  <span className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"
                    style={{ background: 'color-mix(in oklch,var(--success) 10%,var(--base-200))', color: 'var(--success)' }}>
                    <TrendingUp size={11} /> Earned: <AnimatedNumber value={referral.coinsEarned ?? 0} /> coins
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"
                    style={{ background: 'color-mix(in oklch,var(--info) 10%,var(--base-200))', color: 'var(--info)' }}>
                    <ArrowDownToLine size={11} /> Redeemed: <AnimatedNumber value={referral.coinsRedeemed ?? 0} /> coins
                  </span>
                </div>
              </div>

              {/* Redeem button */}
              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                <motion.button
                  onClick={() => canRedeem && setShowRedeem(true)}
                  whileHover={canRedeem ? { scale: 1.05, y: -2 } : {}}
                  whileTap={canRedeem ? { scale: 0.97 } : {}}
                  disabled={!canRedeem}
                  className="relative overflow-hidden flex items-center gap-3 px-7 py-4 rounded-2xl font-bold text-base"
                  style={{
                    background: canRedeem ? 'linear-gradient(135deg,var(--warning),var(--accent))' : 'var(--base-300)',
                    color: canRedeem ? '#78350f' : 'color-mix(in oklch,var(--base-content) 35%,transparent)',
                    cursor: canRedeem ? 'pointer' : 'not-allowed',
                    boxShadow: canRedeem ? '0 2px 8px rgba(245,158,11,0.4)' : 'none',
                  }}
                >
                  {canRedeem && (
                    <motion.div
                      className="absolute inset-0"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
                      style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)', width: '60%' }}
                    />
                  )}
                  <Wallet size={20} />
                  {canRedeem ? 'Redeem to Wallet' : `Need ${MIN_REDEEM} coins`}
                  {canRedeem && <ChevronRight size={16} />}
                </motion.button>
                {canRedeem && (
                  <div className="text-xs text-center" style={{ color: 'color-mix(in oklch,var(--base-content) 42%,transparent)' }}>
                    Wallet: ₹{walletBalance?.toFixed(2) ?? '0.00'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Referrals"  value={referral.totalReferrals ?? 0} color="var(--primary)"   delay={0.42} />
          <StatCard icon={Coins} label="Coins / Referral" value={1000} sub="You earn ₹10"        color="var(--warning)"   delay={0.5}  />
          <StatCard icon={Gift}  label="Friend's Reward"  value={500}  sub="They earn ₹5"        color="var(--success)"   delay={0.58} />
          <StatCard icon={Zap}   label="Wallet Balance"   value={walletBalance ?? 0} prefix="₹" decimals={2} color="var(--secondary)" delay={0.66} />
        </div>

        {/* ── How It Works ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.56 }}
          className="rounded-3xl p-6 md:p-8"
          style={{ background: 'var(--base-100)', border: '1.5px solid var(--base-300)' }}
        >
          <h2 className="font-montserrat font-black text-xl mb-6" style={{ color: 'var(--base-content)' }}>How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '01', icon: Copy,  title: 'Copy Your Code',    desc: 'Share your unique referral code or direct signup link.',           color: 'var(--primary)' },
              { step: '02', icon: Users, title: 'Friend Signs Up',   desc: 'They register on Likenson using your code or direct link.',         color: 'var(--secondary)' },
              { step: '03', icon: Coins, title: 'Both Get Rewarded', desc: 'You earn 1000 coins (₹10), friend earns 500 coins (₹5). Instant.',  color: 'var(--warning)' },
            ].map((item, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.62 + i * 0.1 }}
                className="relative rounded-2xl p-5"
                style={{ background: 'var(--base-200)' }}
              >
                {i < 2 && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex w-4 h-4 rounded-full items-center justify-center"
                    style={{ background: 'var(--base-300)' }}>
                    <ChevronRight size={10} style={{ color: 'color-mix(in oklch,var(--base-content) 40%,transparent)' }} />
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in oklch,${item.color} 15%,var(--base-300))` }}>
                    <item.icon size={18} style={{ color: item.color }} />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: item.color }}>Step {item.step}</div>
                    <div className="font-bold text-sm mb-1" style={{ color: 'var(--base-content)' }}>{item.title}</div>
                    <div className="text-xs leading-relaxed" style={{ color: 'color-mix(in oklch,var(--base-content) 55%,transparent)' }}>{item.desc}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Share Banner ── */}
        {referral.referralCode && (
          <ShareBanner
            referralCode={referral.referralCode}
            totalReferrals={referral.totalReferrals ?? 0}
            coinsEarned={referral.coinsEarned ?? 0}
          />
        )}

        {/* ── Earnings Chart + History ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.68 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: 'var(--base-100)', border: '1.5px solid var(--base-300)' }}
        >
          <div className="flex border-b" style={{ borderColor: 'var(--base-300)' }}>
            {[
              { key: 'overview', label: 'Earnings Chart',   icon: TrendingUp },
              { key: 'history',  label: 'Referral History', icon: Clock },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="relative flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors duration-200"
                style={{ color: activeTab === tab.key ? 'var(--primary)' : 'color-mix(in oklch,var(--base-content) 50%,transparent)' }}>
                <tab.icon size={15} />
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--primary)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' ? (
              <motion.div key="chart"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}
                className="p-6 md:p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-montserrat font-black text-lg" style={{ color: 'var(--base-content)' }}>Coins Earned Over Time</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch,var(--base-content) 48%,transparent)' }}>Monthly breakdown</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)' }} />Coins</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--success)' }} />Rupees</span>
                  </div>
                </div>
                {isLoadingReferral
                  ? <div className="skeleton h-52 rounded-2xl" />
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="coinsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="rupeesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="var(--success)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="Coins"  name="Coins"  stroke="var(--primary)" strokeWidth={2.5} fill="url(#coinsGrad)"  dot={{ r: 4, fill: 'var(--primary)',  strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="Rupees" name="Rupees" stroke="var(--success)" strokeWidth={2.5} fill="url(#rupeesGrad)" dot={{ r: 4, fill: 'var(--success)', strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )
                }
              </motion.div>
            ) : (
              <motion.div key="history"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}
                className="p-6 md:p-8"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-montserrat font-black text-lg" style={{ color: 'var(--base-content)' }}>Referral History</h3>
                  <span className="text-xs px-3 py-1.5 rounded-full font-bold"
                    style={{ background: 'color-mix(in oklch,var(--primary) 10%,var(--base-200))', color: 'var(--primary)' }}>
                    {referral.referralHistory?.length ?? 0} referrals
                  </span>
                </div>
                {isLoadingReferral ? (
                  <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
                ) : !referral.referralHistory?.length ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'color-mix(in oklch,var(--primary) 8%,var(--base-200))' }}>
                      <Users size={28} style={{ color: 'var(--primary)', opacity: 0.45 }} />
                    </div>
                    <p className="font-bold text-base" style={{ color: 'var(--base-content)' }}>No referrals yet</p>
                    <p className="text-sm mt-1" style={{ color: 'color-mix(in oklch,var(--base-content) 48%,transparent)' }}>Share your code to start earning</p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {referral.referralHistory.map((entry, i) => (
                      <motion.div key={entry._id ?? i}
                        initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.055 }}
                        className="flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-200 cursor-default"
                        style={{ background: 'var(--base-200)', border: '1px solid transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'color-mix(in oklch,var(--primary) 20%,transparent)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                          style={{ background: `color-mix(in oklch,var(--primary) ${14 + (i % 3) * 7}%,var(--base-300))`, color: 'var(--primary)' }}>
                          {(entry.referredUser?.name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate" style={{ color: 'var(--base-content)' }}>{entry.referredUser?.name ?? 'Anonymous'}</div>
                          <div className="text-xs truncate" style={{ color: 'color-mix(in oklch,var(--base-content) 48%,transparent)' }}>{entry.referredUser?.email ?? '—'}</div>
                        </div>
                        <div className="text-xs hidden sm:block" style={{ color: 'color-mix(in oklch,var(--base-content) 42%,transparent)' }}>
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0"
                          style={{ background: 'color-mix(in oklch,var(--success) 12%,var(--base-200))', color: 'var(--success)' }}>
                          <BadgeCheck size={12} />+{entry.coinsAwarded ?? 1000}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>

      {/* Redeem Modal */}
      <AnimatePresence>
        {showRedeem && (
          <RedeemModal
            coins={referral.coins}
            loading={isRedeeming}
            onClose={() => setShowRedeem(false)}
            onConfirm={handleRedeem}
          />
        )}
      </AnimatePresence>
    </div>
    </Container>
  );
}