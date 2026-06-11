'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import InstallPrompt from '../components/InstallPrompt';

export default function LandingPage() {
  return (
    <div
      className="grain"
      style={{
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
        background: 'radial-gradient(120% 80% at 50% -10%, #2A1614 0%, #191010 55%)',
        position: 'relative', overflow: 'hidden',
        paddingTop: 'env(safe-area-inset-top)', boxSizing: 'border-box',
      }}
    >
      {/* Ambient warm glows — tomato top-right, ember bottom-left */}
      <div style={{ position: 'absolute', top: -110, right: -90, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(229,72,47,0.38) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 60, left: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,160,60,0.20) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <InstallPrompt />

      {/* Hero */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          style={{ width: 92, height: 92, borderRadius: 26, overflow: 'hidden', marginBottom: 22, boxShadow: '0 18px 44px rgba(229,72,47,0.32), 0 4px 12px rgba(0,0,0,0.4)' }}
        >
          <img src="/logo.png" alt="Foody app icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </motion.div>

        <motion.h1
          className="font-display"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: 'spring', stiffness: 200, damping: 18 }}
          style={{ fontSize: 56, fontWeight: 600, color: '#FBF7F2', margin: '0 0 12px', lineHeight: 0.95 }}
        >
          Foody
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.45 }}
          style={{ fontSize: 17, color: 'rgba(251,247,242,0.62)', margin: '0 0 26px', lineHeight: 1.55, maxWidth: 260, textWrap: 'balance' }}
        >
          Find the restaurant behind any food video.
        </motion.p>

        {/* Cuisine row — soft warm pill so the emoji read as a single object */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'flex', gap: 10, marginBottom: 40, padding: '10px 16px',
            borderRadius: 999, background: 'rgba(251,247,242,0.05)',
            border: '1px solid rgba(251,247,242,0.08)',
          }}
        >
          {['🍜', '☕', '🍕', '🍣', '🌮'].map((e, i) => (
            <motion.span
              key={e}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34 + i * 0.05, type: 'spring', stiffness: 300, damping: 18 }}
              style={{ fontSize: 24 }}
            >
              {e}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 180, damping: 18 }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <Link href="/auth?mode=signup"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '17px 0', borderRadius: 16, background: 'var(--tomato)', color: '#FBF7F2', textDecoration: 'none', fontSize: 18, fontWeight: 700, boxShadow: 'var(--shadow-tomato)' }}>
            Create account
            <span aria-hidden style={{ fontSize: 19, lineHeight: 1 }}>→</span>
          </Link>
          <Link href="/auth?mode=signin"
            style={{ display: 'block', width: '100%', padding: '16px 0', borderRadius: 16, background: 'rgba(251,247,242,0.06)', color: '#FBF7F2', textAlign: 'center', textDecoration: 'none', fontSize: 18, fontWeight: 600, border: '1px solid rgba(251,247,242,0.14)', backdropFilter: 'blur(8px)' }}>
            Sign in
          </Link>
        </motion.div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(251,247,242,0.28)', lineHeight: 1.5, position: 'relative', zIndex: 1, padding: '0 32px calc(18px + env(safe-area-inset-bottom))' }}>
        By continuing you agree to our{' '}
        <Link href="/legal/terms" style={{ color: 'rgba(251,247,242,0.5)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Terms</Link>
        {' '}&amp;{' '}
        <Link href="/legal/privacy" style={{ color: 'rgba(251,247,242,0.5)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy Policy</Link>
      </p>
    </div>
  );
}
