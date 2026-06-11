'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBrandTiktok,
  IconBrandFacebook,
  IconBrandYoutube,
  IconBrandInstagram,
  IconLoader2,
  IconPlayerPlay,
  IconMapPin,
  IconStar,
  IconStarFilled,
  IconExternalLink,
  IconPencil,
  IconWorld,
  IconPhone,
  IconMap2,
  IconShare,
} from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { MapPin } from './HomeMap';
import type { PlaceDetails } from '../api/place-details/route';
import { StarRating, tiktokVideoId } from './HomeMapClient';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

type DetailTab = 'menu' | 'info' | 'reviews' | 'nearby';
const TABS: { id: DetailTab; label: string }[] = [
  { id: 'menu',    label: 'Menu' },
  { id: 'info',    label: 'Info' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'nearby',  label: 'Nearby' },
];
const SECTION_IDS = TABS.map(t => t.id);

interface AppReview {
  id: string;
  user_id: string;
  rating: number;
  body: string | null;
  restaurant_name: string;
  created_at: string;
}

interface Props {
  pin: MapPin;
  details: PlaceDetails | null;
  detailsLoading: boolean;
  userLocation: { lat: number; lng: number } | null;
  suggestions: MapPin[];
  suggestionsLoading: boolean;
  loadSuggestions: (pin: MapPin) => void;
  onSelectSuggestion: (sug: MapPin) => void;
  showToast: (msg: string, ok?: boolean) => void;
}

export default function RestaurantDetailTabs({
  pin, details, detailsLoading, userLocation,
  suggestions, suggestionsLoading, loadSuggestions, onSelectSuggestion, showToast,
}: Props) {
  const router = useRouter();
  const [active, setActive] = useState<DetailTab>('menu');
  const scrollRef    = useRef<HTMLDivElement>(null);
  const nearbyLoaded = useRef(false);
  const ticking      = useRef(false);

  const mapsQuery = encodeURIComponent(`${pin.name} ${pin.address ?? ''}`.trim());

  function openMapPage() {
    // Remember this pin so the detail sheet reopens when we navigate back.
    try { sessionStorage.setItem('foodmap_reopen', JSON.stringify(pin)); } catch { /* ignore */ }
    const qs = new URLSearchParams({
      name: pin.name, lat: String(pin.lat), lng: String(pin.lng),
      ...(pin.address ? { address: pin.address } : {}),
      ...(userLocation ? { userLat: String(userLocation.lat), userLng: String(userLocation.lng) } : {}),
    });
    router.push(`/map?${qs}`);
  }

  async function handleShare() {
    const url = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
    const data = { title: pin.name, text: `Check out ${pin.name} on Foody`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url); showToast('Link copied'); }
    } catch { /* user cancelled */ }
  }

  // Lazy-load the Nearby suggestions only once the section is reached.
  const maybeLoadNearby = useCallback(() => {
    if (!nearbyLoaded.current) { nearbyLoaded.current = true; loadSuggestions(pin); }
  }, [loadSuggestions, pin]);

  // Scroll-spy: highlight the pill for whichever section is at the top of the scroll area.
  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const root = scrollRef.current;
      if (!root) return;
      const line = root.getBoundingClientRect().top + 12; // detection line just under the nav
      let current: DetailTab = 'menu';
      for (const id of SECTION_IDS) {
        const el = root.querySelector<HTMLElement>(`[data-section="${id}"]`);
        if (el && el.getBoundingClientRect().top - line <= 1) current = id;
      }
      setActive(current);
      if (current === 'nearby') maybeLoadNearby();
    });
  }, [maybeLoadNearby]);

  function goTo(id: DetailTab) {
    setActive(id);
    if (id === 'nearby') maybeLoadNearby();
    scrollRef.current?.querySelector<HTMLElement>(`[data-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Action row — icon buttons (distinct from the pill nav below) */}
      <div style={{ display: 'flex', gap: 4, padding: '2px 12px 12px', flexShrink: 0 }}>
        <ActionButton icon={<IconPencil size={19} />} label="Review" onClick={() => goTo('reviews')} />
        <ActionButton icon={<IconWorld size={19} />} label="Website" disabled={!details?.website}
          onClick={() => details?.website && window.open(details.website, '_blank', 'noopener,noreferrer')} />
        <ActionButton icon={<IconPhone size={19} />} label="Call" disabled={!details?.phone}
          onClick={() => { if (details?.phone) window.location.href = `tel:${details.phone}`; }} />
        <ActionButton icon={<IconMap2 size={19} />} label="Map" onClick={openMapPage} />
        <ActionButton icon={<IconShare size={19} />} label="Share" onClick={handleShare} />
      </div>

      {/* Section nav — pills act as scroll-spy + jump links */}
      <div style={{ display: 'flex', gap: 6, padding: '4px 16px 12px', flexShrink: 0, borderTop: '1px solid #F0EFEC' }}>
        {TABS.map(t => {
          const isActive = t.id === active;
          return (
            <button key={t.id} onClick={() => goTo(t.id)}
              style={{
                flex: 1, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${isActive ? 'var(--tomato)' : 'rgba(0,0,0,0.10)'}`,
                background: isActive ? 'var(--tomato)' : 'white',
                color: isActive ? 'white' : '#5F5E5A',
                borderRadius: 9999, padding: '7px 0', cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          );
        })}
      </div>
      <div style={{ height: 1, background: '#F0EFEC', flexShrink: 0 }} />

      {/* All sections in one continuous scroll */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 28px' }}>
        <div data-section="menu">
          <MenuPanel pin={pin} details={details} detailsLoading={detailsLoading} />
        </div>
        <div data-section="info" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0EFEC' }}>
          <InfoPanel pin={pin} details={details} userLocation={userLocation} />
        </div>
        <div data-section="reviews" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0EFEC' }}>
          <ReviewsPanel pin={pin} details={details} detailsLoading={detailsLoading} showToast={showToast} />
        </div>
        <div data-section="nearby" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0EFEC' }}>
          <NearbyPanel
            suggestions={suggestions}
            suggestionsLoading={suggestionsLoading}
            onSelectSuggestion={onSelectSuggestion}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────────
function ActionButton({ icon, label, onClick, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.38 : 1,
      }}>
      <span style={{
        width: 42, height: 42, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FFF1EF', color: 'var(--tomato)',
      }}>{icon}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: '#5F5E5A' }}>{label}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
      {children}
    </p>
  );
}

