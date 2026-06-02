'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;

    setIsIOS(ios);
    if (ios) { setVisible(true); return; }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      margin: '16px 16px 0',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <img src="/logo.png" alt="Foody" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>Add Foody to Home Screen</p>
        {isIOS
          ? <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>Tap Share → Add to Home Screen</p>
          : <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>Install for the full app experience</p>
        }
      </div>
      {!isIOS && (
        <button
          onClick={handleInstall}
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
          Install
        </button>
      )}
      <button
        onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: 0, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
