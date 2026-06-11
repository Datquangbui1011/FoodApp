'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBrandTiktok, IconBrandInstagram, IconBrandFacebook,
  IconBrandYoutube, IconLink, IconArrowRight,
} from '@tabler/icons-react';
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
          .maybeSingle();
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
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)' }}>
      <StatusBar />

      {/* Header */}
      <header style={{ padding: '2px 18px 18px' }}>
        <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px', lineHeight: 1.05 }}>Find a restaurant</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>Paste a food video link and we&apos;ll identify the place.</p>
      </header>

      {/* Input — the single focal point */}
      <div style={{ padding: '0 14px 22px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--cream)', borderRadius: 16, padding: '14px 15px', boxShadow: isValid ? 'var(--shadow-tomato)' : 'var(--shadow-warm)', border: isValid ? '1.5px solid var(--tomato)' : '1.5px solid transparent', transition: 'box-shadow 0.2s ease, border-color 0.2s ease' }}>
            {PlatformIcon
              ? <PlatformIcon size={24} color="var(--tomato)" />
              : <IconLink size={24} color="var(--ink-mute)" />}
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
              style={{ flex: 1, outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--ink)', border: 'none', fontFamily: 'inherit' }}
            />
            {isValid && (
              <button type="submit" aria-label="Find restaurant"
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--tomato)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <IconArrowRight size={21} color="#FFF8F4" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Platform icons */}
      <div style={{ padding: '0 14px 26px' }}>
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Supported platforms</p>
        <div style={{ display: 'flex', gap: 10 }}>
          {PLATFORMS.map(({ icon: Icon, label, color, bg }) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, background: bg, borderRadius: 14, padding: '13px 0' }}>
              <Icon size={28} color={color} />
              <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ margin: '0 14px', background: 'var(--cream)', borderRadius: 'var(--radius-lg)', padding: '16px', boxShadow: 'var(--shadow-warm-sm)' }}>
        <p className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 14px' }}>How it works</p>
        {[
          ['📋', 'Copy a food video link', 'From TikTok, Instagram, YouTube, or Facebook'],
          ['🤖', 'AI identifies the restaurant', 'We analyze the video frames and audio'],
          ['📍', 'See it on the map', 'Get directions, reviews, and more'],
        ].map(([emoji, title, sub], i, arr) => (
          <div key={title} style={{ display: 'flex', gap: 12, marginBottom: i < arr.length - 1 ? 14 : 0, alignItems: 'center' }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--tomato-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{emoji}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px' }}>{title}</p>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.4 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />
    </div>
  );
}
