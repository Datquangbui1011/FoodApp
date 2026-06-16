'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  IconMapPin,
  IconStar,
  IconStarFilled,
  IconHeart,
  IconHeartFilled,
  IconLoader2,
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
import RestaurantDetailTabs from './RestaurantDetailTabs';

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
// The sheet's expanded height is measured at runtime so its top docks just under
// the category chips and its bottom sits just above the tab bar (see measureSheet).
const SHEET_HEIGHT = 540;   // fallback before first measure
const PEEK_HEIGHT  = 120;   // how much of the sheet shows when collapsed
const GAP_ABOVE_TABBAR = 0; // sheet docks flush against the tab bar (no gap)
const GAP_BELOW_CHIPS  = 12; // breathing room between the chips and the expanded sheet

type SheetSnap = 'hidden' | 'peek' | 'expanded';

// Cache the nearby-restaurants result for the session so navigating away from the
// home tab and back doesn't re-fetch (and re-spend API tokens). Module-scoped so
// it survives the component unmounting/remounting on client navigation.
let discoverCache: { location: { lat: number; lng: number }; list: NearbyRestaurant[] } | null = null;

// Consume a one-shot sessionStorage payload (a search result, a pin to open, …).
// React StrictMode (on in dev) mounts components twice: mount → unmount → mount.
// A naive "read then removeItem" in a mount effect deletes the value on the first
// mount, so the second mount — the one whose render is actually shown — finds
// nothing. We bridge that by briefly caching the raw value at module scope; the
// 3s window covers the StrictMode remount but expires before a later navigation,
// so returning to the tab doesn't resurrect a stale result.
const _consumed: Record<string, { raw: string; at: number }> = {};
function consumeSession(key: string): string | null {
  if (typeof window === 'undefined') return null;
  const fresh = sessionStorage.getItem(key);
  if (fresh) {
    sessionStorage.removeItem(key);
    _consumed[key] = { raw: fresh, at: Date.now() };
    return fresh;
  }
  const cached = _consumed[key];
  if (cached && Date.now() - cached.at < 3000) return cached.raw;
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Numeric TikTok video id (for the embed player), or null if the URL isn't a
// canonical /video/<id> link.
export function tiktokVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

export function StarRating({ rating, count }: { rating: number | null | undefined; count?: number | null }) {
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
  // Seed from the session cache (if we already searched once) so we don't refetch.
  const [userLocation, setUserLocation]   = useState<{ lat: number; lng: number } | null>(() => discoverCache?.location ?? null);
  const [resultPins, setResultPins]       = useState<MapPin[]>([]);
  const [savedNames, setSavedNames]       = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [snap, setSnap]                   = useState<SheetSnap>(discoverCache ? 'peek' : 'hidden');
  const [details, setDetails]             = useState<PlaceDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);
  const [hideHowTo, setHideHowTo]         = useState(false);
  const [suggestions, setSuggestions]     = useState<MapPin[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [discoverList, setDiscoverList]   = useState<NearbyRestaurant[]>(() => discoverCache?.list ?? []);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const discoverAllRef = useRef<NearbyRestaurant[]>([]);

  const sheetRef       = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const chipsRef       = useRef<HTMLDivElement>(null);
  const toastTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragging       = useRef(false);
  const startClientY   = useRef(0);
  const startTranslateY = useRef(0);
  const sheetY         = useSpring(SHEET_HEIGHT, { stiffness: 400, damping: 40, mass: 0.8 });

  // Measured sheet geometry: expanded height + how far above the tab bar it docks.
  const [sheetH, setSheetH]       = useState(SHEET_HEIGHT);
  const [bottomGap, setBottomGap] = useState(72);

  // translateY for each snap, in terms of the measured sheet height.
  // hidden slides past the dock gap too, so no sliver peeks above the tab bar.
  const snapY = useCallback((s: SheetSnap): number => {
    if (s === 'hidden') return sheetH + bottomGap;
    if (s === 'peek')   return Math.max(0, sheetH - PEEK_HEIGHT);
    return 0;
  }, [sheetH, bottomGap]);

  // Size the sheet to the gap between the category chips and the tab bar.
  useEffect(() => {
    function measureSheet() {
      const c = containerRef.current?.getBoundingClientRect();
      const chips = chipsRef.current?.getBoundingClientRect();
      if (!c) return;
      const navH = document.querySelector('nav')?.getBoundingClientRect().height ?? 64;
      const dock = navH + GAP_ABOVE_TABBAR;
      const topGap = chips ? (chips.bottom - c.top + GAP_BELOW_CHIPS) : 150;
      setBottomGap(dock);
      setSheetH(Math.max(240, Math.round(c.height - topGap - dock)));
    }
    measureSheet();
    const ro = new ResizeObserver(measureSheet);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measureSheet);
    return () => { ro.disconnect(); window.removeEventListener('resize', measureSheet); };
  }, []);


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
      const raw = consumeSession('foodmap_result');
      if (!raw) return;
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
              // Prefer the AI's English name over the localized OSM name (e.g. "Baan Tepa" not "บ้านเตปา")
              name: entry.name ?? place.name,
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
              name: inference.topPick?.name ?? place.name ?? 'Unknown',
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

  // Animate sheet with spring — also re-snaps when the measured geometry changes
  useEffect(() => { sheetY.set(snapY(snap)); }, [snap, sheetY, snapY]);

  // Fetch place details when pin selected
  useEffect(() => {
    const pin = selectedPin;
    async function load() {
      if (!pin) { setDetails(null); setSuggestions([]); return; }
      setDetails(null);
      setSuggestions([]);
      setDetailsLoading(true);
      try {
        const qs = new URLSearchParams({
          name: pin.name,
          lat:  String(pin.lat),
          lng:  String(pin.lng),
          ...(pin.address ? { address: pin.address } : {}),
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
    } catch { /* ignore */ }
    finally { setSuggestionsLoading(false); }
  }

  const showToast = useCallback((msg: string, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Navigate to a pin from the Saved page — open its detail sheet expanded.
  useEffect(() => {
    function nav() {
      const raw = consumeSession('foodmap_navigate');
      if (!raw) return;
      try {
        const pin: MapPin = JSON.parse(raw);
        pin.id = `nav-${Date.now()}`;
        setResultPins([pin]);
        setSelectedId(pin.id);
        setSnap('expanded');
      } catch { /* ignore */ }
    }
    nav();
  }, []);

  // Reopen the detail sheet after returning from the /map page.
  useEffect(() => {
    function reopen() {
      const raw = consumeSession('foodmap_reopen');
      if (!raw) return;
      try {
        const pin: MapPin = JSON.parse(raw);
        if (!pin.id) pin.id = `reopen-${Date.now()}`;
        setResultPins([pin]);
        setSelectedId(pin.id);
        setSnap('expanded');
      } catch { /* ignore */ }
    }
    reopen();
  }, []);

  function handlePinSelect(id: string | null) {
    setSelectedId(id);
    // Tapping a pin on the map pulls the sheet up to its detail; tapping the map
    // background (no id) closes it.
    setSnap(id ? 'expanded' : 'hidden');
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
    startTranslateY.current = snapY(snap);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sheetY.jump(snapY(snap));
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
      ? [['expanded', snapY('expanded')], ['peek', snapY('peek')]]
      : [['expanded', snapY('expanded')], ['peek', snapY('peek')], ['hidden', snapY('hidden')]];
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

  // ── Auto-load discover restaurants on mount (once per session) ────────────
  useEffect(() => {
    // Already searched this session? State was seeded from the cache at init
    // (see useState initializers); just restore the "show all" ref and skip the fetch.
    if (discoverCache) {
      discoverAllRef.current = discoverCache.list;
      return;
    }
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
          setUserLocation({ lat, lng });
          discoverCache = { location: { lat, lng }, list: data }; // cache for the session
          // Auto-peek discover sheet if no result is showing yet
          setSnap(prev => prev === 'hidden' ? 'peek' : prev);
        } catch { /* ignore */ }
        finally { setDiscoverLoading(false); }
      },
      () => { /* no location — keep sheet hidden */ },
      { timeout: 8000 },
    );
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
    <div ref={containerRef} className="relative flex-1" style={{ overflow: 'hidden' }}>
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
        <div ref={chipsRef} className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingBottom: 2 }}>
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
          position: 'absolute', bottom: bottomGap + (snap === 'peek' ? PEEK_HEIGHT + 8 : 8), left: 0, right: 0,
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
      <motion.div ref={sheetRef} className="absolute left-0 right-0 z-20"
        style={{ height: sheetH, bottom: bottomGap, y: sheetY, background: 'var(--cream)', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 32px rgba(60,22,14,0.16)', display: 'flex', flexDirection: 'column' }}>

        {/* Drag handle + peek header */}
        <div style={{ touchAction: 'none', cursor: 'grab', flexShrink: 0 }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#D3D1C7' }} />
          </div>
          {selectedPin && (() => {
            const heroPh = details?.photoUrls?.[0];
            const hasHero = !!heroPh;
            const textColor = hasHero ? 'white' : 'var(--ink)';
            const subColor  = hasHero ? 'rgba(255,255,255,0.8)' : '#888780';
            return (
              <>
              {/* Back to list — outside the hero so it's always on plain background */}
              {isDiscover && (
                <div style={{ padding: '0 16px 4px' }}>
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => setSelectedId(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    <IconArrowLeft size={17} color="#E24B4A" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#E24B4A' }}>Back to list</span>
                  </button>
                </div>
              )}
              <div style={{ position: 'relative', overflow: 'hidden', minHeight: hasHero ? 200 : 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                {/* Background photo */}
                {heroPh && (
                  <>
                    <img src={heroPh} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.72) 100%)' }} />
                  </>
                )}
                <div style={{ position: 'relative', padding: '0 16px 18px' }}>
                  {/* Name row + save button */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <p className="font-display" style={{ fontSize: 23, fontWeight: 600, color: textColor, margin: '0 0 2px', lineHeight: 1.15 }}>
                        {selectedPin.name}
                      </p>
                      {(details?.address ?? selectedPin.address) && (
                        <p style={{ fontSize: 11.5, color: subColor, margin: 0, lineHeight: 1.4 }}>
                          {details?.address ?? selectedPin.address}
                        </p>
                      )}
                    </div>
                    <button onClick={handleSave} disabled={saving}
                      onPointerDown={e => e.stopPropagation()}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, marginTop: 1 }}>
                      {isSaved
                        ? <IconHeartFilled size={26} color="#E24B4A" />
                        : <IconHeart size={26} color={hasHero ? 'rgba(255,255,255,0.7)' : '#D3D1C7'} />}
                    </button>
                  </div>
                  {/* Rating + price + open + distance */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                    <StarRating rating={details?.rating ?? selectedPin.rating} count={details?.ratingCount ?? null} />
                    {details?.priceLevel != null && (
                      <span style={{ fontSize: 10, color: subColor }}>
                        {'$'.repeat(details.priceLevel) || 'Free'}
                      </span>
                    )}
                    {details?.openNow != null && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: details.openNow ? (hasHero ? '#86EFAC' : '#16A34A') : (hasHero ? '#FCA5A5' : '#E24B4A') }}>
                        {details.openNow ? '● Open' : '● Closed'}
                      </span>
                    )}
                    {details?.duration && details?.distance && (
                      <span style={{ fontSize: 10, color: subColor }}>
                        {details.distance} · {details.duration}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                    <p style={{ fontSize: 12, color: subColor, margin: 0 }}>{selectedPin.cuisineType}</p>
                    {isResult && (
                      <button onClick={handleWrongPlace}
                        onPointerDown={e => e.stopPropagation()}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: hasHero ? 'rgba(255,255,255,0.55)' : '#B0AFA9', padding: 0, fontFamily: 'inherit' }}>
                        Wrong place?
                      </button>
                    )}
                  </div>
                </div>
              </div>
              </>
            );
          })()}
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
                      onClick={() => setSelectedId(pinId)}
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
                          <div style={{ position: 'absolute', bottom: 6, left: 6, background: r.openNow ? '#16A34A' : '#E24B4A', borderRadius: 99, padding: '2px 5px' }}>
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

        {/* Selected restaurant — tabbed detail */}
        {selectedPin && (
          <RestaurantDetailTabs
            key={selectedPin.id}
            pin={selectedPin}
            details={details}
            detailsLoading={detailsLoading}
            userLocation={userLocation}
            suggestions={suggestions}
            suggestionsLoading={suggestionsLoading}
            loadSuggestions={loadSuggestions}
            onSelectSuggestion={(sug) => {
              setResultPins(prev => [...prev.filter(p => !p.id.startsWith('sug-')), sug]);
              setSelectedId(sug.id);
              setSnap('peek');
            }}
            showToast={showToast}
          />
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
      `}</style>
    </div>
  );
}
