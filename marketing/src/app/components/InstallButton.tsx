'use client';

import { motion } from 'framer-motion';

const APP_URL = 'https://foody-pied.vercel.app/';

export default function InstallButton() {
  return (
    <motion.a
      href={APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'inline-block',
        background: '#E03030',
        color: 'white',
        textDecoration: 'none',
        fontSize: 16,
        fontWeight: 700,
        padding: '16px 40px',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(224,48,48,0.45)',
        letterSpacing: '-0.01em',
      }}
    >
      Install App
    </motion.a>
  );
}