function PhotoSkeletons() {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ width: 110, height: 96, borderRadius: 12, background: '#F7F6F3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      ))}
    </div>
  );
}

// ─── Menu tab ───────────────────────────────────────────────────────────────────
function MenuPanel({ pin, details, detailsLoading }: { pin: MapPin; details: PlaceDetails | null; detailsLoading: boolean }) {
  const photos = details?.photoUrls ?? [];
  return (
    <div>
      <SectionLabel>Photos</SectionLabel>
      {detailsLoading && photos.length === 0 ? (
        <PhotoSkeletons />
      ) : photos.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
          {photos.map((u, i) => (
            <img key={i} src={u} alt="" style={{ width: 180, height: 135, objectFit: 'cover', borderRadius: 12, flexShrink: 0, display: 'block' }} />
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#B0AFA9', margin: '0 0 16px' }}>No photos available.</p>
      )}

      {pin.menuItems && pin.menuItems.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <SectionLabel>Spotted in video</SectionLabel>
            {pin.confidence != null && (
              <span style={{ fontSize: 9, fontWeight: 700, color: 'white', marginBottom: 8,
                background: pin.confidence >= 80 ? 'var(--tomato)' : pin.confidence >= 60 ? '#E8A020' : '#E24B4A',
                borderRadius: 99, padding: '2px 6px' }}>
                {pin.confidence}% match
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {pin.menuItems.map((item, i) => (
              <span key={i} style={{ fontSize: 12, color: '#5F5E5A', background: '#F7F6F3', borderRadius: 99, padding: '5px 11px', border: '1px solid #E8E7E4' }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Info tab ─────────────────────────────────────────────────────────────────
// Real fields render with data; the rest list "Not available yet" until a data
// source exists (Places API v1 amenities/payments/features are a follow-up).
const PLACEHOLDER_SECTIONS: { icon: string; label: string }[] = [
  { icon: '🛎️', label: 'Amenities' },
  { icon: '💳', label: 'Payments' },
  { icon: '✨', label: 'Features' },
  { icon: '🌿', label: 'Eco-friendly' },
  { icon: '🩺', label: 'Health score' },
];

function InfoPanel({ pin, details, userLocation }: { pin: MapPin; details: PlaceDetails | null; userLocation: { lat: number; lng: number } | null }) {
  const dest = `${pin.lat},${pin.lng}`;
  const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
  const mapSrc = MAPS_KEY
    ? (userLocation
        ? `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${origin}&destination=${dest}&mode=driving`
        : `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${encodeURIComponent(`${pin.name} ${pin.address}`)}`)
    : '';
  const dirHref = userLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(`${pin.name} ${pin.address}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pin.name} ${pin.address}`)}`;

  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div>
      {/* Route map */}
      {mapSrc && (
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #E8E7E4', marginBottom: 10 }}>
          <iframe
            title="Route map"
            src={mapSrc}
            style={{ width: '100%', height: 180, border: 'none', display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
      {details?.distance && details?.duration && (
        <p style={{ fontSize: 12, color: '#5F5E5A', margin: '0 0 10px' }}>
          🚗 {details.distance} away · {details.duration} by car
        </p>
      )}
      <a href={dirHref} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, padding: '11px 0', background: 'var(--tomato)', color: 'white', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 18 }}>
        <IconMapPin size={17} /> Get Directions
      </a>

      {/* Hours */}
      <SectionLabel>Hours</SectionLabel>
      {details?.hours && details.hours.length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          {details.hours.map((line, i) => {
            const [day, ...rest] = line.split(': ');
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, fontWeight: i === todayIdx ? 700 : 400, color: i === todayIdx ? '#2C2C2A' : '#5F5E5A' }}>
                <span>{day}</span>
                <span>{rest.join(': ')}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#B0AFA9', margin: '0 0 18px' }}>
          {details?.hoursToday ? `Today: ${details.hoursToday}` : 'Hours not available.'}
        </p>
      )}

      {/* Contact */}
      <SectionLabel>Contact</SectionLabel>
      <div style={{ marginBottom: 18 }}>
        {(details?.address ?? pin.address) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>📍</span>
            <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0, lineHeight: 1.5 }}>{details?.address ?? pin.address}</p>
          </div>
        )}
        {details?.phone && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>📞</span>
            <a href={`tel:${details.phone}`} style={{ fontSize: 12, color: 'var(--tomato)', textDecoration: 'none', fontWeight: 500 }}>{details.phone}</a>
          </div>
        )}
        {details?.website && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            <a href={details.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--tomato)', textDecoration: 'none', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {details.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          </div>
        )}
        {!details?.phone && !details?.website && !details?.address && !pin.address && (
          <p style={{ fontSize: 12, color: '#B0AFA9', margin: 0 }}>No contact details available.</p>
        )}
      </div>

      {/* Placeholder sections — no data source yet */}
      {PLACEHOLDER_SECTIONS.map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderTop: '1px solid #F0EFEC' }}>
          <span style={{ fontSize: 13, color: '#2C2C2A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{s.icon}</span> {s.label}
          </span>
          <span style={{ fontSize: 11, color: '#B0AFA9' }}>Not available yet</span>
        </div>
      ))}
    </div>
  );
}

// ─── Reviews tab ──────────────────────────────────────────────────────────────
function ReviewsPanel({ pin, details, detailsLoading, showToast }: {
  pin: MapPin; details: PlaceDetails | null; detailsLoading: boolean; showToast: (m: string, ok?: boolean) => void;
}) {
  const router = useRouter();
  const placeKey = details?.placeId ?? `${pin.name}@${pin.lat},${pin.lng}`;
  const [appReviews, setAppReviews] = useState<AppReview[]>([]);
  const [myRating, setMyRating]     = useState(0);
  const [myBody, setMyBody]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAppReviews = useCallback(async (): Promise<AppReview[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from('place_reviews')
      .select('id, user_id, rating, body, restaurant_name, created_at')
      .eq('place_key', placeKey)
      .order('created_at', { ascending: false });
    return (data as AppReview[] | null) ?? [];
  }, [placeKey]);

  useEffect(() => {
    let cancelled = false;
    loadAppReviews().then(rows => { if (!cancelled) setAppReviews(rows); });
    return () => { cancelled = true; };
  }, [loadAppReviews]);

  async function submitReview() {
    if (myRating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { error } = await supabase.from('place_reviews').upsert({
        user_id: user.id,
        place_key: placeKey,
        restaurant_name: pin.name,
        rating: myRating,
        body: myBody.trim() || null,
      }, { onConflict: 'user_id,place_key' });
      if (error) throw error;
      setMyBody('');
      setMyRating(0);
      setAppReviews(await loadAppReviews());
      showToast('Review posted ♥');
    } catch (err) {
      console.error('Review failed:', err);
      showToast('Could not post review — are you signed in?', false);
    } finally { setSubmitting(false); }
  }

  const moreHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pin.name} ${pin.address}`)}`;

  return (
    <div>
      {/* Summary dashboard */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#F7F6F3', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <p className="font-display" style={{ fontSize: 34, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>
            {details?.rating != null ? details.rating.toFixed(1) : (pin.rating != null ? pin.rating.toFixed(1) : '—')}
          </p>
          <div style={{ marginTop: 4 }}>
            <StarRating rating={details?.rating ?? pin.rating} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, color: '#5F5E5A', margin: '0 0 2px' }}>
            {details?.ratingCount ? `${details.ratingCount.toLocaleString()} Google ratings` : 'Google rating'}
          </p>
          <p style={{ fontSize: 11, color: '#B0AFA9', margin: 0 }}>
            {appReviews.length > 0 ? `${appReviews.length} review${appReviews.length > 1 ? 's' : ''} on Foody` : 'Be the first to review on Foody'}
          </p>
        </div>
      </div>

      {/* In-app composer */}
      <SectionLabel>Rate this place</SectionLabel>
      <div style={{ background: 'white', border: '1px solid #E8E7E4', borderRadius: 14, padding: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => setMyRating(s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
              {s <= myRating
                ? <IconStarFilled size={26} color="#F5A623" />
                : <IconStar size={26} color="#D3D1C7" />}
            </button>
          ))}
        </div>
        <textarea
          value={myBody}
          onChange={e => setMyBody(e.target.value)}
          placeholder="Share your experience (optional)…"
          rows={3}
          style={{ width: '100%', resize: 'none', border: '1px solid #E8E7E4', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', color: '#2C2C2A', outline: 'none', boxSizing: 'border-box' }}
        />
        <button onClick={submitReview} disabled={myRating === 0 || submitting}
          style={{
            marginTop: 10, width: '100%', borderRadius: 10, padding: '10px 0', border: 'none',
            background: myRating === 0 ? '#E8E7E4' : 'var(--tomato)',
            color: myRating === 0 ? '#B0AFA9' : 'white',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: myRating === 0 || submitting ? 'default' : 'pointer',
          }}>
          {submitting ? 'Posting…' : 'Post review'}
        </button>
      </div>

      {/* In-app reviews */}
      {appReviews.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SectionLabel>Foody reviews</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {appReviews.map(r => (
              <div key={r.id} style={{ background: '#FFF8F2', borderRadius: 10, padding: '9px 12px', borderLeft: '3px solid var(--tomato)' }}>
                <div style={{ display: 'flex', gap: 1, marginBottom: 5 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} style={{ fontSize: 10, color: s <= r.rating ? '#F5A623' : '#D3D1C7' }}>★</span>
                  ))}
                </div>
                {r.body && <p style={{ fontSize: 11.5, color: '#5F5E5A', margin: 0, lineHeight: 1.6 }}>{r.body}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Google reviews */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <SectionLabel>What people say</SectionLabel>
        <span style={{ fontSize: 9, color: '#B0AFA9' }}>Google Reviews</span>
      </div>
      {detailsLoading && !(details?.topReviews?.length) ? (
        <p style={{ fontSize: 12, color: '#B0AFA9', margin: 0 }}>Loading reviews…</p>
      ) : (details?.topReviews ?? []).length > 0 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {details!.topReviews.map((review, i) => {
              const positive = review.rating >= 4;
              const accent = positive ? 'var(--tomato)' : review.rating <= 2 ? '#E24B4A' : '#888780';
              const bg = positive ? '#F0FAF5' : review.rating <= 2 ? '#FEF2F2' : '#F7F6F3';
              return (
                <div key={i} style={{ background: bg, borderRadius: 10, padding: '9px 12px', borderLeft: `3px solid ${accent}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', gap: 1 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <span key={s} style={{ fontSize: 10, color: s <= review.rating ? '#F5A623' : '#D3D1C7' }}>★</span>
                      ))}
                    </div>
                    <span style={{ fontSize: 9, color: '#B0AFA9', fontWeight: 500 }}>{review.author}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#5F5E5A', margin: 0, lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    &ldquo;{review.text}&rdquo;
                  </p>
                </div>
              );
            })}
          </div>
          <a href={moreHref} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, borderRadius: 10, padding: '9px 0', background: '#F7F6F3', border: '1px solid #E8E7E4', textDecoration: 'none', fontSize: 12, fontWeight: 600, color: '#5F5E5A' }}>
            More reviews <IconExternalLink size={14} />
          </a>
        </>
      ) : (
        <p style={{ fontSize: 12, color: '#B0AFA9', margin: 0 }}>No Google reviews found.</p>
      )}

      {/* Video reviews */}
      <div style={{ marginTop: 18 }}>
        <SectionLabel>Video reviews</SectionLabel>
        <VideoReviews pin={pin} details={details} detailsLoading={detailsLoading} />
      </div>
    </div>
  );
}

