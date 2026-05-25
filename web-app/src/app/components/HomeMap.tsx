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
  menuItems?: string[];
  confidence?: number | null;
}

interface Props {
  savedPins: MapPin[];
  nearbyPins: MapPin[];
  resultPins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userLocation: { lat: number; lng: number } | null;
}

const DEFAULT_CENTER = { lat: 38, lng: -97 };

function PinDot({ color, active }: { color: string; active: boolean }) {
  return (
    <div style={{
      width: active ? 26 : 22,
      height: active ? 26 : 22,
      background: color,
      borderRadius: '50% 50% 50% 0',
      transform: 'rotate(-45deg)',
      border: `${active ? 3 : 2.5}px solid white`,
      boxShadow: active ? '0 3px 10px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }} />
  );
}

export default function HomeMap({ savedPins, nearbyPins, resultPins, selectedId, onSelect, userLocation }: Props) {
  const allPins = [...savedPins, ...nearbyPins, ...resultPins];
  const center = userLocation
    ?? (resultPins.length > 0 ? { lat: resultPins[0].lat, lng: resultPins[0].lng } : null)
    ?? (allPins.length > 0 ? { lat: allPins[0].lat, lng: allPins[0].lng } : DEFAULT_CENTER);
  const zoom = resultPins.length > 0 ? 15 : userLocation ? 13 : allPins.length > 0 ? 12 : 4;

  return (
    <Map
      mapId="DEMO_MAP_ID"
      defaultCenter={center}
      defaultZoom={zoom}
      key={`${center.lat},${center.lng}`}
      style={{ width: '100%', height: '100%' }}
      disableDefaultUI
      gestureHandling="greedy"
      onClick={() => onSelect(null)}
    >
      {savedPins.map(pin => (
        <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} onClick={() => onSelect(pin.id)}>
          <PinDot color={selectedId === pin.id ? '#085041' : '#0F6E56'} active={selectedId === pin.id} />
        </AdvancedMarker>
      ))}

      {nearbyPins.map(pin => (
        <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} onClick={() => onSelect(pin.id)}>
          <PinDot color={selectedId === pin.id ? '#C44B00' : '#E85D04'} active={selectedId === pin.id} />
        </AdvancedMarker>
      ))}

      {/* Result pins — purple */}
      {resultPins.map(pin => (
        <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} onClick={() => onSelect(pin.id)}>
          <PinDot color={selectedId === pin.id ? '#534AB7' : '#7F77DD'} active={selectedId === pin.id} />
        </AdvancedMarker>
      ))}

      {userLocation && (
        <AdvancedMarker position={userLocation}>
          <div style={{
            width: 14, height: 14, background: '#4285F4', borderRadius: '50%',
            border: '3px solid white', boxShadow: '0 2px 6px rgba(66,133,244,0.5)',
          }} />
        </AdvancedMarker>
      )}
    </Map>
  );
}
