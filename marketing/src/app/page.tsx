'use client';

import { motion } from 'framer-motion';
import InstallPrompt from './components/InstallPrompt';
import ServiceWorkerRegistrar from './components/ServiceWorkerRegistrar';

const FEATURES = [
  {
    emoji: '🎬',
    title: 'From video to table',
    desc: 'Paste any food video URL and Foody identifies the restaurant instantly.',
  },
  {
    emoji: '📍',
    title: 'Find it near you',
    desc: 'See restaurants on a live map, sorted by distance from where you are.',
  },
  {
    emoji: '🔖',
    title: 'Save your cravings',
    desc: 'Bookmark restaurants and come back when the hunger hits.',
  },
  {
    emoji: '🌆',
    title: 'Explore the city',
    desc: 'Browse nearby spots by cuisine, vibe, and what people are filming.',
  },
];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.5, ease: 'easeOut' as const },
  };
}

export default function Page() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <InstallPrompt />

      <main style={{ minHeight: '100dvh', background: '#1A0808', position: 'relative', overflowX: 'hidden' }}>

        {/* Background glows */}
        <div style={{ position: 'fixed', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,48,48,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', bottom: 80, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Hero */}
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '60px 24px', textAlign: 'center' }}>

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            style={{ width: 120, height: 120, borderRadius: 30, overflow: 'hidden', marginBottom: 28, boxShadow: '0 20px 60px rgba(224,48,48,0.4)' }}
          >
            <img src="/logo.png" alt="Foody" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </motion.div>

          <motion.h1 {...fadeUp(0.1)} style={{ fontSize: 'clamp(52px, 12vw, 96px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 16, background: 'linear-gradient(135deg, #fff 40%, rgba(255,255,255,0.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Foody
          </motion.h1>

          <motion.p {...fadeUp(0.2)} style={{ fontSize: 'clamp(15px, 3vw, 20px)', color: 'rgba(255,255,255,0.55)', maxWidth: 480, lineHeight: 1.6, marginBottom: 12 }}>
            Discover restaurants from food videos.
          </motion.p>

          <motion.p {...fadeUp(0.25)} style={{ fontSize: 'clamp(13px, 2.5vw, 16px)', color: 'rgba(255,255,255,0.35)', maxWidth: 380, lineHeight: 1.6, marginBottom: 48 }}>
            Watch a food video, find the restaurant, get there — all in seconds.
          </motion.p>

          <motion.div {...fadeUp(0.35)} style={{ display: 'flex', gap: 8, marginBottom: 56 }}>
            {['🍜', '☕', '🍕', '🍣', '🌮', '🥗'].map(e => (
              <span key={e} style={{ fontSize: 'clamp(22px, 5vw, 32px)' }}>{e}</span>
            ))}
          </motion.div>

          <motion.a
            {...fadeUp(0.4)}
            href="https://foody-pied.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{ display: 'inline-block', background: '#E03030', color: 'white', textDecoration: 'none', fontSize: 16, fontWeight: 700, padding: '16px 40px', borderRadius: 20, boxShadow: '0 8px 32px rgba(224,48,48,0.45)', letterSpacing: '-0.01em' }}
          >
            Open App
          </motion.a>
        </section>

        {/* Features */}
        <section style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 800, textAlign: 'center', marginBottom: 56, letterSpacing: '-0.03em', color: 'white' }}
          >
            How it works
          </motion.h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 24,
                  padding: '28px 24px',
                }}
              >
                <span style={{ fontSize: 36, display: 'block', marginBottom: 16 }}>{f.emoji}</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 8, letterSpacing: '-0.02em' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '80px 24px 100px', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ background: 'rgba(224,48,48,0.1)', border: '1px solid rgba(224,48,48,0.2)', borderRadius: 32, padding: '56px 32px', maxWidth: 560, margin: '0 auto' }}
          >
            <p style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, color: 'white', marginBottom: 16, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Ready to find your next favourite spot?
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 1.6 }}>
              Install Foody and turn every food video into a real dining experience.
            </p>
            <motion.a
              href="https://foody-pied.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{ display: 'inline-block', background: '#E03030', color: 'white', textDecoration: 'none', fontSize: 15, fontWeight: 700, padding: '14px 36px', borderRadius: 16, boxShadow: '0 8px 32px rgba(224,48,48,0.4)' }}
            >
              Get Started
            </motion.a>
          </motion.div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: 'center', padding: '0 24px 32px', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
          © {new Date().getFullYear()} Foody. All rights reserved.
        </footer>
      </main>
    </>
  );
}