// ─── Video reviews (TikTok inline player) ────────────────────────────────────
function VideoReviews({ pin, details, detailsLoading }: { pin: MapPin; details: PlaceDetails | null; detailsLoading: boolean }) {
  const [embedId, setEmbedId] = useState<string | null>(null);
  const tiktoks = details?.tiktoks ?? [];

  if (detailsLoading && tiktoks.length === 0) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 120, height: 96, borderRadius: 12, background: '#F7F6F3', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ))}
      </div>
    );
  }

  if (tiktoks.length === 0) {
    return (
      <a
        href={`https://www.tiktok.com/search?q=${encodeURIComponent(`${pin.name} ${pin.address?.split(',')[1]?.trim() ?? ''}`.trim())}`}
        target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: '#010101', textDecoration: 'none' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconBrandTiktok size={26} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'white', margin: 0 }}>Watch on TikTok</p>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            See videos of {pin.name}
          </p>
        </div>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--tomato)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconPlayerPlay size={15} color="white" fill="white" />
        </span>
      </a>
    );
  }

  return (
    <div>
      {embedId && (
        <div style={{ position: 'relative', width: '100%', maxWidth: 300, margin: '0 auto 14px', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '9 / 16' }}>
          <iframe
            key={embedId}
            src={`https://www.tiktok.com/player/v1/${embedId}?autoplay=1&loop=1&controls=1&music_info=0&description=0&rel=0`}
            title="TikTok video"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
          <button onClick={() => setEmbedId(null)} aria-label="Close video"
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', fontSize: 17, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>×</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
        {tiktoks.slice(0, 3).map((vid, i) => {
          const p = vid.platform ?? 'tiktok';
          const Icon = p === 'instagram' ? IconBrandInstagram
                     : p === 'facebook'  ? IconBrandFacebook
                     : p === 'youtube'   ? IconBrandYoutube
                     : IconBrandTiktok;
          const ttId   = p === 'tiktok' ? tiktokVideoId(vid.videoUrl) : null;
          const active = !!ttId && ttId === embedId;
          const cardStyle: React.CSSProperties = {
            flexShrink: 0, width: 120, height: 96, borderRadius: 12, overflow: 'hidden',
            display: 'block', textDecoration: 'none', background: '#111', position: 'relative',
            padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            border: active ? '2px solid var(--tomato)' : 'none',
          };
          const inner = (
            <>
              {vid.thumbnail
                ? <img src={vid.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={29} color="rgba(255,255,255,0.25)" />
                  </div>}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconPlayerPlay size={14} color="white" fill="white" />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 7px' }}>
                {vid.author && <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', margin: '0 0 1px', fontWeight: 600 }}>@{vid.author}</p>}
                {vid.title && <p style={{ fontSize: 9, color: 'white', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{vid.title}</p>}
              </div>
              <div style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 99, padding: '2px 5px' }}>
                <Icon size={10} color="white" />
              </div>
            </>
          );
          return ttId ? (
            <button key={i} onClick={() => setEmbedId(ttId)} style={cardStyle}>{inner}</button>
          ) : (
            <a key={i} href={vid.videoUrl} target="_blank" rel="noopener noreferrer" style={cardStyle}>{inner}</a>
          );
        })}
      </div>
    </div>
  );
}

// ─── Nearby tab ───────────────────────────────────────────────────────────────
function NearbyPanel({ suggestions, suggestionsLoading, onSelectSuggestion }: {
  suggestions: MapPin[]; suggestionsLoading: boolean; onSelectSuggestion: (sug: MapPin) => void;
}) {
  return (
    <div>
      <SectionLabel>Similar spots nearby</SectionLabel>
      {suggestionsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 64, borderRadius: 12, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <p style={{ fontSize: 12, color: '#B0AFA9', textAlign: 'center', padding: '20px 0' }}>No similar places found within 1.5 km.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suggestions.map(sug => (
            <button key={sug.id} onClick={() => onSelectSuggestion(sug)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'white', border: '1px solid #E8E7E4', borderRadius: 12, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🍽️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: '#2C2C2A', margin: '0 0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sug.name}</p>
                <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>{sug.cuisineType || 'Restaurant'}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tomato)', flexShrink: 0 }}>View →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
