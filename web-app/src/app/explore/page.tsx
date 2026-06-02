'use client';

import { useState } from 'react';
import { IconSearch, IconMapPin } from '@tabler/icons-react';
import TabBar from '../components/TabBar';

const CATEGORIES = ['🔥 Trending', 'Ramen', 'Pho', 'BBQ', 'Cafes'];

const feedItems = [
  { id: 1, name: 'Ramen Tatsu-ya', sub: 'Japanese · Austin TX · spotted 24× this week', badge: '🔥 Trending', cuisineType: 'Ramen', color: '#C5E8D8' },
  { id: 2, name: 'Pho Long Restaurant', sub: 'Vietnamese · Lincoln NE · 0.8 mi away', badge: '📍 Near you', cuisineType: 'Pho', color: '#F5D9A0' },
  { id: 3, name: 'Uchi Austin', sub: 'Japanese · Austin TX · spotted 18× this week', badge: '🔥 Trending', cuisineType: 'Ramen', color: '#D5D2F5' },
];

function matchesCategory(item: typeof feedItems[number], cat: string): boolean {
  if (cat === '🔥 Trending') return item.badge.includes('Trending');
  return item.cuisineType === cat;
}

export default function Explore() {
  const [activeCategory, setActiveCategory] = useState('🔥 Trending');

  const visible = feedItems.filter(item => matchesCategory(item, activeCategory));

  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div
        className="flex justify-between items-center px-4 pt-3 pb-1.5"
        style={{ background: 'white' }}
      >
        <span style={{ color: '#888780', fontSize: 13, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#888780', fontSize: 13, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>

      {/* Header */}
      <div className="px-3.5 pt-2.5 pb-2 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: '#2C2C2A' }}>Explore</h2>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-2.5 py-1 rounded-full flex-shrink-0"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: active ? '#E03030' : 'white',
                  color: active ? 'white' : '#5F5E5A',
                  borderColor: active ? '#E03030' : 'rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3.5 py-2">
        <div
          className="flex-1 flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
          style={{ background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)' }}
        >
          <IconSearch size={16} color="#888780" />
          <span style={{ fontSize: 12, color: '#888780' }}>Search restaurants…</span>
        </div>
        <IconMapPin size={23} color="#E03030" />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center pt-12">
            <p style={{ fontSize: 13, color: '#D3D1C7' }}>No restaurants in this category yet.</p>
          </div>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className="rounded-xl overflow-hidden mb-2"
              style={{ border: '1px solid rgba(0,0,0,0.1)', background: 'white' }}
            >
              <div className="relative" style={{ height: 72, background: item.color }}>
                <span
                  className="absolute top-1.5 left-1.5 rounded-full px-2 py-0.5"
                  style={{ background: 'rgba(15,110,86,0.9)', color: 'white', fontSize: 9, fontWeight: 500 }}
                >
                  {item.badge}
                </span>
              </div>
              <div className="px-2.5 py-2">
                <p style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2A', marginBottom: 2 }}>{item.name}</p>
                <span style={{ fontSize: 10, color: '#888780' }}>{item.sub}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <TabBar />
    </div>
  );
}
