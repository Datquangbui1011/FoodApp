'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  IconLink,
  IconBrandTiktok,
  IconBrandFacebook,
  IconBrandYoutube,
  IconBrandInstagram,
  IconMapPin,
  IconStar,
  IconStarFilled,
  IconHeart,
  IconHeartFilled,
  IconLoader2,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { MapPin } from './HomeMap';
import type { PlaceDetails } from '../api/place-details/route';

const HomeMap = dynamic(() => import('./HomeMap'), { ssr: false });

// ─── Categories ───────────────────────────────────────────────────────────────
interface Category {
  label: string;
  cuisine?: string;
  isAmenity?: boolean;
}

const CATEGORIES: Category[] = [
  { label: '🍜 Pho',    cuisine: 'vietnamese|pho' },
  { label: '🍜 Ramen',  cuisine: 'ramen' },
  { label: '🍖 BBQ',    cuisine: 'bbq|barbecue|korean_bbq' },
  { label: '☕ Cafe',    isAmenity: true },
  { label: '🍕 Pizza',  cuisine: 'pizza' },
  { label: '🍣 Sushi',  cuisine: 'sushi|japanese' },
  { label: '🌮 Tacos',  cuisine: 'mexican|tacos' },
  { label: '🍔 Burger', cuisine: 'burger' },
];

