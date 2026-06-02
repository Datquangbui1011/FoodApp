'use client';

import { Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { useState } from 'react';

interface Props {
  lat: number;
  lng: number;
  name: string;
  address: string;
}

export default function MapView({ lat, lng, name, address }: Props) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Map
      mapId="DEMO_MAP_ID"
      defaultCenter={{ lat, lng }}
      defaultZoom={15}
      style={{ width: '100%', height: '100%' }}
      disableDefaultUI
      gestureHandling="greedy"
    >
      <AdvancedMarker
        position={{ lat, lng }}
        onClick={() => setShowInfo(v => !v)}
      >
        <div style={{
          width: 24,
          height: 24,
          background: '#E03030',
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          border: '2.5px solid white',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          cursor: 'pointer',
        }} />
      </AdvancedMarker>

      {showInfo && (
        <InfoWindow
          position={{ lat, lng }}
          onCloseClick={() => setShowInfo(false)}
        >
          <div style={{ padding: '2px 4px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{name}</p>
            <p style={{ fontSize: 12, color: '#5F5E5A', margin: 0 }}>
              {address.split(',').slice(0, 3).join(',')}
            </p>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
}
