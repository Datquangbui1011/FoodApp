'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconArrowLeft, IconMapPin, IconTrash } from '@tabler/icons-react';
import StatusBar from '../../components/StatusBar';
import RestaurantDetailTabs from '../../components/RestaurantDetailTabs';
import type { MapPin } from '../../components/HomeMap';
import type { PlaceDetails } from '../../api/place-details/route';

const COLORS = ['#F2DACE', '#EFE2C8', '#EAD6CB', '#F3DCCF'];

interface CollectionItem {
  id: string;
  place_id: string;
  restaurant_name: string;
  lat: number;
  lng: number;
  address: string | null;
  cuisine_type: string | null;
  photo_url: string | null;
  rating: number | null;
}

interface CollectionMeta {
  id: string;
  name: string;
  emoji: string;
}

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meta, setMeta] = useState<CollectionMeta | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
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
    // Load collection meta from the list endpoint
    fetch(`/api/collections`)
      .then(r => r.json())
      .then((cols: CollectionMeta[]) => {
        const found = cols.find(c => c.id === id);
        if (found) setMeta(found);
      })
      .catch(() => {});

    fetch(`/api/collections/${id}/items`)
      .then(r => r.json())
      .then((data: CollectionItem[]) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));

    navigator.geolocation.getCurrentPosition(
      p => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 8000 },
    );
  }, [id]);

  useEffect(() => {
    const pin = selectedPin;
    if (!pin) { setDetails(null); setSuggestions([]); return; }
    setDetails(null); setSuggestions([]); setDetailsLoading(true);
    const qs = new URLSearchParams({
      name: pin.name, lat: String(pin.lat), lng: String(pin.lng),
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
        ? `node["amenity"="cafe"](around:1500,${pin.lat},${pin.lng});`
        : `node["amenity"="restaurant"]["cuisine"~"${cuisine}",i](around:1500,${pin.lat},${pin.lng});
           node["amenity"="restaurant"](around:800,${pin.lat},${pin.lng});`;
      const query = `[out:json][timeout:10];\n(\n${inner}\n);\nout center 10;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
      const data = await res.json();
      const pins: MapPin[] = (data.elements as Record<string, unknown>[])
        .map(el => {
          const tags = (el.tags ?? {}) as Record<string, string>;
          return {
            id: `sug-${el.id as string}`, name: tags.name ?? '',
            lat: el.lat as number, lng: el.lon as number,
            cuisineType: tags.cuisine ?? pin.cuisineType, address: '',
            videoUrl: null, rating: null,
          };
        })
        .filter(p => p.name && p.name !== pin.name)
        .slice(0, 5);
      setSuggestions(pins);
    } catch { /* ignore */ }
    finally { setSuggestionsLoading(false); }
  }

  async function removeItem(item: CollectionItem) {
    await fetch(`/api/collections/${id}/items?placeId=${encodeURIComponent(item.place_id)}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('Removed from list');
  }

  return (
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)', position: 'relative', overflow: 'hidden' }}>

      <header style={{ flexShrink: 0 }}>
        <StatusBar />
        <div style={{ padding: '0 18px 14px' }}>
          <button onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', fontFamily: 'inherit' }}>
            <IconArrowLeft size={17} color="var(--tomato)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tomato)' }}>Collections</span>
          </button>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 600, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>
            {meta ? `${meta.emoji} ${meta.name}` : '…'}
          </h1>
          {!loading && (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0 0' }}>
              {items.length} {items.length === 1 ? 'place' : 'places'}
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: '4px 14px', paddingBottom: 'calc(16px + 64px)' }}>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ borderRadius: 'var(--radius)', overflow: 'hidden', background: 'white', boxShadow: 'var(--shadow-warm-sm)' }}>
                <div style={{ height: 100, background: '#F0EFEC' }} />
                <div style={{ padding: '10px 11px 12px' }}>
                  <div style={{ height: 9, borderRadius: 5, background: '#F0EFEC', marginBottom: 7, width: '75%' }} />
                  <div style={{ height: 7, borderRadius: 5, background: '#F0EFEC', width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80, gap: 14 }}>
            <p className="font-display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>This list is empty</p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', textAlign: 'center' }}>
              Save restaurants here using the bookmark button.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, i) => (
              <div key={item.id} style={{ borderRadius: 'var(--radius)', overflow: 'hidden', background: 'white', boxShadow: 'var(--shadow-warm-sm)', position: 'relative' }}>
                <button
                  onClick={() => setSelectedPin({
                    id: item.id, name: item.restaurant_name,
                    lat: item.lat, lng: item.lng,
                    cuisineType: item.cuisine_type ?? '',
                    address: item.address ?? '',
                    rating: item.rating, videoUrl: null,
                  })}
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: 0, display: 'block', background: 'none', border: 'none' }}
                >
                  <div style={{ height: 104, background: COLORS[i % COLORS.length], position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span aria-hidden style={{ fontSize: 30, opacity: 0.5 }}>🍽️</span>
                    {item.photo_url && (
                      <img src={item.photo_url} alt={item.restaurant_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }}
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
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.restaurant_name}
                    </p>
                    {item.cuisine_type ? (
                      <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{item.cuisine_type}</span>
                    ) : item.address ? (
                      <span style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IconMapPin size={11} color="var(--ink-mute)" />{item.address.split(',')[0]}
                      </span>
                    ) : null}
                  </div>
                </button>
                {/* Remove button */}
                <button
                  onClick={() => removeItem(item)}
                  style={{ position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconTrash size={13} color="white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detail sheet */}
      {selectedPin && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedPin(null); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={() => setSelectedPin(null)} />
          <div style={{ position: 'relative', zIndex: 1, background: 'var(--cream)', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 32px rgba(60,22,14,0.18)', display: 'flex', flexDirection: 'column', height: '88%', animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#D3D1C7' }} />
            </div>
            <div style={{ padding: '4px 16px 10px', flexShrink: 0 }}>
              <button onClick={() => setSelectedPin(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontFamily: 'inherit' }}>
                <IconArrowLeft size={17} color="#E24B4A" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#E24B4A' }}>Back to list</span>
              </button>
              <p className="font-display" style={{ fontSize: 23, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.15 }}>{selectedPin.name}</p>
              {selectedPin.cuisineType && <p style={{ fontSize: 12, color: '#888780', margin: 0 }}>{selectedPin.cuisineType}</p>}
            </div>
            <div style={{ height: 1, background: '#F0EFEC', flexShrink: 0 }} />
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

      {toast && (
        <div style={{ position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: toast.ok ? 'var(--tomato)' : '#E24B4A', color: 'white', borderRadius: 99, padding: '8px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </div>
  );
}
