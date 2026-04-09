'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2, ExternalLink, Check, Copy,
  MessageCircle, ArrowUpRight, Star,
  Smartphone, AlertCircle,
} from 'lucide-react';

// ── Re-export these from your main file or import from shared utils ──
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://app.likenson.com';

const STATIC_BANNER_URL = 'https://ik.imagekit.io/zxxzgk3iq/ChatGPT%20Image%20Feb%202,%202026,%2005_21_49%20PM.png?updatedAt=1770278792983';

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
    label: '💬 Casual',
    text:
      `Hey! 👋 I've been using *Likenson Healthcare* for medicines & doctor consultations — super easy!\n\n` +
      `They're giving *₹5 free* to anyone who signs up with my code.\n\n` +
      `🔑 Code: *${code}*\n` +
      `🔗 ${link}\n\n` +
      `Takes 2 minutes. Try it! 😊`,
  },
  {
    id: 'urgent',
    label: '⚡ Urgency',
    text:
      `⚠️ *Free ₹5 on Likenson Healthcare!*\n\n` +
      `Sign up with my code and get ₹5 instantly.\n\n` +
      `💊 Medicines | 🩺 Doctors | 🧪 Lab Tests\n\n` +
      `🔑 Code: *${code}*\n` +
      `➡️ ${link}\n\n` +
      `Share with family too! 🙏`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ShareBanner COMPONENT (Text + Image Link Version)
// ─────────────────────────────────────────────────────────────────────────────
export function ShareBanner({ referralCode, totalReferrals = 0, coinsEarned = 0 }) {
  const signupLink = `${BASE_URL}/signup?ref=${referralCode}`;
  const captions   = WA_CAPTIONS(referralCode, signupLink);

  const [captionIdx,    setCaptionIdx]    = useState(0);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [sharing,       setSharing]       = useState(false);
  const [shareStatus,   setShareStatus]   = useState('idle'); // idle | success | unsupported

  // Prepend the image URL so WhatsApp auto-generates a preview card
  const currentCaption = `${STATIC_BANNER_URL}\n\n${captions[captionIdx].text}`;

  // ── Share text via Web Share API ──
  const handleShareText = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    setShareStatus('idle');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join Likenson Healthcare',
          text: currentCaption,
        });
        setShareStatus('success');
      } else {
        // Desktop / unsupported — fallback to clipboard
        await navigator.clipboard.writeText(currentCaption);
        setShareStatus('unsupported');
      }
    } catch (e) {
      // User cancelled share — not an error
      if (e.name !== 'AbortError') {
        console.error('Share failed', e);
        setShareStatus('unsupported');
      }
    } finally {
      setSharing(false);
      setTimeout(() => setShareStatus('idle'), 5000);
    }
  }, [currentCaption, sharing]);

  // ── Copy caption ──
  const handleCopyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentCaption);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2200);
    } catch {}
  }, [currentCaption]);

  // ── WhatsApp direct link ──
  const handleWATextOnly = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(currentCaption)}`, '_blank', 'noopener,noreferrer');
  }, [currentCaption]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.72 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--base-100)', border: '1.5px solid var(--base-300)' }}
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg,color-mix(in oklch,var(--primary) 8%,var(--base-100)),color-mix(in oklch,var(--secondary) 6%,var(--base-100)))', borderBottom: '1px solid var(--base-300)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'color-mix(in oklch,var(--primary) 15%,var(--base-200))' }}>
          <Share2 size={17} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <div className="font-montserrat font-black text-base" style={{ color: 'var(--base-content)' }}>Share &amp; Earn</div>
          <div className="text-xs" style={{ color: 'color-mix(in oklch,var(--base-content) 50%,transparent)' }}>
            You earn ₹10 · Friend earns ₹5 · No limit
          </div>
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ background: 'color-mix(in oklch,var(--warning) 15%,var(--base-200))', color: 'var(--warning)' }}>
          <Star size={11} fill="currentColor" /> Unlimited
        </span>
      </div>

      <div className="p-6 space-y-6">

        {/* Referral code pill */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'color-mix(in oklch,var(--base-content) 45%,transparent)' }}>Your Referral Code</div>
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3"
            style={{ background: 'var(--base-200)', border: '1.5px dashed color-mix(in oklch,var(--primary) 35%,transparent)' }}>
            <span className="font-montserrat font-black text-2xl tracking-[0.25em]" style={{ color: 'var(--primary)' }}>
              {referralCode}
            </span>
            <div className="ml-auto">
              <motion.button
                onClick={async () => { try { await navigator.clipboard.writeText(referralCode); } catch {} }}
                whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.04 }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm"
                style={{ background: 'color-mix(in oklch,var(--primary) 12%,var(--base-200))', color: 'var(--primary)', border: '1.5px solid color-mix(in oklch,var(--primary) 32%,transparent)' }}>
                <Copy size={13} /> Copy Code
              </motion.button>
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
            <span className="text-xs font-mono truncate flex-1" style={{ color: 'color-mix(in oklch,var(--base-content) 60%,transparent)' }}>
              {signupLink}
            </span>
            <motion.button
              onClick={async () => { try { await navigator.clipboard.writeText(signupLink); } catch {} }}
              whileTap={{ scale: 0.93 }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0"
              style={{ background: 'color-mix(in oklch,var(--primary) 12%,var(--base-200))', color: 'var(--primary)', border: '1.5px solid color-mix(in oklch,var(--primary) 30%,transparent)' }}>
              Copy
            </motion.button>
          </div>
        </div>

        {/* Caption template selector */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'color-mix(in oklch,var(--base-content) 45%,transparent)' }}>Share Message</div>
          
          {/* Static Banner Preview */}
          <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--base-300)' }}>
            <img 
              src={STATIC_BANNER_URL} 
              alt="Share Banner Preview" 
              className="w-full h-auto object-cover" 
            />
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
          <div className="rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap"
            style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', color: 'color-mix(in oklch,var(--base-content) 72%,transparent)', maxHeight: 148, overflow: 'auto' }}>
            {currentCaption}
          </div>
        </div>

        {/* ── SHARE BUTTONS ── */}
        <div className="space-y-3">

          {/* PRIMARY: Share text (Web Share API) */}
          <motion.button
            onClick={handleShareText}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            disabled={sharing}
            className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'var(--primary-content)',
              boxShadow: '0 6px 24px color-mix(in oklch,var(--primary) 35%,transparent)',
              cursor: sharing ? 'wait' : 'pointer',
            }}
          >
            {/* shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)', width: '50%' }}
            />
            <Share2 size={18} />
            <span>Share via Options</span>
            <Smartphone size={16} style={{ opacity: 0.8 }} />
          </motion.button>

          {/* Status feedback */}
          <AnimatePresence>
            {shareStatus !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl p-4 flex gap-3 items-start text-xs leading-relaxed"
                style={{
                  background: shareStatus === 'success'
                    ? 'color-mix(in oklch,var(--success) 10%,var(--base-200))'
                    : 'color-mix(in oklch,var(--warning) 10%,var(--base-200))',
                  border: `1px solid ${shareStatus === 'success'
                    ? 'color-mix(in oklch,var(--success) 25%,transparent)'
                    : 'color-mix(in oklch,var(--warning) 25%,transparent)'}`,
                }}
              >
                {shareStatus === 'success' && (
                  <><Check size={15} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} /><span style={{ color: 'color-mix(in oklch,var(--base-content) 75%,transparent)' }}><strong style={{ color: 'var(--success)' }}>Done!</strong> Opened native share menu.</span></>
                )}
                {shareStatus === 'unsupported' && (
                  <><AlertCircle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} /><span style={{ color: 'color-mix(in oklch,var(--base-content) 75%,transparent)' }}><strong style={{ color: 'var(--warning)' }}>Copied!</strong> Your device doesn't support the native share menu. The text has been copied to your clipboard.</span></>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-3">
            {/* WA text-only fallback */}
            <motion.button onClick={handleWATextOnly}
              whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs transition-all"
              style={{ background: '#25D366', color: '#fff', border: '1.5px solid #128C7E' }}>
              <ArrowUpRight size={14} /> Open WhatsApp
            </motion.button>

            {/* Copy caption */}
            <motion.button onClick={handleCopyCaption}
              whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs transition-all"
              style={{
                background: captionCopied ? 'color-mix(in oklch,var(--success) 12%,var(--base-200))' : 'var(--base-200)',
                color: captionCopied ? 'var(--success)' : 'var(--base-content)',
                border: `1.5px solid ${captionCopied ? 'color-mix(in oklch,var(--success) 28%,transparent)' : 'var(--base-300)'}`,
              }}>
              {captionCopied ? <Check size={14} /> : <MessageCircle size={14} />}
              {captionCopied ? 'Copied!' : 'Copy Text'}
            </motion.button>
          </div>
        </div>

        {/* Likenson brand info */}
        <div className="rounded-2xl p-5 flex gap-4 items-center"
          style={{ background: 'linear-gradient(135deg,color-mix(in oklch,var(--primary) 6%,var(--base-100)),color-mix(in oklch,var(--secondary) 5%,var(--base-100)))', border: '1.5px solid color-mix(in oklch,var(--primary) 18%,var(--base-300))' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-montserrat font-black text-xl"
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--secondary))', color: 'var(--primary-content)', boxShadow: '0 4px 12px color-mix(in oklch,var(--primary) 28%,transparent)' }}>
            L
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-montserrat font-black text-base mb-0.5" style={{ color: 'var(--base-content)' }}>Likenson Healthcare</div>
            <div className="text-xs leading-relaxed" style={{ color: 'color-mix(in oklch,var(--base-content) 60%,transparent)' }}>
              India's trusted platform for medicine delivery, doctor consultations &amp; health packages.
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {['Medicine Delivery', 'Consultations', 'Lab Tests'].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'color-mix(in oklch,var(--primary) 10%,var(--base-200))', color: 'var(--primary)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}