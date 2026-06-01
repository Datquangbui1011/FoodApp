'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBrandTiktok, IconBrandInstagram, IconBrandFacebook,
  IconBrandYoutube, IconLink, IconArrowRight,
} from '@tabler/icons-react';
import TabBar from '../components/TabBar';
import StatusBar from '../components/StatusBar';
import { createClient } from '@/lib/supabase/client';

const PLATFORMS = [
  { icon: IconBrandTiktok,    label: 'TikTok',    color: '#010101', bg: '#F7F6F3' },
  { icon: IconBrandInstagram, label: 'Instagram', color: '#E1306C', bg: '#FFF0F5' },
  { icon: IconBrandYoutube,   label: 'YouTube',   color: '#FF0000', bg: '#FFF5F5' },
  { icon: IconBrandFacebook,  label: 'Facebook',  color: '#1877F2', bg: '#F0F5FF' },
];

function detectPlatform(url: string) {
  if (url.includes('tiktok.com'))  return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  return null;
}

const PLATFORM_ICONS = {
  tiktok: IconBrandTiktok,
  instagram: IconBrandInstagram,
  youtube: IconBrandYoutube,
  facebook: IconBrandFacebook,
};

export default function VideoPage() {
  const router  = useRouter();
  const [url, setUrl] = useState('');
  const platform = detectPlatform(url);
  const isValid  = url.trim().length > 0 && platform !== null;
  const PlatformIcon = platform ? PLATFORM_ICONS[platform] : null;

  async function analyzeOrReuse(rawUrl: string) {
    if (!rawUrl.trim() || !detectPlatform(rawUrl)) return;
    const trimmed = rawUrl.trim();
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('saved_restaurants')
          .select('id, restaurant_name, lat, lng, cuisine_type, address, rating')
          .eq('user_id', user.id)
          .eq('video_url', trimmed)
          .limit(1)
          .single();
        if (data?.lat && data?.lng) {
          sessionStorage.setItem('foodmap_navigate', JSON.stringify({
            id: `cached-${data.id}`, name: data.restaurant_name,
            lat: data.lat, lng: data.lng,
            cuisineType: data.cuisine_type ?? '', address: data.address ?? '',
            rating: data.rating ?? null,
          }));
          router.push('/');
          return;
        }
      }
    } catch { /* not cached */ }
    router.push(`/processing?url=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid) analyzeOrReuse(url);
  }

  return (
    <div className="flex flex-col flex-1">
      <StatusBar />

      {/* Header */}
      <div style={{ padding: '4px 16px 16px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2C2C2A', margin: '0 0 4px' }}>Find a Restaurant</h2>
        <p style={{ fontSize: 10, color: '#888780', margin: 0 }}>Paste a food video link and we'll identify the place</p>
      </div>

      {/* Input */}
      <div style={{ padding: '0 12px 20px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 14, padding: '12px 14px', border: '1.5px solid #E8E7E3', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            {PlatformIcon
              ? <PlatformIcon size={18} color="#E03030" />
              : <IconLink size={18} color="#D3D1C7" />}
            <input
              type="url" value={url}
              onChange={e => setUrl(e.target.value)}
              onPaste={e => {
                const text = e.clipboardData.getData('text');
                if (detectPlatform(text)) {
                  e.preventDefault();
                  setUrl(text);
                  setTimeout(() => analyzeOrReuse(text), 80);
                }
              }}
              placeholder="Paste a TikTok, Instagram, or YouTube link…"
              style={{ flex: 1, outline: 'none', background: 'transparent', fontSize: 11, color: '#2C2C2A', border: 'none', fontFamily: 'inherit' }}
            />
            {isValid && (
              <button type="submit"
                style={{ width: 32, height: 32, borderRadius: '50%', background: '#E03030', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <IconArrowRight size={16} color="white" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Platform icons */}
      <div style={{ padding: '0 12px 24px' }}>
        <p style={{ fontSize: 9, color: '#B0AFA9', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supported platforms</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {PLATFORMS.map(({ icon: Icon, label, color, bg }) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: bg, borderRadius: 12, padding: '10px 0' }}>
              <Icon size={22} color={color} />
              <span style={{ fontSize: 8, color: '#888780', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ margin: '0 12px', background: 'white', borderRadius: 16, padding: '14px', border: '1px solid #F0EFEC' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#2C2C2A', margin: '0 0 12px' }}>How it works</p>
        {[
          ['📋', 'Copy a food video link', 'From TikTok, Instagram, YouTube, or Facebook'],
          ['🤖', 'AI identifies the restaurant', 'We analyze the video frames and audio'],
          ['📍', 'See it on the map', 'Get directions, reviews, and more'],
        ].map(([emoji, title, sub]) => (
          <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#2C2C2A', margin: '0 0 1px' }}>{title}</p>
              <p style={{ fontSize: 8.5, color: '#888780', margin: 0 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <TabBar />
    </div>
  );
}
