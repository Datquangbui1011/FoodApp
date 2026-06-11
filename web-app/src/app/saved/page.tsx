'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconMapPin, IconHeart, IconArrowLeft } from '@tabler/icons-react';
import StatusBar from '../components/StatusBar';
import { createClient } from '@/lib/supabase/client';
import RestaurantDetailTabs from '../components/RestaurantDetailTabs';
import type { MapPin } from '../components/HomeMap';
import type { PlaceDetails } from '../api/place-details/route';

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
  const [items, setItems] = useState<SavedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MapPin[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

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

  // Get user location once for the detail sheet
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      p => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000 },
    );
  }, []);

  // Fetch place details whenever selected pin changes
  useEffect(() => {
    const pin = selectedPin;
    if (!pin) { setDetails(null); setSuggestions([]); return; }
    setDetails(null);
    setSuggestions([]);
    setDetailsLoading(true);
    const qs = new URLSearchParams({
      name: pin.name,
      lat: String(pin.lat),
      lng: String(pin.lng),
      ...(pin.address ? { address: pin.address } : {}),
      ...(userLocation ? { userLat: String(userLocation.lat), userLng: String(userLocation.lng) } : {}),
    });
    fetch(`/api/place-details?${qs}`)
      .then(r => r.json())
      .then((d: PlaceDetails) => setDetails(d))
      .catch(() => {})
      .finally(() => setDetailsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPin?.id]);

  async function loadSuggestions(pin: MapPin) {
    if (suggestionsLoading) return;
    setSuggestionsLoading(true);
    try {
      const cuisine = pin.cuisineType?.toLowerCase().replace(/[^a-z0-9|]/g, '') || 'restaurant';
      const isAmenity = /cafe|coffee|café/.test(cuisine);
      const inner = isAmenity
        ? `node["amenity"="cafe"](around:1500,${pin.lat},${pin.lng});
           way["amenity"="cafe"](around:1500,${pin.lat},${pin.lng});`
        : `node["amenity"="restaurant"]["cuisine"~"${cuisine}",i](around:1500,${pin.lat},${pin.lng});
           way["amenity"="restaurant"]["cuisine"~"${cuisine}",i](around:1500,${pin.lat},${pin.lng});
           node["amenity"="restaurant"](around:800,${pin.lat},${pin.lng});
           way["amenity"="restaurant"](around:800,${pin.lat},${pin.lng});`;
      const query = `[out:json][timeout:10];\n(\n${inner}\n);\nout center 10;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
      const data = await res.json();
      const pins: MapPin[] = (data.elements as Record<string, unknown>[])
        .map(el => {
          const tags = (el.tags ?? {}) as Record<string, string>;
          const isWay = el.type === 'way';
          const center = (el.center ?? {}) as Record<string, number>;
          return {
            id: `sug-${el.id as string}`,
            name: tags.name ?? '',
            lat: isWay ? center.lat : el.lat as number,
            lng: isWay ? center.lon : el.lon as number,
            cuisineType: tags.cuisine ?? pin.cuisineType,
            address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
            videoUrl: null,
            rating: null,
          };
        })
        .filter(p => p.name && p.name !== pin.name && p.lat && p.lng)
        .slice(0, 5);
      setSuggestions(pins);
    } catch { /* ignore */ }
    finally { setSuggestionsLoading(false); }
  }

  function handleTap(item: SavedEntry) {
    if (!item.lat || !item.lng) return;
    setSelectedPin({
      id: String(item.id),
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      cuisineType: item.cuisineType,
      address: item.address,
      rating: item.rating,
      videoUrl: null,
    });
  }

  return (
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)', position: 'relative', overflow: 'hidden' }}>

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
      <main className="flex-1 overflow-y-auto" style={{ padding: '4px 14px', paddingBottom: 'calc(16px + 64px)' }}>
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

      {/* Detail sheet overlay */}
      {selectedPin && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedPin(null); }}
        >
          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={() => setSelectedPin(null)} />

          {/* Sheet */}
          <div style={{
            position: 'relative', zIndex: 1,
            background: 'var(--cream)',
            borderRadius: '22px 22px 0 0',
            boxShadow: '0 -8px 32px rgba(60,22,14,0.18)',
            display: 'flex', flexDirection: 'column',
            height: '88%',
            animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#D3D1C7' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '4px 16px 10px', flexShrink: 0 }}>
              <button
                onClick={() => setSelectedPin(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontFamily: 'inherit' }}>
                <IconArrowLeft size={17} color="#E24B4A" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#E24B4A' }}>Back to saved</span>
              </button>
              <p className="font-display" style={{ fontSize: 23, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.15 }}>
                {selectedPin.name}
              </p>
              {selectedPin.cuisineType && (
                <p style={{ fontSize: 12, color: '#888780', margin: 0 }}>{selectedPin.cuisineType}</p>
              )}
            </div>

            <div style={{ height: 1, background: '#F0EFEC', flexShrink: 0 }} />

            {/* Tabs content */}
            <RestaurantDetailTabs
              key={selectedPin.id}
              pin={selectedPin}
              details={details}
              detailsLoading={detailsLoading}
              userLocation={userLocation}
              suggestions={suggestions}
              suggestionsLoading={suggestionsLoading}
              loadSuggestions={loadSuggestions}
              onSelectSuggestion={sug => setSelectedPin(sug)}
              showToast={showToast}
            />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: toast.ok ? 'var(--tomato)' : '#E24B4A', color: 'white',
          borderRadius: 99, padding: '8px 18px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%) }
          to   { transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
