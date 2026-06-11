'use client';

import { useState } from 'react';
import { IconSearch, IconMapPin } from '@tabler/icons-react';
import StatusBar from '../components/StatusBar';

const CATEGORIES = ['🔥 Trending', 'Ramen', 'Pho', 'BBQ', 'Cafes'];

const feedItems = [
  { id: 1, name: 'Ramen Tatsu-ya', sub: 'Japanese · Austin TX · spotted 24× this week', badge: 'Trending', cuisineType: 'Ramen', color: '#EAD7CC', emoji: '🍜' },
  { id: 2, name: 'Pho Long Restaurant', sub: 'Vietnamese · Lincoln NE · 0.8 mi away', badge: 'Near you', cuisineType: 'Pho', color: '#EFE1C7', emoji: '🍲' },
  { id: 3, name: 'Uchi Austin', sub: 'Japanese · Austin TX · spotted 18× this week', badge: 'Trending', cuisineType: 'Ramen', color: '#F0DBCF', emoji: '🍣' },
];

function matchesCategory(item: typeof feedItems[number], cat: string): boolean {
  if (cat === '🔥 Trending') return item.badge.includes('Trending');
  return item.cuisineType === cat;
}

export default function Explore() {
  const [activeCategory, setActiveCategory] = useState('🔥 Trending');

  const visible = feedItems.filter(item => matchesCategory(item, activeCategory));

  return (
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)' }}>
      <StatusBar />

      {/* Header */}
      <header style={{ padding: '0 18px 12px' }}>
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, color: 'var(--ink)', margin: '0 0 14px', lineHeight: 1 }}>Explore</h1>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingBottom: 2 }}>
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0"
                style={{
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  whiteSpace: 'nowrap',
                  borderRadius: 999,
                  padding: '7px 14px',
                  border: `1px solid ${active ? 'var(--tomato)' : 'var(--cream-200)'}`,
                  background: active ? 'var(--tomato)' : 'var(--cream)',
                  color: active ? '#FFF8F4' : 'var(--ink-soft)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: active ? 'var(--shadow-warm-sm)' : 'none',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </header>

      {/* Search bar */}
      <div className="flex items-center gap-2.5" style={{ padding: '4px 16px 12px' }}>
        <div
          className="flex-1 flex items-center gap-2"
          style={{ background: 'var(--cream)', borderRadius: 999, padding: '10px 14px', boxShadow: 'var(--shadow-warm-sm)' }}
        >
          <IconSearch size={17} color="var(--ink-mute)" />
          <span style={{ fontSize: 13, color: 'var(--ink-mute)' }}>Search restaurants…</span>
        </div>
        <button aria-label="Map view" style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--tomato)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-warm-sm)', flexShrink: 0 }}>
          <IconMapPin size={21} color="#FFF8F4" />
        </button>
      </div>

      {/* Feed */}
      <main className="flex-1 overflow-y-auto" style={{ padding: '0 14px', paddingBottom: 'calc(12px + 64px + env(safe-area-inset-bottom))' }}>
        {visible.length === 0 ? (
          <div className="flex items-center justify-center" style={{ paddingTop: 60 }}>
            <p style={{ fontSize: 13.5, color: 'var(--ink-mute)' }}>No restaurants in this category yet.</p>
          </div>
        ) : (
          visible.map((item) => (
            <article
              key={item.id}
              style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--cream)', boxShadow: 'var(--shadow-warm-sm)', marginBottom: 14 }}
            >
              {/* Image-led header block with scrim badge */}
              <div style={{ position: 'relative', height: 132, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span aria-hidden style={{ fontSize: 48, opacity: 0.55 }}>{item.emoji}</span>
                <span
                  style={{ position: 'absolute', top: 12, left: 12, borderRadius: 99, padding: '4px 11px', background: item.badge === 'Trending' ? 'var(--tomato)' : 'rgba(25,16,16,0.6)', backdropFilter: 'blur(4px)', color: '#FFF8F4', fontSize: 11, fontWeight: 600 }}
                >
                  {item.badge === 'Trending' ? '🔥 Trending' : '📍 Near you'}
                </span>
              </div>
              <div style={{ padding: '13px 15px 15px' }}>
                <p className="font-display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.15 }}>{item.name}</p>
                <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{item.sub}</span>
              </div>
            </article>
          ))
        )}
      </main>

    </div>
  );
}
