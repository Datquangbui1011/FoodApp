'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  IconArrowLeft, IconMapPin, IconAdjustmentsHorizontal,
  IconChevronDown, IconPhone, IconStar, IconStarFilled,
  IconLoader2, IconChevronUp,
} from '@tabler/icons-react';
import TabBar from '../components/TabBar';
import StatusBar from '../components/StatusBar';
import type { MapPin } from '../components/HomeMap';
import type { NearbyRestaurant } from '../api/nearby-restaurants/route';

const HomeMap = dynamic(() => import('../components/HomeMap'), { ssr: false });

// ── Constants ─────────────────────────────────────────────────────────────────
const SHEET_HEIGHT    = 520;
const PEEK_HEIGHT     = 200;
const PEEK_TRANSLATE  = SHEET_HEIGHT - PEEK_HEIGHT;

const CATEGORIES = [
  { label: 'All',     emoji: '🍽️', keyword: '' },
  { label: 'Pizza',   emoji: '🍕', keyword: 'pizza' },
  { label: 'Mexican', emoji: '🌮', keyword: 'mexican' },
  { label: 'Burgers', emoji: '🍔', keyword: 'burger' },
  { label: 'Chinese', emoji: '🍜', keyword: 'chinese' },
  { label: 'Sushi',   emoji: '🍣', keyword: 'sushi' },
  { label: 'Thai',    emoji: '🍲', keyword: 'thai' },
  { label: 'Coffee',  emoji: '☕', keyword: 'coffee', type: 'cafe' },
  { label: 'Seafood', emoji: '🦐', keyword: 'seafood' },
];

