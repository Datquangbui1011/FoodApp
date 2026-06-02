'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
    setIsIOS(ios);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
    }
  }

  if (installed) {
    return (
      <motion.a
        href="https://foody-pied.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        style={{ display: 'inline-block', background: '#555', color: 'white', textDecoration: 'none', fontSize: 16, fontWeight: 700, padding: '16px 40px', borderRadius: 20, letterSpacing: '-0.01em' }}
      >
        Open App
      </motion.a>
    );
  }

  if (isIOS) {
    return (
      <div>
        <motion.a
          href="https://foody-pied.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          style={{ display: 'inline-block', background: '#E03030', color: 'white', textDecoration: 'none', fontSize: 16, fontWeight: 700, padding: '16px 40px', borderRadius: 20, boxShadow: '0 8px 32px rgba(224,48,48,0.45)', letterSpacing: '-0.01em' }}
        >
          Install App
        </motion.a>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 10 }}>
          Open in Safari → Share → Add to Home Screen
        </p>
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        style={{ background: '#E03030', color: 'white', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, padding: '16px 40px', borderRadius: 20, boxShadow: '0 8px 32px rgba(224,48,48,0.45)', letterSpacing: '-0.01em', fontFamily: 'inherit' }}
      >
        Install App
      </motion.button>
    );
  }

  // Fallback — browser doesn't support install prompt
  return (
    <motion.a
      href="https://foody-pied.vercel.app"
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      style={{ display: 'inline-block', background: '#E03030', color: 'white', textDecoration: 'none', fontSize: 16, fontWeight: 700, padding: '16px 40px', borderRadius: 20, boxShadow: '0 8px 32px rgba(224,48,48,0.45)', letterSpacing: '-0.01em' }}
    >
      Open App
    </motion.a>
  );
}
