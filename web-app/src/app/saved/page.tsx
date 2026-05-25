'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMapPin, IconHeart } from '@tabler/icons-react';
import TabBar from '../components/TabBar';
import StatusBar from '../components/StatusBar';
import { createClient } from '@/lib/supabase/client';

const COLORS = ['#C5E8D8', '#D5D2F5', '#F5D9A0', '#F5C4B3'];
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
      <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <StatusBar />
        <div className="px-3.5 pb-3">
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A' }}>Saved</h2>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', background: 'white' }}>
                <div style={{ height: 80, background: '#F7F6F3' }} />
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ height: 8, borderRadius: 4, background: '#F0EFEC', marginBottom: 6, width: '70%' }} />
                  <div style={{ height: 6, borderRadius: 4, background: '#F0EFEC', width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 gap-3">
            <IconHeart size={32} color="#D3D1C7" />
            <p style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>Nothing saved yet</p>
            <p style={{ fontSize: 9, color: '#888780', textAlign: 'center', lineHeight: 1.6 }}>
              Tap the heart on any restaurant{'\n'}in the bottom sheet to save it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {items.map((item, i) => {
              const photo = photoUrl(item.name, item.lat, item.lng);
              return (
                <button
                  key={item.id}
                  onClick={() => handleTap(item)}
                  style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', background: 'white', textAlign: 'left', cursor: 'pointer', padding: 0, display: 'block', width: '100%' }}
                >
                  {/* Thumbnail */}
                  <div style={{ height: 82, background: COLORS[i % COLORS.length], position: 'relative', overflow: 'hidden' }}>
                    {photo && (
                      <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    {item.rating && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 99, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 7, color: '#F5A623' }}>★</span>
                        <span style={{ fontSize: 7, color: 'white', fontWeight: 600 }}>{item.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '8px 10px 10px' }}>
                    <p style={{ fontSize: 9, fontWeight: 600, color: '#2C2C2A', marginBottom: 3, lineHeight: 1.3,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.name}
                    </p>
                    {item.cuisineType ? (
                      <span style={{ fontSize: 7, color: '#888780' }}>{item.cuisineType}</span>
                    ) : item.address ? (
                      <span style={{ fontSize: 7, color: '#888780', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconMapPin size={7} color="#D3D1C7" />{item.address.split(',')[0]}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}
