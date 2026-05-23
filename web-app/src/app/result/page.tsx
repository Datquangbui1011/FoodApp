'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconShare,
  IconHeartFilled,
  IconHeart,
  IconPhone,
  IconMapPin,
  IconWorld,
  IconAlertCircle,
} from '@tabler/icons-react';
import TabBar from '../components/TabBar';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

interface Place {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
}

interface Result {
  inference: {
    topPick: { name: string; city: string; confidence: number } | null;
    menuItems: string[];
    cuisineType: string;
  };
  places: Place[];
}

export default function ResultPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('foodmap_result');
    if (raw) setResult(JSON.parse(raw));
  }, []);

  if (!result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3">
        <IconAlertCircle size={32} color="#D3D1C7" />
        <p style={{ fontSize: 11, color: '#888780' }}>No result found.</p>
        <Link href="/" className="px-4 py-2 rounded-lg"
          style={{ background: '#0F6E56', color: 'white', fontSize: 10, fontWeight: 500 }}>
          Search a video
        </Link>
      </div>
    );
  }

  const place = result.places[0];
  const top = result.inference.topPick;
  const confidence = top ? Math.round(top.confidence * 100) : null;
  const menuItems = result.inference.menuItems ?? [];
  const mapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`
    : '#';

  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1.5" style={{ background: '#0F6E56' }}>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>
      <div className="flex items-center gap-2 px-3.5 pb-3 pt-2" style={{ background: '#0F6E56' }}>
        <Link href="/"><IconArrowLeft size={16} color="#9FE1CB" /></Link>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 500, flex: 1 }}>Result</span>
        <IconShare size={16} color="#9FE1CB" />
      </div>

      {/* Live map */}
      <div className="relative" style={{ height: 175 }}>
        {place ? (
          <MapView lat={place.lat} lng={place.lng} name={place.name} address={place.address} />
        ) : (
          <div className="w-full h-full" style={{ background: '#CBE5B8' }} />
        )}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="absolute bottom-2 right-2 bg-white rounded-lg px-2 py-1 z-[1000]"
          style={{ fontSize: 8, fontWeight: 500, color: '#0F6E56', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          Open in Maps →
        </a>
      </div>

      {/* Bottom sheet */}
      <div className="flex-1 px-3.5 pt-2.5 overflow-y-auto">
        <div className="w-7 h-0.5 rounded-full mx-auto mb-2.5" style={{ background: '#D3D1C7' }} />

        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 pr-2">
            <p style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A', marginBottom: 2 }}>
              {place?.name ?? top?.name ?? 'Unknown restaurant'}
            </p>
            <p style={{ fontSize: 9, color: '#888780' }}>
              {result.inference.cuisineType} · {place?.address ?? top?.city ?? ''}
            </p>
          </div>
          <button onClick={() => setSaved(s => !s)}>
            {saved
              ? <IconHeartFilled size={20} color="#E24B4A" />
              : <IconHeart size={20} color="#D3D1C7" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {confidence !== null && (
            <span className="px-1.5 py-0.5 rounded-full"
              style={{ fontSize: 8, fontWeight: 500, background: '#EEEDFE', color: '#3C3489' }}>
              {confidence}% match
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded-full"
            style={{ fontSize: 8, fontWeight: 500, background: '#E1F5EE', color: '#085041' }}>
            {result.inference.cuisineType}
          </span>
        </div>

        {menuItems.length > 0 && (
          <>
            <p style={{ fontSize: 9, fontWeight: 500, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
              Spotted in video
            </p>
            <div className="flex gap-1 flex-wrap mb-3">
              {menuItems.map((dish) => (
                <span key={dish} className="px-2 py-0.5 rounded-full"
                  style={{ fontSize: 8, color: '#5F5E5A', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)' }}>
                  {dish}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-1.5 pb-4">
          {[
            { icon: IconPhone, label: 'Call', primary: false, href: '#' },
            { icon: IconMapPin, label: 'Directions', primary: true, href: mapsUrl },
            { icon: IconWorld, label: 'Website', primary: false, href: '#' },
          ].map(({ icon: Icon, label, primary, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5"
              style={{
                fontSize: 9, border: '1px solid rgba(0,0,0,0.1)',
                background: primary ? '#0F6E56' : 'white',
                color: primary ? 'white' : '#2C2C2A',
                textDecoration: 'none',
              }}>
              <Icon size={11} />
              {label}
            </a>
          ))}
        </div>
      </div>

      <TabBar />
    </div>
  );
}
