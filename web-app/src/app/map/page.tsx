'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconArrowLeft, IconMapPin } from '@tabler/icons-react';
import StatusBar from '../components/StatusBar';

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function MapPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const name    = sp.get('name') ?? 'Restaurant';
  const lat     = sp.get('lat')  ?? '';
  const lng     = sp.get('lng')  ?? '';
  const address = sp.get('address') ?? '';
  const userLat = sp.get('userLat') ?? '';
  const userLng = sp.get('userLng') ?? '';

  const dest   = `${lat},${lng}`;
  const origin = userLat && userLng ? `${userLat},${userLng}` : '';
  const query  = encodeURIComponent(`${name} ${address}`.trim());

  const mapSrc = KEY
    ? (origin
        ? `https://www.google.com/maps/embed/v1/directions?key=${KEY}&origin=${origin}&destination=${dest}&mode=driving`
        : `https://www.google.com/maps/embed/v1/place?key=${KEY}&q=${query}`)
    : '';

  // Always a real directions deep link. Destination uses coordinates for
  // precision; origin is included when known, otherwise Google Maps uses the
  // device's current location automatically.
  const dirHref =
    `https://www.google.com/maps/dir/?api=1&destination=${dest}` +
    (origin ? `&origin=${origin}` : '') +
    `&travelmode=driving`;

  return (
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)', minHeight: 0 }}>
      <StatusBar />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexShrink: 0 }}>
        <button onClick={() => router.back()} aria-label="Back"
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'white', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <IconArrowLeft size={19} color="#2C2C2A" />
        </button>
        <div style={{ minWidth: 0 }}>
          <p className="font-display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</p>
          {address && <p style={{ fontSize: 11, color: '#888780', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{address}</p>}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {mapSrc ? (
          <iframe
            title={`Map of ${name}`}
            src={mapSrc}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 12, color: '#B0AFA9' }}>Map unavailable.</p>
          </div>
        )}

        {/* Directions button */}
        <a href={dirHref} target="_blank" rel="noopener noreferrer"
          style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(20px + env(safe-area-inset-bottom))', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, padding: '13px 0', background: 'var(--tomato)', color: 'white', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 6px 20px rgba(226,75,74,0.35)' }}>
          <IconMapPin size={18} /> Get Directions
        </a>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ flex: 1, background: 'var(--cream)' }} />}>
      <MapPageInner />
    </Suspense>
  );
}
