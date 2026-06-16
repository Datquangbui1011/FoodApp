'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OpenNearbyPlace } from '../api/nearby-open/route';
import {
  IconBrandTiktok,
  IconBrandFacebook,
  IconBrandYoutube,
  IconBrandInstagram,
  IconLoader2,
  IconPlayerPlay,
  IconMapPin,
  IconExternalLink,
  IconPencil,
  IconWorld,
  IconPhone,
  IconMap2,
  IconShare,
} from '@tabler/icons-react';
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

interface Props {
  pin: MapPin;
  details: PlaceDetails | null;
  detailsLoading: boolean;
  userLocation: { lat: number; lng: number } | null;
  suggestions: MapPin[];
  suggestionsLoading: boolean;
  loadSuggestions: (pin: MapPin) => void;
  onSelectSuggestion: (sug: MapPin) => void;
  showToast: (msg: string, ok?: boolean) => void; // kept for potential future use
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
      <div style={{ display: 'flex', gap: 4, padding: '14px 12px 12px', flexShrink: 0 }}>
        <ActionButton icon={<IconPencil size={19} />} label="Review" onClick={() => goTo('reviews')} />
        <ActionButton icon={<IconWorld size={19} />} label="Website" disabled={!details?.website}
          onClick={() => details?.website && window.open(details.website, '_blank', 'noopener,noreferrer')} />
        <ActionButton icon={<IconPhone size={19} />} label="Call" disabled={!details?.phone}
          onClick={() => { if (details?.phone) window.location.href = `tel:${details.phone}`; }} />
        <ActionButton icon={<IconMap2 size={19} />} label="Map" onClick={openMapPage} />
        <ActionButton icon={<IconShare size={19} />} label="Share" onClick={handleShare} />
      </div>

