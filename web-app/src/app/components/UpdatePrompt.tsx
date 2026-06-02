'use client';

import { useEffect, useState } from 'react';

export default function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(newSW);
          }
        });
      });

      // Check if there's already a waiting SW
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaiting(reg.waiting);
      }
    });
  }, []);

  function handleUpdate() {
    if (!waiting) return;
    waiting.postMessage('SKIP_WAITING');
    window.location.reload();
  }

  if (!waiting) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      left: 16,
      right: 16,
      zIndex: 9999,
      background: '#1A1A1A',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Update available</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>A new version of Foody is ready</p>
      </div>
      <button
        onClick={handleUpdate}
        style={{
          background: '#E03030',
          color: 'white',
          border: 'none',
          borderRadius: 10,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Update
      </button>
      <button
        onClick={() => setWaiting(null)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: 0 }}
      >
        ×
      </button>
    </div>
  );
}
