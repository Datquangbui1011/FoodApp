'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLink, IconBrandTiktok, IconBrandInstagram, IconBrandFacebook } from '@tabler/icons-react';

function detectPlatform(url: string) {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return null;
}

export default function HomeClient() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  const platform = detectPlatform(url);
  const isValid = url.trim().length > 0 && platform !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    router.push(`/processing?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-2">
          {platform === 'tiktok' ? (
            <IconBrandTiktok size={13} color="#E03030" />
          ) : platform === 'instagram' ? (
            <IconBrandInstagram size={13} color="#E03030" />
          ) : platform === 'facebook' ? (
            <IconBrandFacebook size={13} color="#E03030" />
          ) : (
            <IconLink size={13} color="#888780" />
          )}
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste TikTok / Instagram / YouTube link…"
            className="flex-1 outline-none"
            style={{ fontSize: 9, color: '#2C2C2A', background: 'transparent' }}
          />
          <button
            type="submit"
            disabled={!isValid}
            style={{
              fontSize: 8,
              fontWeight: 600,
              color: isValid ? '#E03030' : '#D3D1C7',
              background: 'none',
              border: 'none',
              cursor: isValid ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            Go
          </button>
        </div>
      </form>

      <div className="flex gap-1.5 mt-3">
        {[
          { icon: IconBrandTiktok, label: 'TikTok' },
          { icon: IconBrandInstagram, label: 'Instagram' },
          { icon: IconBrandFacebook, label: 'Facebook' },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex-1 flex flex-col items-center py-1.5 rounded-lg border"
            style={{ borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)' }}
          >
            <Icon size={15} color="white" />
            <span style={{ fontSize: 8, color: 'white', marginTop: 2 }}>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
