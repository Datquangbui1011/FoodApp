'use client';

import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';

export interface LegalSection {
  heading: string;
  body: string;
}

export default function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--cream)' }}>
      {/* Header with back navigation — no dead ends */}
      <header style={{ flexShrink: 0, padding: 'calc(12px + env(safe-area-inset-top)) 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/landing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--tomato)', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
          <IconArrowLeft size={18} stroke={2} />
          Back
        </Link>
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>{title}</h1>
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: '8px 0 0' }}>Last updated {updated}</p>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 18px calc(40px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: '65ch', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {sections.map(s => (
            <section key={s.heading}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>{s.heading}</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.7 }}>{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
