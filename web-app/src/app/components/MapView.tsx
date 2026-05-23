'use client';

import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import { useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  lat: number;
  lng: number;
  name: string;
  address: string;
}

export default function MapView({ lat, lng, name, address }: Props) {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <Map
      initialViewState={{ longitude: lng, latitude: lat, zoom: 15 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      attributionControl={false}
    >
      <Marker longitude={lng} latitude={lat} anchor="bottom" onClick={() => setShowPopup(true)}>
        <div style={{
          width: 24, height: 24,
          background: '#0F6E56',
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          border: '2.5px solid white',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          cursor: 'pointer',
        }} />
      </Marker>

      {showPopup && (
        <Popup
          longitude={lng}
          latitude={lat}
          anchor="bottom"
          offset={28}
          onClose={() => setShowPopup(false)}
          closeButton={true}
          closeOnClick={false}
        >
          <div style={{ padding: '2px 4px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, margin: '0 0 2px' }}>{name}</p>
            <p style={{ fontSize: 9, color: '#5F5E5A', margin: 0 }}>{address.split(',').slice(0, 3).join(',')}</p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