async function fetchNearby(lat: number, lng: number, cat: Category): Promise<MapPin[]> {
  const radius = 3000;
  const inner = cat.isAmenity
    ? `node["amenity"="cafe"](around:${radius},${lat},${lng});
       way["amenity"="cafe"](around:${radius},${lat},${lng});`
    : `node["amenity"="restaurant"]["cuisine"~"${cat.cuisine}",i](around:${radius},${lat},${lng});
       way["amenity"="restaurant"]["cuisine"~"${cat.cuisine}",i](around:${radius},${lat},${lng});`;

  const query = `[out:json][timeout:15];\n(\n${inner}\n);\nout center 30;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
  const data = await res.json();

  return (data.elements as Record<string, unknown>[])
    .map(el => {
      const tags = (el.tags ?? {}) as Record<string, string>;
      const isWay = el.type === 'way';
      const center = (el.center ?? {}) as Record<string, number>;
      return {
        id: `osm-${el.id as string}`,
        name: tags.name ?? '',
        lat:  isWay ? center.lat  : el.lat as number,
        lng:  isWay ? center.lon  : el.lon as number,
        cuisineType: tags.cuisine ?? cat.label.replace(/^\S+\s/, ''),
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' '),
        videoUrl: null,
        rating: null,
      };
    })
    .filter(p => p.name && p.lat && p.lng);
}

// ─── Sheet snap ───────────────────────────────────────────────────────────────
const SHEET_HEIGHT   = 540;
const PEEK_HEIGHT    = 120;
const PEEK_TRANSLATE = SHEET_HEIGHT - PEEK_HEIGHT; // 420

type SheetSnap = 'hidden' | 'peek' | 'expanded';

function snapToY(snap: SheetSnap): number {
  if (snap === 'hidden') return SHEET_HEIGHT;
  if (snap === 'peek')   return PEEK_TRANSLATE;
  return 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function detectPlatform(url: string) {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return null;
}

const PLATFORM_ICONS = {
  tiktok: IconBrandTiktok,
  instagram: IconBrandInstagram,
  facebook: IconBrandFacebook,
  youtube: IconBrandYoutube,
};


function StarRating({ rating, count }: { rating: number | null | undefined; count?: number | null }) {
  if (rating == null) return null;
  const full = Math.round(rating);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i =>
        i <= full
          ? <IconStarFilled key={i} size={11} color="#F5A623" />
          : <IconStar key={i} size={11} color="#D3D1C7" />,
      )}
      <span style={{ fontSize: 8, color: '#888780', marginLeft: 3 }}>
        {rating.toFixed(1)}{count ? ` (${count.toLocaleString()})` : ''}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeMapClient() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [savedPins, setSavedPins]         = useState<MapPin[]>([]);
  const [nearbyPins, setNearbyPins]       = useState<MapPin[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [userLocation, setUserLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [resultPins, setResultPins]       = useState<MapPin[]>([]);
  const [savedNames, setSavedNames]       = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [snap, setSnap]                   = useState<SheetSnap>('hidden');
  const [details, setDetails]             = useState<PlaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);
  const [hideHowTo, setHideHowTo]         = useState(false);

  const sheetRef       = useRef<HTMLDivElement>(null);
  const toastTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragging       = useRef(false);
  const startClientY   = useRef(0);
  const startTranslateY = useRef(0);

  const platform     = detectPlatform(url);
  const isValid      = url.trim().length > 0 && platform !== null;
  const PlatformIcon = platform ? PLATFORM_ICONS[platform] : null;
  const allPins      = [...savedPins, ...nearbyPins, ...resultPins];
  const selectedPin  = allPins.find(p => p.id === selectedId) ?? null;
  const isResult     = resultPins.some(p => p.id === selectedId);
  const isSaved      = selectedPin ? savedNames.has(selectedPin.name) : false;

  // Read result from sessionStorage after processing redirects back here
  useEffect(() => {
    async function init() {
      const raw = sessionStorage.getItem('foodmap_result');
      if (!raw) return;
      sessionStorage.removeItem('foodmap_result');
      try {
        const data = JSON.parse(raw) as {
          places?: { name?: string; lat?: number; lng?: number; address?: string; rating?: number }[];
          inference?: { topPick?: { name?: string; confidence?: number }; menuItems?: string[]; cuisineType?: string };
          videoUrl?: string;
        };
        const place = data.places?.[0];
        if (!place?.lat || !place?.lng) return;
        const inference = data.inference ?? {};
        const pin: MapPin = {
          id: `result-${Date.now()}`,
          name: place.name ?? inference.topPick?.name ?? 'Unknown',
          lat: place.lat,
          lng: place.lng,
          cuisineType: inference.cuisineType ?? '',
          address: place.address ?? '',
          videoUrl: data.videoUrl ?? null,
          rating: place.rating ?? null,
          menuItems: inference.menuItems ?? [],
          confidence: inference.topPick?.confidence != null
            ? Math.round(inference.topPick.confidence * 100)
            : null,
        };
        setResultPins([pin]);
        setSelectedId(pin.id);
        setSnap('peek');
      } catch { /* malformed */ }
    }
    init();
  }, []);

  // Animate sheet
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.32s cubic-bezier(0.32,0.72,0,1)';
    el.style.transform  = `translateY(${snapToY(snap)}px)`;
  }, [snap]);

  // Fetch place details when pin selected
  useEffect(() => {
    const pin = selectedPin;
    async function load() {
      if (!pin) { setDetails(null); return; }
      setDetails(null);
      setDetailsLoading(true);
      try {
        const qs = new URLSearchParams({
          name: pin.name,
          lat:  String(pin.lat),
          lng:  String(pin.lng),
          ...(userLocation ? { userLat: String(userLocation.lat), userLng: String(userLocation.lng) } : {}),
          ...(pin.videoUrl ? { videoUrl: pin.videoUrl } : {}),
        });
        const d: PlaceDetails = await fetch(`/api/place-details?${qs}`).then(r => r.json());
        setDetails(d);
      } catch { /* ignore */ }
      finally { setDetailsLoading(false); }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const showToast = useCallback((msg: string, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Navigate to a pin from the Saved page
  useEffect(() => {
    async function nav() {
      const raw = sessionStorage.getItem('foodmap_navigate');
      if (!raw) return;
      sessionStorage.removeItem('foodmap_navigate');
      try {
        const pin: MapPin = JSON.parse(raw);
        pin.id = `nav-${Date.now()}`;
        setResultPins([pin]);
        setSelectedId(pin.id);
        setSnap('peek');
      } catch { /* ignore */ }
    }
    nav();
  }, []);

  function handlePinSelect(id: string | null) {
    setSelectedId(id);
    setSnap(id ? 'peek' : 'hidden');
  }

  function handleWrongPlace() {
    setResultPins([]);
    setSelectedId(null);
    setSnap('hidden');
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current      = true;
    startClientY.current  = e.clientY;
    startTranslateY.current = snapToY(snap);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const el = sheetRef.current;
    if (el) el.style.transition = 'none';
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const newY = Math.max(0, startTranslateY.current + (e.clientY - startClientY.current));
    const el = sheetRef.current;
    if (el) el.style.transform = `translateY(${newY}px)`;
  }
  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    const relY = Math.max(0, startTranslateY.current + (e.clientY - startClientY.current));
    const snaps: [SheetSnap, number][] = [['expanded', 0], ['peek', PEEK_TRANSLATE], ['hidden', SHEET_HEIGHT]];
    const [best] = snaps.reduce((a, b) => Math.abs(b[1] - relY) < Math.abs(a[1] - relY) ? b : a);
    if (best === 'hidden') setSelectedId(null);
    setSnap(best);
  }

  // ── Category ──────────────────────────────────────────────────────────────
  async function handleCategoryPress(cat: Category) {
    if (activeCategory === cat.label) {
      setActiveCategory(null);
      setNearbyPins([]);
      return;
    }
    setActiveCategory(cat.label);
    setLoadingNearby(true);
    setNearbyPins([]);
    setSelectedId(null);
    setSnap('hidden');
    try {
      const loc = await new Promise<{ lat: number; lng: number }>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          reject, { timeout: 8000 },
        ),
      );
      setUserLocation(loc);
      setNearbyPins(await fetchNearby(loc.lat, loc.lng, cat));
    } catch { /* no results */ }
    finally { setLoadingNearby(false); }
  }

  // ── Load saved pins ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('saved_restaurants')
        .select('id, restaurant_name, lat, lng, cuisine_type, address, video_url, rating')
        .eq('user_id', user.id)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (data) {
        const pins = data.map(row => ({
          id: row.id,
          name: row.restaurant_name,
          lat: row.lat as number,
          lng: row.lng as number,
          cuisineType: row.cuisine_type ?? '',
          address: row.address ?? '',
          videoUrl: (row as Record<string, unknown>).video_url as string | null ?? null,
          rating: (row as Record<string, unknown>).rating as number | null ?? null,
        }));
        setSavedPins(pins);
        setSavedNames(new Set(pins.map(p => p.name)));
      }
    })();
  }, []);

  // ── Save / unsave ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedPin || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      if (isSaved) {
        const { error } = await supabase.from('saved_restaurants').delete()
          .eq('user_id', user.id).eq('restaurant_name', selectedPin.name);
        if (error) throw error;
        setSavedNames(prev => { const s = new Set(prev); s.delete(selectedPin.name); return s; });
        setSavedPins(prev => prev.filter(p => p.name !== selectedPin.name));
        showToast('Removed from saved');
      } else {
        const row: Record<string, unknown> = {
          user_id: user.id,
          restaurant_name: selectedPin.name,
          lat: selectedPin.lat,
          lng: selectedPin.lng,
          cuisine_type: selectedPin.cuisineType || null,
          address: selectedPin.address || null,
        };
        if (selectedPin.videoUrl != null) row.video_url = selectedPin.videoUrl;
        if (selectedPin.rating != null) row.rating = selectedPin.rating;
        const { error } = await supabase
          .from('saved_restaurants')
          .upsert(row, { onConflict: 'user_id,restaurant_name' });
        if (error) throw error;
        setSavedNames(prev => new Set([...prev, selectedPin.name]));
        setSavedPins(prev => [...prev, { ...selectedPin }]);
        showToast('Saved ♥');
      }
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Save failed — are you signed in?', false);
    } finally { setSaving(false); }
  }

  async function analyzeOrReuse(rawUrl: string) {
    if (!rawUrl.trim() || !detectPlatform(rawUrl)) return;
    const trimmed = rawUrl.trim();

    // Check if this URL was already analyzed and saved
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('saved_restaurants')
          .select('id, restaurant_name, lat, lng, cuisine_type, address, rating')
          .eq('user_id', user.id)
          .eq('video_url', trimmed)
          .limit(1)
          .single();

        if (data?.lat && data?.lng) {
          const pin: MapPin = {
            id: `cached-${data.id}`,
            name: data.restaurant_name,
            lat: data.lat as number,
            lng: data.lng as number,
            cuisineType: data.cuisine_type ?? '',
            address: data.address ?? '',
            videoUrl: trimmed,
            rating: (data as Record<string, unknown>).rating as number | null ?? null,
          };
          setResultPins([pin]);
          setSelectedId(pin.id);
          setSnap('peek');
          showToast('Loaded from your saved places');
          setUrl('');
          return;
        }
      }
    } catch { /* not cached — fall through to processing */ }

    router.push(`/processing?url=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    analyzeOrReuse(url);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1" style={{ overflow: 'hidden' }}>
      <div className="absolute inset-0">
        <HomeMap
          savedPins={savedPins}
          nearbyPins={nearbyPins}
          resultPins={resultPins}
          selectedId={selectedId}
          onSelect={handlePinSelect}
          userLocation={userLocation}
        />
      </div>

      {/* Floating controls */}
      <div className="absolute top-3 left-3 right-3 z-10">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)' }}>
            {PlatformIcon ? <PlatformIcon size={14} color="#0F6E56" /> : <IconLink size={14} color="#888780" />}
            <input
              type="url" value={url}
              onChange={e => setUrl(e.target.value)}
              onPaste={e => {
                const text = e.clipboardData.getData('text');
                if (detectPlatform(text)) {
                  e.preventDefault();
                  setUrl(text);
                  setTimeout(() => analyzeOrReuse(text), 80);
                }
              }}
              placeholder="Paste a food video link to find a restaurant…"
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 10, color: '#2C2C2A' }}
            />
            {isValid && (
              <button type="submit"
                style={{ fontSize: 9, fontWeight: 600, color: 'white', background: '#0F6E56', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Go
              </button>
            )}
          </div>
        </form>

        {/* Category chips */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingBottom: 2 }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.label;
            return (
              <button key={cat.label} onClick={() => handleCategoryPress(cat)}
                style={{
                  fontSize: 9, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                  border: `1px solid ${active ? '#0F6E56' : 'rgba(0,0,0,0.10)'}`,
                  background: active ? '#0F6E56' : 'rgba(255,255,255,0.96)',
                  color: active ? 'white' : '#2C2C2A', borderRadius: 9999,
                  padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                {loadingNearby && active && <IconLoader2 size={9} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* How it works banner — shown when map is empty and sheet is hidden */}
        {!hideHowTo && allPins.length === 0 && snap === 'hidden' && (
          <div style={{ marginTop: 10, background: 'white', borderRadius: 14, padding: '12px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#2C2C2A', margin: 0 }}>How it works</p>
              <button onClick={() => setHideHowTo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D3D1C7', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['📋', 'Paste a video link above'], ['🤖', 'AI finds the restaurant'], ['📍', 'See it on the map']].map(([icon, text], i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                  <p style={{ fontSize: 7.5, color: '#5F5E5A', margin: 0, lineHeight: 1.4 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex gap-2 mt-1.5">
          {savedPins.length > 0 && !activeCategory && snap === 'hidden' && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', fontSize: 8, color: '#0F6E56', fontWeight: 500 }}>
              <IconMapPin size={10} color="#0F6E56" />
              {savedPins.length} saved
            </div>
          )}
          {activeCategory && !loadingNearby && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', fontSize: 8, color: nearbyPins.length > 0 ? '#E85D04' : '#888780', fontWeight: 500 }}>
              <IconMapPin size={10} color={nearbyPins.length > 0 ? '#E85D04' : '#D3D1C7'} />
              {nearbyPins.length > 0 ? `${nearbyPins.length} nearby ${activeCategory.replace(/^\S+\s/, '')}` : 'None found nearby'}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: toast.ok ? '#0F6E56' : '#E24B4A', color: 'white',
          borderRadius: 99, padding: '8px 18px', fontSize: 10, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
          animation: 'fadeUp 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────────── */}
      <div ref={sheetRef} className="absolute bottom-0 left-0 right-0 z-20"
        style={{ height: SHEET_HEIGHT, transform: `translateY(${SHEET_HEIGHT}px)`, background: 'white', borderRadius: '18px 18px 0 0', boxShadow: '0 -6px 28px rgba(0,0,0,0.14)', display: 'flex', flexDirection: 'column' }}>

        {/* Drag handle + peek header */}
        <div style={{ touchAction: 'none', cursor: 'grab', flexShrink: 0 }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#D3D1C7' }} />
          </div>
          {selectedPin && (
            <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 10 }}>
              {/* Name row + save button */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A', margin: '0 0 4px', lineHeight: 1.25, flex: 1 }}>
                  {selectedPin.name}
                </p>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, marginTop: 1 }}>
                  {isSaved
                    ? <IconHeartFilled size={20} color="#E24B4A" />
                    : <IconHeart size={20} color="#D3D1C7" />}
                </button>
              </div>
              {/* Rating + price + open + distance */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StarRating rating={details?.rating ?? selectedPin.rating} count={details?.ratingCount ?? null} />
                {details?.priceLevel != null && (
                  <span style={{ fontSize: 8, color: '#888780' }}>
                    {'$'.repeat(details.priceLevel) || 'Free'}
                  </span>
                )}
                {details?.openNow != null && (
                  <span style={{ fontSize: 8, fontWeight: 600, color: details.openNow ? '#0F6E56' : '#E24B4A' }}>
                    {details.openNow ? '● Open' : '● Closed'}
                  </span>
                )}
                {details?.duration && details?.distance && (
                  <span style={{ fontSize: 8, color: '#888780' }}>
                    {details.distance} · {details.duration}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                <p style={{ fontSize: 9, color: '#888780', margin: 0 }}>{selectedPin.cuisineType}</p>
                {isResult && (
                  <button onClick={handleWrongPlace}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 8, color: '#B0AFA9', padding: 0, fontFamily: 'inherit' }}>
                    Wrong place?
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable expanded content */}
        {selectedPin && (
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
            <div style={{ height: 1, background: '#F0EFEC', marginBottom: 12 }} />

            {/* ── Photos ── */}
            {detailsLoading && !details && (
              <div style={{ display: 'flex', gap: 8, paddingLeft: 16, paddingRight: 16, marginBottom: 12 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ width: 88, height: 80, borderRadius: 10, background: '#F7F6F3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconLoader2 size={14} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ))}
              </div>
            )}
            {(details?.photoUrls ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingLeft: 16, paddingRight: 16, marginBottom: 14, scrollbarWidth: 'none' }}>
                {details!.photoUrls.map((u, i) => (
                  <img key={i} src={u} alt="" style={{ width: 100, height: 88, objectFit: 'cover', borderRadius: 10, flexShrink: 0, display: 'block' }} />
                ))}
              </div>
            )}

            {/* ── Quick actions ── */}
            {details && (details.phone || details.website) && (
              <div style={{ display: 'flex', gap: 8, paddingLeft: 16, paddingRight: 16, marginBottom: 14 }}>
                {details.phone && (
                  <a href={`tel:${details.phone}`}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, padding: '9px 0', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.08)', textDecoration: 'none', fontSize: 9, fontWeight: 600, color: '#2C2C2A' }}>
                    📞 Call
                  </a>
                )}
                {details.website && (
                  <a href={details.website} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, padding: '9px 0', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.08)', textDecoration: 'none', fontSize: 9, fontWeight: 600, color: '#2C2C2A' }}>
                    🌐 Website
                  </a>
                )}
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPin.name} ${selectedPin.address}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, padding: '9px 0', background: '#0F6E56', textDecoration: 'none', fontSize: 9, fontWeight: 600, color: 'white' }}>
                  🗺 Directions
                </a>
              </div>
            )}

            <div style={{ paddingLeft: 16, paddingRight: 16 }}>

              {/* ── Summary ── */}
              {details?.summary && (
                <div style={{ background: '#F7F6F3', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <p style={{ fontSize: 9, color: '#5F5E5A', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                    &ldquo;{details.summary}&rdquo;
                  </p>
                </div>
              )}

              {/* ── Info rows ── */}
              {(details?.address ?? selectedPin.address) && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <p style={{ fontSize: 9, color: '#5F5E5A', margin: 0, lineHeight: 1.5 }}>{details?.address ?? selectedPin.address}</p>
                </div>
              )}
              {details?.hoursToday && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>🕐</span>
                  <p style={{ fontSize: 9, color: '#5F5E5A', margin: 0 }}>{details.hoursToday}</p>
                </div>
              )}
              {details?.distance && details?.duration && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>🚗</span>
                  <p style={{ fontSize: 9, color: '#5F5E5A', margin: 0 }}>{details.distance} away · {details.duration} by car</p>
                </div>
              )}
              {details?.phone && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>📞</span>
                  <a href={`tel:${details.phone}`} style={{ fontSize: 9, color: '#0F6E56', margin: 0, textDecoration: 'none', fontWeight: 500 }}>{details.phone}</a>
                </div>
              )}

              {/* ── Top reviews ── */}
              {(details?.topReviews ?? []).length > 0 && (
                <div style={{ marginTop: 12, marginBottom: 4 }}>
                  <p style={{ fontSize: 9, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    What people say
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {details!.topReviews.slice(0, 2).map((review, i) => (
                      <div key={i} style={{ background: '#F7F6F3', borderRadius: 10, padding: '9px 12px' }}>
                        <p style={{ fontSize: 8.5, color: '#5F5E5A', margin: 0, lineHeight: 1.6,
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          &ldquo;{review}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: '#F0EFEC', margin: '14px 0' }} />

              {/* ── Spotted in video ── */}
              {selectedPin.menuItems && selectedPin.menuItems.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <p style={{ fontSize: 9, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Spotted in video</p>
                    {selectedPin.confidence != null && (
                      <span style={{ fontSize: 7, fontWeight: 700, color: 'white',
                        background: selectedPin.confidence >= 80 ? '#0F6E56' : selectedPin.confidence >= 60 ? '#E8A020' : '#E24B4A',
                        borderRadius: 99, padding: '2px 6px' }}>
                        {selectedPin.confidence}% match
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedPin.menuItems.map((item, i) => (
                      <span key={i} style={{ fontSize: 9, color: '#5F5E5A', background: '#F7F6F3', borderRadius: 99, padding: '4px 10px', border: '1px solid #E8E7E4' }}>
                        {item}
                      </span>
                    ))}
                  </div>
                  <div style={{ height: 1, background: '#F0EFEC', marginTop: 14 }} />
                </div>
              )}

              {/* ── TikTok videos ── */}
              <p style={{ fontSize: 9, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 14 }}>
                Video Reviews
              </p>

              {detailsLoading && !(details?.tiktoks?.length) && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ width: 130, height: 100, borderRadius: 12, background: '#F7F6F3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconLoader2 size={14} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  ))}
                </div>
              )}

              {(details?.tiktoks ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
                  {details!.tiktoks.map((vid, i) => (
                    <a key={i} href={vid.videoUrl} target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink: 0, width: 130, borderRadius: 12, overflow: 'hidden', display: 'block', textDecoration: 'none', background: '#000', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div style={{ position: 'relative', height: 100 }}>
                        {vid.thumbnail
                          ? <img src={vid.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <div style={{ width: '100%', height: '100%', background: '#111' }} />}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconPlayerPlay size={12} color="white" fill="white" />
                          </div>
                        </div>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px' }}>
                          {vid.author && <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', margin: '0 0 1px', fontWeight: 600 }}>@{vid.author}</p>}
                          <p style={{ fontSize: 7.5, color: 'white', margin: 0, lineHeight: 1.3,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {vid.title}
                          </p>
                        </div>
                        <div style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <IconBrandTiktok size={7} color="white" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {!detailsLoading && details && !(details.tiktoks?.length) && (
                <a href={`https://www.tiktok.com/search?q=${encodeURIComponent(selectedPin.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, padding: '12px 0', background: '#000', color: 'white', textDecoration: 'none', fontSize: 9, fontWeight: 600, marginBottom: 12 }}>
                  <IconBrandTiktok size={14} />
                  Search on TikTok
                </a>
              )}

              {/* ── Directions (fallback if no phone/website) ── */}
              {details && !details.phone && !details.website && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPin.name} ${selectedPin.address}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, padding: '11px 0', background: '#0F6E56', color: 'white', fontSize: 10, fontWeight: 600, textDecoration: 'none', marginTop: 4 }}>
                  <IconMapPin size={13} />
                  Get Directions
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
      `}</style>
    </div>
  );
}
