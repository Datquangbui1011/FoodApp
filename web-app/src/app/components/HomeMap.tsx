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
  // When multiple results, center on their midpoint and zoom out slightly
  const resultCenter = resultPins.length > 1
    ? { lat: resultPins.reduce((s, p) => s + p.lat, 0) / resultPins.length, lng: resultPins.reduce((s, p) => s + p.lng, 0) / resultPins.length }
    : resultPins.length === 1 ? { lat: resultPins[0].lat, lng: resultPins[0].lng } : null;
  const center = userLocation ?? resultCenter ?? (allPins.length > 0 ? { lat: allPins[0].lat, lng: allPins[0].lng } : DEFAULT_CENTER);
  const zoom = resultPins.length > 1 ? 12 : resultPins.length === 1 ? 15 : userLocation ? 13 : allPins.length > 0 ? 12 : 4;

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
          <PinDot color={selectedId === pin.id ? '#B52020' : '#E03030'} active={selectedId === pin.id} />
        </AdvancedMarker>
      ))}

      {nearbyPins.map(pin => (
        <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} onClick={() => onSelect(pin.id)}>
          <PinDot color={selectedId === pin.id ? '#C44B00' : '#E85D04'} active={selectedId === pin.id} />
        </AdvancedMarker>
      ))}

      {/* Result pins — numbered when multiple, plain dot when single */}
      {resultPins.map((pin, i) => {
        const active = selectedId === pin.id;
        const multi = resultPins.length > 1;
        return (
          <AdvancedMarker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} onClick={() => onSelect(pin.id)}>
            {multi ? (
              <div style={{
                width: active ? 30 : 26, height: active ? 30 : 26,
                background: active ? '#534AB7' : '#7F77DD',
                borderRadius: '50%', border: `${active ? 3 : 2}px solid white`,
                boxShadow: active ? '0 3px 10px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: active ? 12 : 11, fontWeight: 700, color: 'white', lineHeight: 1 }}>{i + 1}</span>
              </div>
            ) : (
              <PinDot color={active ? '#534AB7' : '#7F77DD'} active={active} />
            )}
          </AdvancedMarker>
        );
      })}

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
