'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMapPin, IconHeart } from '@tabler/icons-react';
import TabBar from '../components/TabBar';
import StatusBar from '../components/StatusBar';
import { createClient } from '@/lib/supabase/client';

// Warm food-toned placeholder washes for thumbnails without a photo.
const COLORS = ['#F2DACE', '#EFE2C8', '#EAD6CB', '#F3DCCF'];
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

interface SavedEntry {
  id: string | number;
  name: string;
  cuisineType: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
}

function photoUrl(name: string, lat: number | null, lng: number | null): string {
  if (!lat || !lng || !KEY) return '';
  return `/api/place-photo?name=${encodeURIComponent(name)}&lat=${lat}&lng=${lng}`;
}

export default function Saved() {
  const router = useRouter();
  const [items, setItems] = useState<SavedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from('saved_restaurants')
          .select('id, restaurant_name, cuisine_type, address, lat, lng, rating')
          .eq('user_id', user.id)
          .order('saved_at', { ascending: false });

        if (data) {
          setItems(data.map(row => ({
            id: row.id,
            name: row.restaurant_name,
            cuisineType: row.cuisine_type ?? '',
            address: row.address ?? '',
            lat: row.lat as number | null,
            lng: row.lng as number | null,
            rating: (row as Record<string, unknown>).rating as number | null ?? null,
          })));
        }
      } else {
        try {
          const raw = localStorage.getItem('foodmap_saved');
          if (raw) setItems(JSON.parse(raw));
        } catch { /* ignore */ }
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleTap(item: SavedEntry) {
    if (item.lat && item.lng) {
      sessionStorage.setItem('foodmap_navigate', JSON.stringify({
        id: item.id,
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        cuisineType: item.cuisineType,
        address: item.address,
        rating: item.rating,
      }));
    }
    router.push('/');
  }

  return (
    <div className="flex flex-col flex-1">

      {/* Header */}
      <header style={{ flexShrink: 0 }}>
        <StatusBar />
        <div style={{ padding: '0 18px 14px' }}>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>Saved</h1>
          {!loading && items.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0 0' }}>
              {items.length} {items.length === 1 ? 'place' : 'places'} you want to try
            </p>
          )}
        </div>
      </header>

      {/* List */}
      <main className="flex-1 overflow-y-auto" style={{ padding: '4px 14px', paddingBottom: 'calc(16px + 64px + env(safe-area-inset-bottom))' }}>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--cream)', boxShadow: 'var(--shadow-warm-sm)' }}>
                <div style={{ height: 100, background: 'var(--cream-100)' }} />
                <div style={{ padding: '10px 11px 12px' }}>
                  <div style={{ height: 9, borderRadius: 5, background: 'var(--cream-200)', marginBottom: 7, width: '75%' }} />
                  <div style={{ height: 7, borderRadius: 5, background: 'var(--cream-200)', width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 90, gap: 14 }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--tomato-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconHeart size={34} color="var(--tomato)" />
            </div>
            <p className="font-display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>No saved places yet</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.6, maxWidth: 240, textWrap: 'balance' }}>
              Tap the heart on any restaurant to keep it here for later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, i) => {
              const photo = photoUrl(item.name, item.lat, item.lng);
              return (
                <button
                  key={item.id}
                  onClick={() => handleTap(item)}
                  style={{ borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--cream)', boxShadow: 'var(--shadow-warm-sm)', textAlign: 'left', cursor: 'pointer', padding: 0, display: 'block', width: '100%' }}
                >
                  {/* Thumbnail */}
                  <div style={{ height: 104, background: COLORS[i % COLORS.length], position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span aria-hidden style={{ fontSize: 30, opacity: 0.5 }}>🍽️</span>
                    {photo && (
                      <img src={photo} alt={`${item.name} photo`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    {item.rating && (
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(25,16,16,0.62)', backdropFilter: 'blur(4px)', borderRadius: 99, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 10, color: '#F5A623' }}>★</span>
                        <span style={{ fontSize: 10.5, color: 'white', fontWeight: 600 }}>{item.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '10px 11px 12px' }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.name}
                    </p>
                    {item.cuisineType ? (
                      <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{item.cuisineType}</span>
                    ) : item.address ? (
                      <span style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IconMapPin size={11} color="var(--ink-mute)" />{item.address.split(',')[0]}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <TabBar />
    </div>
  );
}
