'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const COLORS = ['#C5E8D8', '#F5D9A0', '#D5D2F5', '#F5C4B3'];

export interface RecentEntry {
  id: string;
  name: string;
  confidence: number | null;
  time: string;
  color: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export const RECENTS_KEY = 'foodmap_recents';

export default function RecentSearches() {
  const [items, setItems] = useState<RecentEntry[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from('recent_searches')
          .select('id, restaurant_name, confidence, searched_at')
          .eq('user_id', user.id)
          .order('searched_at', { ascending: false })
          .limit(10);

        if (data) {
          setItems(data.map((row, i) => ({
            id: row.id,
            name: row.restaurant_name,
            confidence: row.confidence,
            time: row.searched_at,
            color: COLORS[i % COLORS.length],
          })));
        }
      } else {
        try {
          const raw = localStorage.getItem(RECENTS_KEY);
          if (raw) setItems(JSON.parse(raw));
        } catch {}
      }
    }
    load();
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <p style={{ fontSize: 12, fontWeight: 500, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Recent searches
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 py-1.5 border-b"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div className="w-8 h-8 rounded-md flex-shrink-0" style={{ background: item.color }} />
          <div className="flex-1">
            <p style={{ fontSize: 12, fontWeight: 500, color: '#2C2C2A', marginBottom: 1 }}>{item.name}</p>
            <span style={{ fontSize: 10, color: '#888780' }}>
              {relativeTime(item.time)}{item.confidence !== null ? ` · ${item.confidence}% confident` : ''}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

export { COLORS };
