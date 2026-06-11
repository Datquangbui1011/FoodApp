'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
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
  IconPhone,
  IconChevronUp,
  IconChevronDown,
  IconArrowLeft,
  IconSearch,
} from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { MapPin } from './HomeMap';
import type { PlaceDetails } from '../api/place-details/route';
import type { NearbyRestaurant } from '../api/nearby-restaurants/route';

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

function StarRating({ rating, count }: { rating: number | null | undefined; count?: number | null }) {
  if (rating == null) return null;
  const full = Math.round(rating);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i =>
        i <= full
          ? <IconStarFilled key={i} size={14} color="#F5A623" />
          : <IconStar key={i} size={14} color="#D3D1C7" />,
      )}
      <span style={{ fontSize: 10, color: '#888780', marginLeft: 3 }}>
        {rating.toFixed(1)}{count ? ` (${count.toLocaleString()})` : ''}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeMapClient() {
  const router = useRouter();
  const [searchQuery, setSearchQuery]     = useState('');
  const [savedPins, setSavedPins]         = useState<MapPin[]>([]);
  const [nearbyPins, setNearbyPins]       = useState<MapPin[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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
  const [suggestions, setSuggestions]     = useState<MapPin[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [discoverList, setDiscoverList]   = useState<NearbyRestaurant[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const discoverAllRef = useRef<NearbyRestaurant[]>([]);

  const sheetRef       = useRef<HTMLDivElement>(null);
  const toastTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragging       = useRef(false);
  const startClientY   = useRef(0);
  const startTranslateY = useRef(0);
  const sheetY         = useSpring(SHEET_HEIGHT, { stiffness: 400, damping: 40, mass: 0.8 });


  // Discover pins — numbered, shown on map when no result pins
  const discoverPins: MapPin[] = discoverList.map(r => ({
    id: `disc-${r.placeId}`, name: r.name, lat: r.lat, lng: r.lng,
    cuisineType: r.cuisineHint, address: r.address, rating: r.rating, videoUrl: null,
  }));
  const showDiscover = resultPins.length === 0;
  const mapResultPins = showDiscover ? discoverPins : resultPins;

  const allPins      = [...savedPins, ...nearbyPins, ...resultPins, ...discoverPins];
  const selectedPin  = allPins.find(p => p.id === selectedId) ?? null;
  const isResult     = resultPins.some(p => p.id === selectedId);
  const isSaved      = selectedPin ? savedNames.has(selectedPin.name) : false;
  const isDiscover   = discoverPins.some(p => p.id === selectedId);

  // Read result from sessionStorage after processing redirects back here
  useEffect(() => {
    async function init() {
      const raw = sessionStorage.getItem('foodmap_result');
      if (!raw) return;
      sessionStorage.removeItem('foodmap_result');
      try {
        const data = JSON.parse(raw) as {
          allPlaces?: { name: string; confidence: number; menuItems: string[]; cuisineType: string; places: { name?: string; lat?: number; lng?: number; address?: string; rating?: number }[] }[];
          places?: { name?: string; lat?: number; lng?: number; address?: string; rating?: number }[];
          inference?: { topPick?: { name?: string; confidence?: number }; menuItems?: string[]; cuisineType?: string };
          videoUrl?: string;
        };

        const ts = Date.now();
        const pins: MapPin[] = [];

        // Multi-restaurant path
        if (data.allPlaces && data.allPlaces.length > 0) {
          for (let i = 0; i < data.allPlaces.length; i++) {
            const entry = data.allPlaces[i];
            const place = entry.places?.[0];
            if (!place?.lat || !place?.lng) continue;
            pins.push({
              id: `result-${ts}-${i}`,
              name: place.name ?? entry.name,
              lat: place.lat,
              lng: place.lng,
              cuisineType: entry.cuisineType ?? '',
              address: place.address ?? '',
              videoUrl: data.videoUrl ?? null,
              rating: place.rating ?? null,
              menuItems: entry.menuItems ?? [],
              confidence: Math.round(entry.confidence * 100),
            });
          }
        } else {
          // Legacy single-place path
          const place = data.places?.[0];
          if (place?.lat && place?.lng) {
            const inference = data.inference ?? {};
            pins.push({
              id: `result-${ts}-0`,
              name: place.name ?? inference.topPick?.name ?? 'Unknown',
              lat: place.lat,
              lng: place.lng,
              cuisineType: inference.cuisineType ?? '',
              address: place.address ?? '',
              videoUrl: data.videoUrl ?? null,
              rating: place.rating ?? null,
              menuItems: inference.menuItems ?? [],
              confidence: inference.topPick?.confidence != null ? Math.round(inference.topPick.confidence * 100) : null,
            });
          }
        }

        if (pins.length === 0) return;
        setResultPins(pins);
        setSelectedId(pins[0].id);
        setSnap('peek');
      } catch { /* malformed */ }
    }
    init();
  }, []);

  // Animate sheet with spring
  useEffect(() => { sheetY.set(snapToY(snap)); }, [snap, sheetY]);

  // Fetch place details when pin selected
  useEffect(() => {
    const pin = selectedPin;
    async function load() {
      if (!pin) { setDetails(null); setSuggestions([]); setShowSuggestions(false); return; }
      setDetails(null);
      setSuggestions([]);
      setShowSuggestions(false);
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
        // Auto-load suggestions if place is closed
        if (d.openNow === false) loadSuggestions(pin, true);
      } catch { /* ignore */ }
      finally { setDetailsLoading(false); }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function loadSuggestions(pin: MapPin, auto = false) {
    if (suggestionsLoading) return;
    setShowSuggestions(true);
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
            lat:  isWay ? center.lat : el.lat as number,
            lng:  isWay ? center.lon : el.lon as number,
            cuisineType: tags.cuisine ?? pin.cuisineType,
            address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
            videoUrl: null,
            rating: null,
          };
        })
        .filter(p => p.name && p.name !== pin.name && p.lat && p.lng)
        .slice(0, 5);
      setSuggestions(pins);
      if (!auto && pins.length === 0) showToast('No similar places found nearby', false);
    } catch { /* ignore */ }
    finally { setSuggestionsLoading(false); }
  }

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
    sheetY.jump(snapToY(snap));
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const newY = Math.max(0, startTranslateY.current + (e.clientY - startClientY.current));
    sheetY.jump(newY);
  }
  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    const relY = Math.max(0, startTranslateY.current + (e.clientY - startClientY.current));
    // In discover mode (no selected pin) the sheet never hides — minimum is peek
    const hasContent = !!selectedId || discoverList.length > 0 || discoverLoading;
    const snaps: [SheetSnap, number][] = hasContent
      ? [['expanded', 0], ['peek', PEEK_TRANSLATE]]
      : [['expanded', 0], ['peek', PEEK_TRANSLATE], ['hidden', SHEET_HEIGHT]];
    const [best] = snaps.reduce((a, b) => Math.abs(b[1] - relY) < Math.abs(a[1] - relY) ? b : a);
    if (best === 'hidden') setSelectedId(null);
    setSnap(best);
  }

  // ── Category ──────────────────────────────────────────────────────────────
  async function handleCategoryPress(cat: Category) {
    // Deselect — restore the general list
    if (activeCategory === cat.label) {
      setActiveCategory(null);
      setNearbyPins([]);
      setDiscoverList(discoverAllRef.current);
      setSelectedId(null);
      setSnap('peek');
      return;
    }

    setActiveCategory(cat.label);
    setNearbyPins([]);
    setSelectedId(null);
    setDiscoverList([]);
    setDiscoverLoading(true);
    setSnap('peek');

    try {
      // Get location (use cached if available)
      const loc: { lat: number; lng: number } = userLocation ?? await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          reject, { timeout: 8000 },
        ),
      );
      setUserLocation(loc);

      // Map category to keyword + type for the Places API
      const keyword = cat.isAmenity ? 'cafe' : (cat.cuisine ?? '').split('|')[0];
      const type    = cat.isAmenity ? 'cafe' : 'restaurant';

      const qs = new URLSearchParams({
        lat: String(loc.lat), lng: String(loc.lng), keyword, type,
      });
      const data: NearbyRestaurant[] = await fetch(`/api/nearby-restaurants?${qs}`).then(r => r.json());
      setDiscoverList(data);
    } catch { /* ignore */ }
    finally { setDiscoverLoading(false); }
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

  // ── Auto-load discover restaurants on mount ───────────────────────────────
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setDiscoverLoading(true);
        try {
          const data: NearbyRestaurant[] = await fetch(
            `/api/nearby-restaurants?lat=${lat}&lng=${lng}`,
          ).then(r => r.json());
          setDiscoverList(data);
          discoverAllRef.current = data;
          // Auto-peek discover sheet if no result is showing yet
          setSnap(prev => prev === 'hidden' ? 'peek' : prev);
        } catch { /* ignore */ }
        finally { setDiscoverLoading(false); }
      },
      () => { /* no location — keep sheet hidden */ },
      { timeout: 8000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleSearch(query: string) {
    const q = query.trim();
    if (!q) return;
    setActiveCategory(null);
    setDiscoverList([]);
    setDiscoverLoading(true);
    setSelectedId(null);
    setSnap('peek');
    try {
      const loc: { lat: number; lng: number } = userLocation ?? await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          reject, { timeout: 8000 },
        ),
      );
      setUserLocation(loc);
      const qs = new URLSearchParams({ lat: String(loc.lat), lng: String(loc.lng), keyword: q });
      const data: NearbyRestaurant[] = await fetch(`/api/nearby-restaurants?${qs}`).then(r => r.json());
      setDiscoverList(data);
      if (data.length === 0) showToast('No results found nearby', false);
    } catch { showToast('Could not get location', false); }
    finally { setDiscoverLoading(false); }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    handleSearch(searchQuery);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1" style={{ overflow: 'hidden' }}>
      <div className="absolute inset-0">
        <HomeMap
          savedPins={savedPins}
          nearbyPins={nearbyPins}
          resultPins={mapResultPins}
          selectedId={selectedId}
          onSelect={handlePinSelect}
          userLocation={userLocation}
        />
      </div>

      {/* Floating controls */}
      <div className="absolute left-3 right-3 z-10" style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: 'var(--cream)', boxShadow: 'var(--shadow-warm)', border: '1px solid var(--border)' }}>
            <img src="/logo.png" alt="FoodApp" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
            <IconSearch size={18} color="#888780" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search restaurants, cuisines, dishes…"
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 13, color: '#2C2C2A' }}
            />
            {searchQuery.trim() && (
              <button type="submit"
                style={{ fontSize: 12, fontWeight: 600, color: 'white', background: '#E24B4A', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Search
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
                  fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
                  border: `1px solid ${active ? 'var(--tomato)' : 'rgba(0,0,0,0.10)'}`,
                  background: active ? 'var(--tomato)' : 'rgba(255,255,255,0.96)',
                  color: active ? 'white' : '#2C2C2A', borderRadius: 9999,
                  padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                {discoverLoading && active && <IconLoader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* How it works banner — shown when map is empty and sheet is hidden */}
        {!hideHowTo && allPins.length === 0 && snap === 'hidden' && (
          <div style={{ marginTop: 10, background: 'white', borderRadius: 14, padding: '12px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', margin: 0 }}>How it works</p>
              <button onClick={() => setHideHowTo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D3D1C7', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['📋', 'Paste a video link above'], ['🤖', 'AI finds the restaurant'], ['📍', 'See it on the map']].map(([icon, text], i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 23, marginBottom: 4 }}>{icon}</div>
                  <p style={{ fontSize: 10, color: '#5F5E5A', margin: 0, lineHeight: 1.4 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex gap-2 mt-1.5">
          {savedPins.length > 0 && !activeCategory && snap === 'hidden' && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', fontSize: 10, color: 'var(--tomato)', fontWeight: 500 }}>
              <IconMapPin size={13} color="var(--tomato)" />
              {savedPins.length} saved
            </div>
          )}
          {activeCategory && !discoverLoading && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 6px rgba(0,0,0,0.1)', fontSize: 10, color: nearbyPins.length > 0 ? '#E85D04' : '#888780', fontWeight: 500 }}>
              <IconMapPin size={13} color={nearbyPins.length > 0 ? '#E85D04' : '#D3D1C7'} />
              {nearbyPins.length > 0 ? `${nearbyPins.length} nearby ${activeCategory.replace(/^\S+\s/, '')}` : 'None found nearby'}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          background: toast.ok ? 'var(--tomato)' : '#E24B4A', color: 'white',
          borderRadius: 99, padding: '8px 18px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
          animation: 'fadeUp 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Multi-result card strip ── */}
      {resultPins.length > 1 && snap !== 'expanded' && (
        <div style={{
          position: 'absolute', bottom: snap === 'peek' ? PEEK_HEIGHT + 8 : 60, left: 0, right: 0,
          zIndex: 19, padding: '0 12px', transition: 'bottom 0.32s cubic-bezier(0.32,0.72,0,1)',
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {resultPins.length} places found in this video
            </span>
            <button onClick={handleWrongPlace}
              style={{ background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: 99, padding: '3px 10px', fontSize: 10, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear
            </button>
          </div>
          {/* Scrollable cards */}
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {resultPins.map((pin, i) => {
              const active = pin.id === selectedId;
              return (
                <button key={pin.id} onClick={() => { setSelectedId(pin.id); setSnap('peek'); }}
                  style={{
                    flexShrink: 0, width: 160, borderRadius: 14, padding: '10px 12px',
                    background: active ? 'var(--tomato)' : 'white',
                    border: active ? '2px solid var(--tomato)' : '1.5px solid rgba(0,0,0,0.08)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.14)', textAlign: 'left', cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {/* Number badge + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 99, flexShrink: 0,
                      background: active ? 'rgba(255,255,255,0.25)' : '#F0EFEC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'white' : '#2C2C2A' }}>{i + 1}</span>
                    </div>
                    <p style={{
                      fontSize: 13, fontWeight: 600, margin: 0, color: active ? 'white' : '#2C2C2A',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>{pin.name}</p>
                  </div>
                  {/* Cuisine + confidence */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.7)' : '#888780' }}>
                      {pin.cuisineType || 'Restaurant'}
                    </span>
                    {pin.confidence != null && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, borderRadius: 99, padding: '2px 6px',
                        background: active ? 'rgba(255,255,255,0.2)' : (pin.confidence >= 70 ? '#FFF0F0' : '#FFF3E0'),
                        color: active ? 'white' : (pin.confidence >= 70 ? 'var(--tomato)' : '#E85D04'),
                      }}>
                        {pin.confidence}%
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────────── */}
      <motion.div ref={sheetRef} className="absolute bottom-0 left-0 right-0 z-20"
        style={{ height: SHEET_HEIGHT, y: sheetY, background: 'var(--cream)', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 32px rgba(60,22,14,0.16)', display: 'flex', flexDirection: 'column' }}>

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
              {/* Back to list (only from discover) */}
              {isDiscover && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { setSelectedId(null); setSnap('peek'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', fontFamily: 'inherit' }}>
                  <IconArrowLeft size={17} color="#E24B4A" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#E24B4A' }}>Back to list</span>
                </button>
              )}
              {/* Name row + save button */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <p className="font-display" style={{ fontSize: 23, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.15, flex: 1 }}>
                  {selectedPin.name}
                </p>
                <button onClick={handleSave} disabled={saving}
                  onPointerDown={e => e.stopPropagation()}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, marginTop: 1 }}>
                  {isSaved
                    ? <IconHeartFilled size={26} color="#E24B4A" />
                    : <IconHeart size={26} color="#D3D1C7" />}
                </button>
              </div>
              {/* Rating + price + open + distance */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StarRating rating={details?.rating ?? selectedPin.rating} count={details?.ratingCount ?? null} />
                {details?.priceLevel != null && (
                  <span style={{ fontSize: 10, color: '#888780' }}>
                    {'$'.repeat(details.priceLevel) || 'Free'}
                  </span>
                )}
                {details?.openNow != null && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: details.openNow ? 'var(--tomato)' : '#E24B4A' }}>
                    {details.openNow ? '● Open' : '● Closed'}
                  </span>
                )}
                {details?.duration && details?.distance && (
                  <span style={{ fontSize: 10, color: '#888780' }}>
                    {details.distance} · {details.duration}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                <p style={{ fontSize: 12, color: '#888780', margin: 0 }}>{selectedPin.cuisineType}</p>
                {isResult && (
                  <button onClick={handleWrongPlace}
                    onPointerDown={e => e.stopPropagation()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#B0AFA9', padding: 0, fontFamily: 'inherit' }}>
                    Wrong place?
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Discover list (shown when no restaurant is selected) ── */}
        {!selectedPin && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 10px', flexShrink: 0 }}>
              <p className="font-display" style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                {discoverLoading ? 'Finding restaurants…' : `${discoverList.length} restaurants near you`}
              </p>
              <button onClick={() => setSnap(snap === 'peek' ? 'expanded' : 'peek')}
                style={{ background: '#F7F6F3', border: 'none', borderRadius: 99, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {snap === 'peek' ? <IconChevronUp size={17} color="#888780" /> : <IconChevronDown size={17} color="#888780" />}
              </button>
            </div>
            <div style={{ height: 1, background: '#F0EFEC', marginBottom: 8 }} />

            {/* Loading skeletons */}
            {discoverLoading && (
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', border: '1px solid #F0EFEC', height: 82 }}>
                    <div style={{ width: 90, background: '#EEEDEA', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
                    </div>
                    <div style={{ flex: 1, padding: '10px 12px' }}>
                      <div style={{ height: 9, background: '#EEEDEA', borderRadius: 5, width: '65%', marginBottom: 8 }} />
                      <div style={{ height: 7, background: '#EEEDEA', borderRadius: 5, width: '45%', marginBottom: 6 }} />
                      <div style={{ height: 7, background: '#EEEDEA', borderRadius: 5, width: '55%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Restaurant cards */}
            {!discoverLoading && (
              <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {discoverList.map((r, i) => {
                  const pinId = `disc-${r.placeId}`;
                  const active = selectedId === pinId;
                  return (
                    <div key={r.placeId}
                      onClick={() => { setSelectedId(pinId); setSnap('peek'); }}
                      style={{ display: 'flex', borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${active ? '#E24B4A' : '#F0EFEC'}`, cursor: 'pointer', background: active ? '#FFF5F5' : 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}>

                      {/* Photo — full left column */}
                      <div style={{ width: 90, flexShrink: 0, position: 'relative', background: '#F0EFEC', minHeight: 88 }}>
                        {r.photoUrl
                          ? <img src={r.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍽️</div>}
                        {/* Number badge */}
                        <div style={{ position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: '50%', background: active ? '#E24B4A' : 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{i + 1}</span>
                        </div>
                        {/* Open badge */}
                        {r.openNow != null && (
                          <div style={{ position: 'absolute', bottom: 6, left: 6, background: r.openNow ? 'var(--tomato)' : '#E24B4A', borderRadius: 99, padding: '2px 5px' }}>
                            <span style={{ fontSize: 9, fontWeight: 600, color: 'white' }}>{r.openNow ? 'Open' : 'Closed'}</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, padding: '10px 10px 10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2A', margin: '0 0 3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.name}</p>
                          <StarRating rating={r.rating} count={r.ratingCount} />
                          <span style={{ fontSize: 10, color: '#888780', display: 'block', marginTop: 2 }}>{r.cuisineHint}</span>
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                          <span style={{ fontSize: 10, color: '#B0AFA9' }}>{r.address.split(',')[0]}</span>
                          <a href="tel:" onClick={e => e.stopPropagation()}
                            style={{ width: 28, height: 28, borderRadius: '50%', background: '#E24B4A', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
                            <IconPhone size={16} color="white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Scrollable expanded content */}
        {selectedPin && (
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
            <div style={{ height: 1, background: '#F0EFEC', marginBottom: 12 }} />

            {/* ── Closed banner / No-tables button ── */}
            {details && (
              <div style={{ paddingLeft: 16, paddingRight: 16, marginBottom: 12 }}>
                {details.openNow === false ? (
                  <div style={{ background: '#FFF3E0', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 17 }}>🔒</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#C05000', margin: '0 0 1px' }}>Closed right now</p>
                      <p style={{ fontSize: 10, color: '#888780', margin: 0 }}>
                        {details.hoursToday ? `Today: ${details.hoursToday}` : 'Check back later'}
                      </p>
                    </div>
                    <button onClick={() => loadSuggestions(selectedPin)}
                      style={{ background: '#E85D04', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 10, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Alternatives
                    </button>
                  </div>
                ) : details.openNow === true && !showSuggestions ? (
                  <button onClick={() => loadSuggestions(selectedPin)}
                    style={{ width: '100%', background: 'none', border: '1px dashed #D3D1C7', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ fontSize: 16 }}>🪑</span>
                    <span style={{ fontSize: 10, color: '#888780' }}>No tables available? Find similar spots nearby</span>
                    <span style={{ fontSize: 13, color: '#B0AFA9', marginLeft: 'auto' }}>→</span>
                  </button>
                ) : null}
              </div>
            )}

            {/* ── Nearby suggestions ── */}
            {showSuggestions && (
              <div style={{ paddingLeft: 16, paddingRight: 16, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    Similar spots nearby
                  </p>
                  <button onClick={() => { setShowSuggestions(false); setSuggestions([]); }}
                    style={{ background: 'none', border: 'none', fontSize: 14, color: '#B0AFA9', cursor: 'pointer', padding: 0 }}>×</button>
                </div>

                {suggestionsLoading ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ flex: 1, height: 72, borderRadius: 10, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconLoader2 size={17} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
                      </div>
                    ))}
                  </div>
                ) : suggestions.length === 0 ? (
                  <p style={{ fontSize: 10, color: '#B0AFA9', textAlign: 'center', padding: '12px 0' }}>No similar places found within 1.5 km</p>
                ) : (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
                    {suggestions.map(sug => (
                      <button key={sug.id}
                        onClick={() => {
                          setResultPins(prev => [...prev.filter(p => !p.id.startsWith('sug-')), sug]);
                          setSelectedId(sug.id);
                          setSnap('peek');
                        }}
                        style={{ flexShrink: 0, width: 130, background: 'white', border: '1.5px solid #E8E7E3', borderRadius: 10, padding: '8px 10px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2A', margin: '0 0 3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {sug.name}
                        </p>
                        <p style={{ fontSize: 10, color: '#888780', margin: '0 0 5px' }}>
                          {sug.cuisineType || 'Restaurant'}
                        </p>
                        <span style={{ fontSize: 9, background: '#FFF0F0', color: 'var(--tomato)', borderRadius: 99, padding: '2px 7px', fontWeight: 600 }}>
                          View →
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Photos ── */}
            {detailsLoading && !details && (
              <div style={{ display: 'flex', gap: 8, paddingLeft: 16, paddingRight: 16, marginBottom: 12 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ width: 88, height: 80, borderRadius: 10, background: '#F7F6F3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
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
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, padding: '9px 0', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.08)', textDecoration: 'none', fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>
                    📞 Call
                  </a>
                )}
                {details.website && (
                  <a href={details.website} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, padding: '9px 0', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.08)', textDecoration: 'none', fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>
                    🌐 Website
                  </a>
                )}
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPin.name} ${selectedPin.address}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, padding: '9px 0', background: 'var(--tomato)', textDecoration: 'none', fontSize: 12, fontWeight: 600, color: 'white' }}>
                  🗺 Directions
                </a>
              </div>
            )}

            <div style={{ paddingLeft: 16, paddingRight: 16 }}>

              {/* ── Summary ── */}
              {details?.summary && (
                <div style={{ background: '#F7F6F3', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                    &ldquo;{details.summary}&rdquo;
                  </p>
                </div>
              )}

              {/* ── Info rows ── */}
              {(details?.address ?? selectedPin.address) && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>📍</span>
                  <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0, lineHeight: 1.5 }}>{details?.address ?? selectedPin.address}</p>
                </div>
              )}
              {details?.hoursToday && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🕐</span>
                  <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0 }}>{details.hoursToday}</p>
                </div>
              )}
              {details?.distance && details?.duration && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🚗</span>
                  <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0 }}>{details.distance} away · {details.duration} by car</p>
                </div>
              )}
              {details?.phone && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>📞</span>
                  <a href={`tel:${details.phone}`} style={{ fontSize: 12, color: 'var(--tomato)', margin: 0, textDecoration: 'none', fontWeight: 500 }}>{details.phone}</a>
                </div>
              )}

              {/* ── Reviews ── */}
              {(details?.topReviews ?? []).length > 0 && (
                <div style={{ marginTop: 12, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                      What people say
                    </p>
                    <span style={{ fontSize: 9, color: '#B0AFA9' }}>Google Reviews</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {details!.topReviews.map((review, i) => {
                      const positive = review.rating >= 4;
                      const accent   = positive ? 'var(--tomato)' : review.rating <= 2 ? '#E24B4A' : '#888780';
                      const bg       = positive ? '#F0FAF5' : review.rating <= 2 ? '#FEF2F2' : '#F7F6F3';
                      return (
                        <div key={i} style={{ background: bg, borderRadius: 10, padding: '9px 12px', borderLeft: `3px solid ${accent}` }}>
                          {/* Stars + author row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <div style={{ display: 'flex', gap: 1 }}>
                              {[1,2,3,4,5].map(s => (
                                <span key={s} style={{ fontSize: 10, color: s <= review.rating ? '#F5A623' : '#D3D1C7' }}>★</span>
                              ))}
                            </div>
                            <span style={{ fontSize: 9, color: '#B0AFA9', fontWeight: 500 }}>{review.author}</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#5F5E5A', margin: 0, lineHeight: 1.6,
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            &ldquo;{review.text}&rdquo;
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: '#F0EFEC', margin: '14px 0' }} />

              {/* ── Spotted in video ── */}
              {selectedPin.menuItems && selectedPin.menuItems.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Spotted in video</p>
                    {selectedPin.confidence != null && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'white',
                        background: selectedPin.confidence >= 80 ? 'var(--tomato)' : selectedPin.confidence >= 60 ? '#E8A020' : '#E24B4A',
                        borderRadius: 99, padding: '2px 6px' }}>
                        {selectedPin.confidence}% match
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedPin.menuItems.map((item, i) => (
                      <span key={i} style={{ fontSize: 12, color: '#5F5E5A', background: '#F7F6F3', borderRadius: 99, padding: '4px 10px', border: '1px solid #E8E7E4' }}>
                        {item}
                      </span>
                    ))}
                  </div>
                  <div style={{ height: 1, background: '#F0EFEC', marginTop: 14 }} />
                </div>
              )}

              {/* ── Video Reviews ── */}
              <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 14 }}>
                Video Reviews
              </p>

              {/* Loading skeletons */}
              {detailsLoading && !(details?.tiktoks?.length) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 120, height: 96, borderRadius: 12, background: '#F7F6F3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Video cards */}
              {(details?.tiktoks ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
                  {details!.tiktoks.slice(0, 3).map((vid, i) => {
                    const p = vid.platform ?? 'tiktok';
                    const Icon = p === 'instagram' ? IconBrandInstagram
                               : p === 'facebook'  ? IconBrandFacebook
                               : p === 'youtube'   ? IconBrandYoutube
                               : IconBrandTiktok;
                    return (
                      <a key={i} href={vid.videoUrl} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, width: 120, height: 96, borderRadius: 12, overflow: 'hidden', display: 'block', textDecoration: 'none', background: '#111', position: 'relative' }}>
                        {vid.thumbnail
                          ? <img src={vid.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon size={29} color="rgba(255,255,255,0.25)" />
                            </div>}
                        {/* Gradient overlay */}
                        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%)' }} />
                        {/* Play button */}
                        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconPlayerPlay size={14} color="white" fill="white" />
                          </div>
                        </div>
                        {/* Bottom text */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 7px' }}>
                          {vid.author && <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', margin: '0 0 1px', fontWeight: 600 }}>@{vid.author}</p>}
                          {vid.title && <p style={{ fontSize: 9, color: 'white', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{vid.title}</p>}
                        </div>
                        {/* Platform badge */}
                        <div style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '2px 5px' }}>
                          <Icon size={10} color="white" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Empty state — search buttons */}
              {!detailsLoading && details && !details.tiktoks?.length && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {([
                    { Icon: IconBrandTiktok,    label: 'TikTok',    bg: '#010101', href: `https://www.tiktok.com/search?q=${encodeURIComponent(selectedPin.name)}` },
                    { Icon: IconBrandInstagram, label: 'Instagram', bg: '#E1306C', href: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(selectedPin.name)}` },
                    { Icon: IconBrandFacebook,  label: 'Facebook',  bg: '#1877F2', href: `https://www.facebook.com/search/videos/?q=${encodeURIComponent(selectedPin.name)}` },
                  ] as { Icon: React.ElementType; label: string; bg: string; href: string }[]).map(({ Icon, label, bg, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, padding: '9px 0', background: bg, color: 'white', textDecoration: 'none', fontSize: 10, fontWeight: 600, fontFamily: 'inherit' }}>
                      <Icon size={16} />
                      {label}
                    </a>
                  ))}
                </div>
              )}

              {/* ── Directions (fallback if no phone/website) ── */}
              {details && !details.phone && !details.website && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPin.name} ${selectedPin.address}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, padding: '11px 0', background: 'var(--tomato)', color: 'white', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginTop: 4 }}>
                  <IconMapPin size={17} />
                  Get Directions
                </a>
              )}
            </div>
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
      `}</style>
    </div>
  );
}
