'use client';

import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cuisineType: string;
  address: string;
  videoUrl?: string | null;
  rating?: number | null;
}

interface Props {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const DEFAULT_CENTER = { lat: 38, lng: -97 };

export default function HomeMap({ pins, selectedId, onSelect }: Props) {
  const defaultCenter = pins.length > 0 ? { lat: pins[0].lat, lng: pins[0].lng } : DEFAULT_CENTER;
  const defaultZoom = pins.length > 0 ? 12 : 4;

  return (
    <Map
      mapId="DEMO_MAP_ID"
      defaultCenter={defaultCenter}
      defaultZoom={defaultZoom}
      style={{ width: '100%', height: '100%' }}
      disableDefaultUI
      gestureHandling="greedy"
      onClick={() => onSelect(null)}
    >
      {pins.map(pin => (
        <AdvancedMarker
          key={pin.id}
          position={{ lat: pin.lat, lng: pin.lng }}
          onClick={() => onSelect(pin.id)}
        >
          <div style={{
            width: 22,
            height: 22,
            background: selectedId === pin.id ? '#085041' : '#0F6E56',
            borderRadius: '50% 50% 50% 0',
            transform: 'rotate(-45deg)',
            border: '2.5px solid white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }} />
        </AdvancedMarker>
      ))}
    </Map>
  );
}
