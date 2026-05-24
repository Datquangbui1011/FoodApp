'use client';

import { useEffect, useState } from 'react';
import TabBar from '../components/TabBar';
import { createClient } from '@/lib/supabase/client';

const tabs = ['All', 'Collections', 'Notes'];
const COLORS = ['#C5E8D8', '#D5D2F5', '#F5D9A0', '#F5C4B3'];

interface SavedEntry {
  id: string | number;
  name: string;
  cuisineType: string;
  address: string;
}

export default function Saved() {
  const [savedItems, setSavedItems] = useState<SavedEntry[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from('saved_restaurants')
          .select('id, restaurant_name, cuisine_type, address')
          .eq('user_id', user.id)
          .order('saved_at', { ascending: false });

        if (data) {
          setSavedItems(data.map(row => ({
            id: row.id,
            name: row.restaurant_name,
            cuisineType: row.cuisine_type ?? '',
            address: row.address ?? '',
          })));
        }
      } else {
        try {
          const raw = localStorage.getItem('foodmap_saved');
          if (raw) setSavedItems(JSON.parse(raw));
        } catch {}
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1.5">
        <span style={{ color: '#888780', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#888780', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>

      {/* Header */}
      <div className="px-3.5 pt-2.5 pb-2 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#2C2C2A' }}>Saved</h2>
        <div className="flex gap-1.5">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className="px-2.5 py-0.5 rounded-full"
              style={{
                fontSize: 8,
                fontWeight: 500,
                border: '1px solid rgba(0,0,0,0.1)',
                background: i === 0 ? '#0F6E56' : 'white',
                color: i === 0 ? 'white' : '#5F5E5A',
                borderColor: i === 0 ? '#0F6E56' : 'rgba(0,0,0,0.1)',
              }}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {savedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-2">
            <p style={{ fontSize: 11, color: '#888780' }}>No saved restaurants yet.</p>
            <p style={{ fontSize: 9, color: '#D3D1C7' }}>Tap the heart on any result to save it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {savedItems.map((item, i) => (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.1)', background: 'white' }}
              >
                <div style={{ height: 58, background: COLORS[i % COLORS.length] }} />
                <div className="px-2 py-1.5">
                  <p style={{ fontSize: 9, fontWeight: 500, color: '#2C2C2A', marginBottom: 1 }}>
                    {item.name}
                  </p>
                  <span style={{ fontSize: 7, color: '#888780' }}>{item.cuisineType}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}
