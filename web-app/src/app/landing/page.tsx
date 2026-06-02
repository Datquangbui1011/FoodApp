'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import InstallPrompt from '../components/InstallPrompt';

export default function LandingPage() {
  // On iOS standalone, the body background paints the home-indicator safe area
  // that page content doesn't reach. Match it to this dark screen so no white
  // strip shows at the bottom; restore the light default on navigation away.
  useEffect(() => {
    const { body } = document;
    const prev = body.style.background;
    body.style.background = '#1A0808';
    return () => { body.style.background = prev; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#1A0808', position: 'relative', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top)', boxSizing: 'border-box' }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,48,48,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 120, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <InstallPrompt />

      {/* Hero */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          style={{ width: 96, height: 96, borderRadius: 24, overflow: 'hidden', marginBottom: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}
        >
          <img src="/logo.png" alt="Foody" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
          style={{ fontSize: 44, fontWeight: 900, color: 'white', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1 }}
        >
          Foody
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', lineHeight: 1.5, maxWidth: 240 }}
        >
          Discover restaurants from food videos
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ display: 'flex', gap: 6, marginBottom: 32 }}
        >
          {['🍜', '☕', '🍕', '🍣', '🌮'].map(e => (
            <span key={e} style={{ fontSize: 26 }}>{e}</span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, type: 'spring', stiffness: 180, damping: 18 }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <Link href="/auth?mode=signup"
            style={{ display: 'block', width: '100%', padding: '15px 0', borderRadius: 16, background: '#E03030', color: 'white', textAlign: 'center', textDecoration: 'none', fontSize: 20, fontWeight: 700, boxShadow: '0 8px 28px rgba(224,48,48,0.45)' }}>
            Create account
          </Link>
          <Link href="/auth?mode=signin"
            style={{ display: 'block', width: '100%', padding: '15px 0', borderRadius: 16, background: 'rgba(255,255,255,0.08)', color: 'white', textAlign: 'center', textDecoration: 'none', fontSize: 20, fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.15)' }}>
            Sign in
          </Link>
        </motion.div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.18)', padding: '0 0 calc(16px + env(safe-area-inset-bottom))' }}>
        By signing up you agree to our Terms &amp; Privacy Policy
      </p>
    </div>
  );
}
