'use client';

import { useEffect, useState } from 'react';

export default function StatusBar({ dark = false }: { dark?: boolean }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }));
    }
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  const c = dark ? '#FFB9B8' : '#888780';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(12px + env(safe-area-inset-top)) 16px 6px', flexShrink: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <span style={{ fontSize: 12, color: c, letterSpacing: 2 }}>●●●</span>
    </div>
  );
}
