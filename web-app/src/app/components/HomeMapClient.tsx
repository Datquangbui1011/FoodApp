'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  IconLink,
  IconBrandTiktok,
  IconBrandInstagram,
  IconBrandFacebook,
  IconBrandYoutube,
  IconMapPin,
  IconStar,
  IconStarFilled,
  IconExternalLink,
} from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { MapPin } from './HomeMap';

const HomeMap = dynamic(() => import('./HomeMap'), { ssr: false });

// ─── Sheet snap geometry ──────────────────────────────────────────────────────
const SHEET_HEIGHT = 296;
const PEEK_HEIGHT = 104;
const PEEK_TRANSLATE = SHEET_HEIGHT - PEEK_HEIGHT; // 192

type SheetSnap = 'hidden' | 'peek' | 'expanded';

function snapToY(snap: SheetSnap): number {
  if (snap === 'hidden') return SHEET_HEIGHT;
  if (snap === 'peek') return PEEK_TRANSLATE;
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

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.slice(0, 22);
    return u.hostname.replace('www.', '') + path + (u.pathname.length > 22 ? '…' : '');
  } catch {
    return url.slice(0, 32) + '…';
  }
}

function StarRating({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return null;
  const full = Math.round(rating);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i =>
        i <= full
          ? <IconStarFilled key={i} size={11} color="#F5A623" />
          : <IconStar key={i} size={11} color="#D3D1C7" />,
      )}
      <span style={{ fontSize: 8, color: '#888780', marginLeft: 3 }}>{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeMapClient() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>('hidden');

  // Drag via refs — avoids re-renders every pointer-move frame
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startClientY = useRef(0);
  const startTranslateY = useRef(0);

  const platform = detectPlatform(url);
  const isValid = url.trim().length > 0 && platform !== null;
  const PlatformIcon = platform ? PLATFORM_ICONS[platform] : null;
  const selectedPin = pins.find(p => p.id === selectedId) ?? null;

  // Animate sheet to the current snap position
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.32s cubic-bezier(0.32,0.72,0,1)';
    el.style.transform = `translateY(${snapToY(snap)}px)`;
  }, [snap]);

  function handlePinSelect(id: string | null) {
    setSelectedId(id);
    setSnap(id ? 'peek' : 'hidden');
  }

  // ── Drag handlers (pointer events on handle only) ──────────────────────────
  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    startClientY.current = e.clientY;
    startTranslateY.current = snapToY(snap);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const el = sheetRef.current;
    if (el) el.style.transition = 'none';
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const delta = e.clientY - startClientY.current;
    const newY = Math.max(0, startTranslateY.current + delta);
    const el = sheetRef.current;
    if (el) el.style.transform = `translateY(${newY}px)`;
  }

  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;

    const delta = e.clientY - startClientY.current;
    const releasedY = Math.max(0, startTranslateY.current + delta);

    // Snap to nearest of three positions
    const candidates: [SheetSnap, number][] = [
      ['expanded', 0],
      ['peek', PEEK_TRANSLATE],
      ['hidden', SHEET_HEIGHT],
    ];
    const [best] = candidates.reduce((a, b) =>
      Math.abs(b[1] - releasedY) < Math.abs(a[1] - releasedY) ? b : a,
    );

    if (best === 'hidden') setSelectedId(null);
    setSnap(best);
  }

  // ── Load saved pins from Supabase ──────────────────────────────────────────
  useEffect(() => {
    async function loadPins() {
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
        setPins(data.map(row => ({
          id: row.id,
          name: row.restaurant_name,
          lat: row.lat as number,
          lng: row.lng as number,
          cuisineType: row.cuisine_type ?? '',
          address: row.address ?? '',
          videoUrl: (row as Record<string, unknown>).video_url as string | null ?? null,
          rating: (row as Record<string, unknown>).rating as number | null ?? null,
        })));
      }
    }
    loadPins();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    router.push(`/processing?url=${encodeURIComponent(url.trim())}`);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1" style={{ overflow: 'hidden' }}>
      {/* Map fills entire area */}
      <div className="absolute inset-0">
        <HomeMap pins={pins} selectedId={selectedId} onSelect={handlePinSelect} />
      </div>

      {/* Floating search bar */}
      <div className="absolute top-3 left-3 right-3 z-10">
        <form onSubmit={handleSubmit}>
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: 'white',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {PlatformIcon ? (
              <PlatformIcon size={14} color="#0F6E56" />
            ) : (
              <IconLink size={14} color="#888780" />
            )}
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste TikTok / Instagram / YouTube link…"
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 10, color: '#2C2C2A' }}
            />
            {isValid && (
              <button
                type="submit"
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'white',
                  background: '#0F6E56',
                  border: 'none',
                  borderRadius: 8,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                Go
              </button>
            )}
          </div>
        </form>

        {pins.length > 0 && (
          <div className="flex justify-center mt-2">
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
                fontSize: 8,
                color: '#0F6E56',
                fontWeight: 500,
              }}
            >
              <IconMapPin size={10} color="#0F6E56" />
              {pins.length} saved restaurant{pins.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* ── Draggable bottom sheet ─────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 z-20"
        style={{
          height: SHEET_HEIGHT,
          transform: `translateY(${SHEET_HEIGHT}px)`,
          background: 'white',
          borderRadius: '18px 18px 0 0',
          boxShadow: '0 -6px 28px rgba(0,0,0,0.14)',
        }}
      >
        {/* Drag handle — pointer events live here */}
        <div
          style={{ touchAction: 'none', cursor: 'grab', paddingBottom: 8 }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 6 }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: '#D3D1C7' }} />
          </div>

          {/* Peek-visible summary (name + rating) */}
          {selectedPin && (
            <div style={{ paddingLeft: 16, paddingRight: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2A', margin: 0, flex: 1, paddingRight: 8, lineHeight: 1.3 }}>
                  {selectedPin.name}
                </p>
                <StarRating rating={selectedPin.rating} />
              </div>
              <p style={{ fontSize: 9, color: '#888780', margin: '3px 0 0', lineHeight: 1.4 }}>
                {selectedPin.cuisineType && `${selectedPin.cuisineType} · `}
                {selectedPin.address.split(',').slice(0, 2).join(',')}
              </p>
            </div>
          )}
        </div>

        {/* Expanded-only content */}
        {selectedPin && (
          <div style={{ paddingLeft: 16, paddingRight: 16 }}>
            <div style={{ height: 1, background: '#F0EFEC', margin: '8px 0 12px' }} />

            {/* Full address */}
            {selectedPin.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 10 }}>
                <IconMapPin size={11} color="#888780" style={{ marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 9, color: '#5F5E5A', margin: 0, lineHeight: 1.5 }}>
                  {selectedPin.address.split(',').slice(0, 4).join(',')}
                </p>
              </div>
            )}

            {/* Video source link */}
            {selectedPin.videoUrl && (() => {
              const vp = detectPlatform(selectedPin.videoUrl!);
              const VIcon = vp ? PLATFORM_ICONS[vp] : IconLink;
              return (
                <a
                  href={selectedPin.videoUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: '#F7F6F3',
                    border: '1px solid rgba(0,0,0,0.08)',
                    textDecoration: 'none',
                    marginBottom: 10,
                  }}
                >
                  <VIcon size={12} color="#0F6E56" />
                  <span style={{ fontSize: 8, color: '#5F5E5A', flex: 1 }}>
                    {shortUrl(selectedPin.videoUrl!)}
                  </span>
                  <IconExternalLink size={10} color="#B0AEA8" />
                </a>
              );
            })()}

            {/* Directions button */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPin.name} ${selectedPin.address}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderRadius: 12,
                padding: '10px 0',
                background: '#0F6E56',
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <IconMapPin size={13} />
              Get Directions
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