      {/* Closed banner */}
      {details?.openNow === false && (
        <div style={{ margin: '0 12px 8px', padding: '10px 14px', borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8, display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
            Closed right now
          </span>
          <button onClick={() => goTo('nearby')}
            style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
            See open nearby →
          </button>
        </div>
      )}

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
          <ReviewsPanel pin={pin} details={details} detailsLoading={detailsLoading} />
        </div>
        <div data-section="nearby" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0EFEC' }}>
          <NearbyPanel
            pin={pin}
            details={details}
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
  const [hoursOpen, setHoursOpen] = useState(false);

  return (
    <div>
      {/* Route map */}
      {mapSrc && <SectionLabel>Map</SectionLabel>}
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

      {/* Hours — collapsed by default, shows today only */}
      <SectionLabel>Hours</SectionLabel>
      {details?.hours && details.hours.length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          {(() => {
            const todayLine = details.hours[todayIdx];
            const [todayDay, ...todayRest] = (todayLine ?? '').split(': ');
            const todayHours = todayRest.join(': ');
            return (
              <>
                <button onClick={() => setHoursOpen(o => !o)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2C2C2A' }}>{todayDay} · {todayHours}</span>
                  <span style={{ fontSize: 11, color: '#888780', marginLeft: 8, flexShrink: 0 }}>{hoursOpen ? '▲ Less' : '▼ All hours'}</span>
                </button>
                {hoursOpen && details.hours!.map((line, i) => {
                  if (i === todayIdx) return null;
                  const [day, ...rest] = line.split(': ');
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#5F5E5A' }}>
                      <span>{day}</span>
                      <span>{rest.join(': ')}</span>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#B0AFA9', margin: '0 0 18px' }}>
          {details?.hoursToday ? `Today: ${details.hoursToday}` : 'Hours not available.'}
        </p>
      )}


    </div>
  );
}

// ─── Reviews tab ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#E53935','#8E24AA','#1E88E5','#00897B','#F4511E','#6D4C41','#546E7A'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

function ReviewsPanel({ pin, details, detailsLoading }: {
  pin: MapPin; details: PlaceDetails | null; detailsLoading: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const overallRating = details?.rating ?? pin.rating;
  const reviews = details?.topReviews ?? [];

  const googleReviewUrl = details?.placeId
    ? `https://search.google.com/local/writereview?placeid=${details.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin.name)}`;
  const moreHref = details?.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${details.placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pin.name} ${pin.address ?? ''}`)}`;

  const counts = [5,4,3,2,1].map(s => reviews.filter(r => r.rating === s).length);
  const maxCount = Math.max(...counts, 1);

  return (
    <div>
      {/* ── Summary above bars ── */}
      {details?.summary && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Summary Review</SectionLabel>
          <p style={{ fontSize: 12, color: '#5F5E5A', lineHeight: 1.6, margin: 0 }}>
            {details.summary}
          </p>
        </div>
      )}

      {/* ── Score + bars ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {/* Left: big score */}
        <div style={{ flexShrink: 0, textAlign: 'center', width: 72 }}>
          <p className="font-display" style={{ fontSize: 48, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>
            {overallRating != null ? overallRating.toFixed(1) : '—'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 1, margin: '4px 0 2px' }}>
            {[1,2,3,4,5].map(s => (
              <span key={s} style={{ fontSize: 11, color: overallRating != null && s <= Math.round(overallRating) ? '#F5A623' : '#D3D1C7' }}>★</span>
            ))}
          </div>
          {details?.ratingCount != null && (
            <p style={{ fontSize: 10, color: '#888780', margin: 0 }}>{details.ratingCount.toLocaleString()}</p>
          )}
        </div>

        {/* Right: star bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
          {[5,4,3,2,1].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#888780', width: 8, flexShrink: 0 }}>{s}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: '#E8E7E4', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: '#F5A623', width: `${(counts[i] / maxCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Write a review button ── */}
      <a href={googleReviewUrl} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 99, padding: '11px 0', border: '1px solid #D3D1C7', background: 'white', color: '#2C2C2A', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
        <IconPencil size={16} color="var(--tomato)" /> Write a review
      </a>

      {/* ── Individual reviews ── */}
      {detailsLoading && reviews.length === 0 ? (
        <p style={{ fontSize: 12, color: '#B0AFA9', margin: 0 }}>Loading reviews…</p>
      ) : reviews.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {reviews.map((review, i) => {
            const isExpanded = expanded[i];
            const longText = review.text.length > 180;
            const placePhoto = details?.photoUrls?.[i % (details.photoUrls.length || 1)];
            return (
              <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid #F0EFEC' }}>
                {/* Avatar row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {review.photoUrl ? (
                    <img src={review.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : placePhoto ? (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                      <img src={placePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{review.author[0]?.toUpperCase()}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarColor(review.author), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{review.author[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A', margin: 0 }}>{review.author}</p>
                    {review.timeAgo && <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>{review.timeAgo}</p>}
                  </div>
                </div>
                {/* Stars */}
                <div style={{ display: 'flex', gap: 1, marginBottom: 6 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize: 13, color: s <= review.rating ? '#F5A623' : '#D3D1C7' }}>★</span>
                  ))}
                </div>
                {/* Text */}
                <p style={{ fontSize: 13, color: '#2C2C2A', margin: 0, lineHeight: 1.55,
                  ...(longText && !isExpanded ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}) }}>
                  {review.text}
                </p>
                {longText && (
                  <button onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
                    style={{ fontSize: 12, fontWeight: 600, color: '#888780', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0', fontFamily: 'inherit' }}>
                    {isExpanded ? 'Show less' : 'More'}
                  </button>
                )}
              </div>
            );
          })}
          <a href={moreHref} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12, borderRadius: 10, padding: '11px 0', background: '#F7F6F3', border: '1px solid #E8E7E4', textDecoration: 'none', fontSize: 13, fontWeight: 600, color: '#2C2C2A' }}>
            See all reviews on Google <IconExternalLink size={14} />
          </a>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#B0AFA9', margin: 0 }}>No reviews yet.</p>
      )}

      {/* Video reviews */}
      <div style={{ marginTop: 20 }}>
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
function NearbyPanel({ pin, details, suggestions, suggestionsLoading, onSelectSuggestion }: {
  pin: MapPin; details: PlaceDetails | null;
  suggestions: MapPin[]; suggestionsLoading: boolean; onSelectSuggestion: (sug: MapPin) => void;
}) {
  const isClosed = details?.openNow === false;
  const [openNearby, setOpenNearby]     = useState<OpenNearbyPlace[]>([]);
  const [openLoading, setOpenLoading]   = useState(false);

  useEffect(() => {
    if (!isClosed) return;
    setOpenLoading(true);
    const qs = new URLSearchParams({ lat: String(pin.lat), lng: String(pin.lng), ...(pin.cuisineType ? { cuisine: pin.cuisineType } : {}) });
    fetch(`/api/nearby-open?${qs}`)
      .then(r => r.json())
      .then((data: OpenNearbyPlace[]) => setOpenNearby(data.filter(p => p.name !== pin.name)))
      .catch(() => {})
      .finally(() => setOpenLoading(false));
  }, [isClosed, pin.lat, pin.lng, pin.name]);

  function NearbyList({ items, loading, emptyMsg }: {
    items: (MapPin | OpenNearbyPlace)[]; loading: boolean; emptyMsg: string;
  }) {
    if (loading) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 64, borderRadius: 12, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconLoader2 size={18} color="#D3D1C7" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ))}
      </div>
    );
    if (items.length === 0) return <p style={{ fontSize: 12, color: '#B0AFA9', textAlign: 'center', padding: '12px 0' }}>{emptyMsg}</p>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(sug => (
          <button key={sug.id} onClick={() => onSelectSuggestion(sug as MapPin)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'white', border: '1px solid #E8E7E4', borderRadius: 12, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F7F6F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🍽️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: '#2C2C2A', margin: '0 0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sug.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>{sug.cuisineType || 'Restaurant'}</p>
                {'openNow' in sug && sug.openNow && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: '#16A34A', borderRadius: 99, padding: '2px 7px' }}>● Open</span>
                )}
                {sug.rating != null && (
                  <span style={{ fontSize: 10, color: '#888780' }}>★ {sug.rating.toFixed(1)}</span>
                )}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tomato)', flexShrink: 0 }}>View →</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>{isClosed ? 'Open right now nearby' : 'Open nearby'}</SectionLabel>
      {isClosed ? (
        <NearbyList
          items={openNearby}
          loading={openLoading}
          emptyMsg="No open places found within 1.5 km."
        />
      ) : (
        <NearbyList
          items={suggestions}
          loading={suggestionsLoading}
          emptyMsg="No similar places found within 1.5 km."
        />
      )}
    </div>
  );
}
