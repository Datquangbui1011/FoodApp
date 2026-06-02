'use client';

export default function PhoneMockup({ src }: { src: string }) {
  return (
    <div style={{
      position: 'relative',
      width: 240,
      height: 520,
      flexShrink: 0,
    }}>
      {/* Phone shell */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 44,
        border: '8px solid rgba(255,255,255,0.12)',
        background: '#111',
        boxShadow: '0 40px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.06)',
        overflow: 'hidden',
        zIndex: 1,
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 90,
          height: 24,
          background: '#111',
          borderRadius: 12,
          zIndex: 3,
        }} />
        {/* Screenshot */}
        <img
          src={src}
          alt="Foody app"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
        />
      </div>

      {/* Reflection overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 44,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)',
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* Side button */}
      <div style={{
        position: 'absolute',
        right: -10,
        top: 100,
        width: 4,
        height: 60,
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute',
        left: -10,
        top: 80,
        width: 4,
        height: 36,
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute',
        left: -10,
        top: 126,
        width: 4,
        height: 36,
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
      }} />
    </div>
  );
}
