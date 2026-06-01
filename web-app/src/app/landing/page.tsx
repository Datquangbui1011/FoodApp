'use client';

import Link from 'next/link';
import StatusBar from '../components/StatusBar';

export default function LandingPage() {
  return (
    <div className="flex flex-col flex-1" style={{ background: '#1A0808', position: 'relative', overflow: 'hidden' }}>
      <StatusBar dark />

      {/* Background blobs */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,110,86,0.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 120, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(226,75,74,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ width: 110, height: 110, borderRadius: 28, overflow: 'hidden', marginBottom: 20, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
          <img src="/logo.png" alt="Foody" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Name */}
        <h1 style={{ fontSize: 42, fontWeight: 800, color: 'white', margin: '0 0 10px', letterSpacing: '-0.03em', lineHeight: 1 }}>
          Foody
        </h1>

        {/* Tagline */}
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px', lineHeight: 1.5, maxWidth: 240 }}>
          Discover restaurants from food videos
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 52 }}>
          {['🍜', '☕', '🍕', '🍣', '🌮'].map(e => (
            <span key={e} style={{ fontSize: 18 }}>{e}</span>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/auth?mode=signup"
            style={{ display: 'block', width: '100%', padding: '14px 0', borderRadius: 14, background: '#E24B4A', color: 'white', textAlign: 'center', textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 8px 24px rgba(226,75,74,0.4)', letterSpacing: '-0.01em' }}>
            Create account
          </Link>
          <Link href="/auth?mode=signin"
            style={{ display: 'block', width: '100%', padding: '14px 0', borderRadius: 14, background: 'rgba(255,255,255,0.08)', color: 'white', textAlign: 'center', textDecoration: 'none', fontSize: 14, fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.15)', letterSpacing: '-0.01em' }}>
            Sign in
          </Link>
          <Link href="/"
            style={{ display: 'block', padding: '8px 0', color: 'rgba(255,255,255,0.4)', textAlign: 'center', textDecoration: 'none', fontSize: 12 }}>
            Continue as guest
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', paddingBottom: 20 }}>
        By signing up you agree to our Terms & Privacy Policy
      </p>
    </div>
  );
}