const FILTERS = ['Open Now', 'Price', 'Takeout'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function miles(uLat: number, uLng: number, lat: number, lng: number) {
  const R = 3958.8;
  const dLat = (lat - uLat) * Math.PI / 180;
  const dLng = (lng - uLng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(uLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)**2;
  const d = R * 2 * Math.asin(Math.sqrt(a));
  return d < 0.1 ? 'Here' : d < 10 ? `${d.toFixed(1)} mi` : `${Math.round(d)} mi`;
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const full = Math.round(rating);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {[1,2,3,4,5].map(i =>
        i <= full
          ? <IconStarFilled key={i} size={12} color="#F5A623" />
          : <IconStar       key={i} size={12} color="#E0DFDB" />,
      )}
      <span style={{ fontSize: 10, color: '#888780', marginLeft: 2 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DiscoverPage() {
  const router = useRouter();

  const [location, setLocation]       = useState<{ lat: number; lng: number } | null>(null);
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [loading, setLoading]         = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilters, setActiveFilters]   = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [snap, setSnap]               = useState<'peek' | 'expanded'>('peek');

  const sheetRef      = useRef<HTMLDivElement>(null);
  const dragging      = useRef(false);
  const startY        = useRef(0);
  const startTransY   = useRef(0);
  const fetched       = useRef(false);
  const listRef       = useRef<HTMLDivElement>(null);

  // ── Sheet animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.32s cubic-bezier(0.32,0.72,0,1)';
    el.style.transform  = `translateY(${snap === 'peek' ? PEEK_TRANSLATE : 0}px)`;
  }, [snap]);

  // ── Fetch restaurants ────────────────────────────────────────────────────────
  const fetchRestaurants = useCallback(async (
    lat: number, lng: number,
    keyword = '', type = 'restaurant', openNow = false,
  ) => {
    setLoading(true);
    setRestaurants([]);
    setSelectedId(null);
    try {
      const qs = new URLSearchParams({ lat: String(lat), lng: String(lng), type, keyword });
      if (openNow) qs.set('openNow', 'true');
      const data: NearbyRestaurant[] = await fetch(`/api/nearby-restaurants?${qs}`).then(r => r.json());
      setRestaurants(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        fetchRestaurants(loc.lat, loc.lng);
      },
      () => {
        const loc = { lat: 40.7580, lng: -73.9855 };
        setLocation(loc);
        fetchRestaurants(loc.lat, loc.lng);
      },
      { timeout: 8000 },
    );
  }, [fetchRestaurants]);

  // ── Category / filter handlers ───────────────────────────────────────────────
  function handleCategory(cat: typeof CATEGORIES[number]) {
    setActiveCategory(cat.label);
    if (location) fetchRestaurants(
      location.lat, location.lng,
      cat.keyword, cat.type ?? 'restaurant',
      activeFilters.has('Open Now'),
    );
  }

  function toggleFilter(f: string) {
    const next = new Set(activeFilters);
    next.has(f) ? next.delete(f) : next.add(f);
    setActiveFilters(next);
    const cat = CATEGORIES.find(c => c.label === activeCategory);
    if (location) fetchRestaurants(location.lat, location.lng, cat?.keyword ?? '', cat?.type ?? 'restaurant', next.has('Open Now'));
  }

  // ── Map pins ────────────────────────────────────────────────────────────────
  const pins: MapPin[] = restaurants.map((r, i) => ({
    id:          r.placeId,
    name:        r.name,
    lat:         r.lat,
    lng:         r.lng,
    cuisineType: r.cuisineHint,
    address:     r.address,
    rating:      r.rating,
    videoUrl:    null,
    confidence:  i + 1,   // reuse confidence slot for display number
  }));

  const selectedPin = pins.find(p => p.id === selectedId) ?? null;

  // ── Tap pin → scroll card into view ─────────────────────────────────────────
  function handlePinSelect(id: string | null) {
    setSelectedId(id);
    if (!id) return;
    setSnap('expanded');
    setTimeout(() => {
      const el = document.getElementById(`disc-card-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 350);
  }

  // ── Tap card → navigate to home map ─────────────────────────────────────────
  function handleCardTap(r: NearbyRestaurant) {
    sessionStorage.setItem('foodmap_navigate', JSON.stringify({
      id: r.placeId, name: r.name, lat: r.lat, lng: r.lng,
      cuisineType: r.cuisineHint, address: r.address, rating: r.rating,
    }));
    router.push('/');
  }

  // ── Drag handle ──────────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    dragging.current   = true;
    startY.current     = e.clientY;
    startTransY.current = snap === 'peek' ? PEEK_TRANSLATE : 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const el = sheetRef.current;
    if (el) el.style.transition = 'none';
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const newY = Math.max(0, startTransY.current + (e.clientY - startY.current));
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${newY}px)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    const relY = Math.max(0, startTransY.current + (e.clientY - startY.current));
    setSnap(relY < PEEK_TRANSLATE / 2 ? 'expanded' : 'peek');
  }

  return (
    <div className="relative flex-1" style={{ overflow: 'hidden' }}>

      {/* ── Full-screen map ── */}
      <div className="absolute inset-0">
        <HomeMap
          savedPins={[]}
          nearbyPins={[]}
          resultPins={pins}
          selectedId={selectedId}
          onSelect={handlePinSelect}
          userLocation={location}
        />
      </div>

      {/* ── Floating header ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <StatusBar />
        <div style={{ margin: '0 12px 8px', background: 'white', borderRadius: 16, padding: '10px 14px', boxShadow: '0 2px 16px rgba(0,0,0,0.13)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <IconArrowLeft size={23} color="#2C2C2A" />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#2C2C2A', margin: 0 }}>Restaurants</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <IconMapPin size={12} color="#E24B4A" />
              <span style={{ fontSize: 12, color: '#888780' }}>Current Location</span>
            </div>
          </div>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <IconMapPin size={23} color="#888780" />
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: 12, paddingRight: 12, marginBottom: 8 }}>
          <button style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 99, padding: '5px 10px', background: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <IconAdjustmentsHorizontal size={14} color="#2C2C2A" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>Filter</span>
          </button>
          <button style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 99, padding: '5px 10px', background: 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: 12, color: '#2C2C2A' }}>Sort</span>
            <IconChevronDown size={13} color="#888780" />
          </button>
          {FILTERS.map(f => {
            const on = activeFilters.has(f);
            return (
              <button key={f} onClick={() => toggleFilter(f)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, border: `1.5px solid ${on ? '#E24B4A' : 'rgba(0,0,0,0.12)'}`, borderRadius: 99, padding: '5px 10px', background: on ? '#E24B4A' : 'white', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <span style={{ fontSize: 12, color: on ? 'white' : '#2C2C2A', fontWeight: on ? 600 : 400 }}>{f}</span>
              </button>
            );
          })}
        </div>

        {/* Category circles */}
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: 12, paddingRight: 12 }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.label;
            return (
              <button key={cat.label} onClick={() => handleCategory(cat)}
                style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', border: `2.5px solid ${active ? '#E24B4A' : 'rgba(0,0,0,0.10)'}`, background: active ? '#FFF0F0' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, boxShadow: '0 1px 6px rgba(0,0,0,0.10)' }}>
                  {cat.emoji}
                </div>
                <span style={{ fontSize: 10, color: active ? '#E24B4A' : '#5F5E5A', fontWeight: active ? 700 : 400 }}>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bottom sheet ── */}
      <div ref={sheetRef}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT, transform: `translateY(${PEEK_TRANSLATE}px)`, background: 'white', borderRadius: '20px 20px 0 0', boxShadow: '0 -6px 28px rgba(0,0,0,0.14)', display: 'flex', flexDirection: 'column', zIndex: 20 }}>

        {/* Drag handle */}
        <div style={{ touchAction: 'none', cursor: 'grab', padding: '10px 0 6px', flexShrink: 0 }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: '#D3D1C7', margin: '0 auto' }} />
        </div>

        {/* Sheet header */}
        <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#2C2C2A', margin: 0 }}>
              {loading ? 'Finding restaurants…' : `${restaurants.length} restaurants nearby`}
            </p>
            {selectedPin && (
              <p style={{ fontSize: 12, color: '#E24B4A', margin: '1px 0 0', fontWeight: 600 }}>
                #{restaurants.findIndex(r => r.placeId === selectedId) + 1} selected · {selectedPin.name}
              </p>
            )}
          </div>
          <button onClick={() => setSnap(snap === 'peek' ? 'expanded' : 'peek')}
            style={{ background: '#F7F6F3', border: 'none', borderRadius: 99, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {snap === 'peek'
              ? <IconChevronUp size={18} color="#888780" />
              : <IconChevronDown size={18} color="#888780" />}
          </button>
        </div>

        <div style={{ height: 1, background: '#F0EFEC', flexShrink: 0 }} />

        {/* Scrollable restaurant list */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px', background: '#F7F6F3', borderRadius: 12 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 10, background: '#EEEDEA', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 9, background: '#EEEDEA', borderRadius: 5, width: '60%', marginBottom: 7 }} />
                    <div style={{ height: 7, background: '#EEEDEA', borderRadius: 5, width: '40%', marginBottom: 7 }} />
                    <div style={{ height: 7, background: '#EEEDEA', borderRadius: 5, width: '50%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Restaurant rows */}
          {!loading && restaurants.map((r, i) => {
            const active = selectedId === r.placeId;
            return (
              <div id={`disc-card-${r.placeId}`} key={r.placeId}
                onClick={() => { setSelectedId(active ? null : r.placeId); }}
                style={{ display: 'flex', gap: 10, padding: '10px', borderRadius: 14, marginBottom: 8, cursor: 'pointer', background: active ? '#FFF5F5' : 'white', border: `1.5px solid ${active ? '#E24B4A' : '#F0EFEC'}`, transition: 'all 0.15s' }}>

                {/* Number badge */}
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: active ? '#E24B4A' : '#F0EFEC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? 'white' : '#5F5E5A' }}>{i + 1}</span>
                </div>

                {/* Thumbnail */}
                <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#F0EFEC' }}>
                  {r.photoUrl
                    ? <img src={r.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 29 }}>🍽️</div>}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2A', margin: '0 0 3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.name}</p>
                  <Stars rating={r.rating} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: '#888780' }}>{r.cuisineHint}</span>
                    {r.openNow != null && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: r.openNow ? '#E03030' : '#E24B4A' }}>
                        · {r.openNow ? 'Open' : 'Closed'}
                      </span>
                    )}
                    {location && (
                      <span style={{ fontSize: 10, color: '#B0AFA9', marginLeft: 'auto', flexShrink: 0 }}>
                        {miles(location.lat, location.lng, r.lat, r.lng)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0, justifyContent: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); handleCardTap(r); }}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: '#E03030', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <IconMapPin size={18} color="white" />
                  </button>
                  <a href={`tel:`} onClick={e => e.stopPropagation()}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: '#E24B4A', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                    <IconPhone size={18} color="white" />
                  </a>
                </div>
              </div>
            );
          })}

          {!loading && restaurants.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🍽️</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#5F5E5A', margin: '0 0 4px' }}>No restaurants found</p>
              <p style={{ fontSize: 12, color: '#B0AFA9' }}>Try a different category</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30 }}>
        <TabBar />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
