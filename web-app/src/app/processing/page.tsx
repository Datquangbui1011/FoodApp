'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconBrandTiktok,
  IconBrandInstagram,
  IconBrandFacebook,
  IconBrandYoutube,
  IconLink,
  IconCheck,
  IconEye,
  IconMapPin,
  IconDownload,
  IconAlertCircle,
} from '@tabler/icons-react';
import StatusBar from '../components/StatusBar';

type StepState = 'done' | 'active' | 'pending' | 'error';

interface Step {
  label: string;
  sub: string;
  state: StepState;
}

const INITIAL_STEPS: Step[] = [
  { label: 'Downloading video', sub: 'Fetching from source…', state: 'active' },
  { label: 'Extracting frames', sub: 'Waiting', state: 'pending' },
  { label: 'Transcribing audio', sub: 'Waiting', state: 'pending' },
  { label: 'Analyzing visuals', sub: 'Waiting', state: 'pending' },
  { label: 'Finding location', sub: 'Waiting', state: 'pending' },
];

function platformIcon(url: string) {
  if (url.includes('tiktok')) return <IconBrandTiktok size={17} color="#888780" />;
  if (url.includes('instagram')) return <IconBrandInstagram size={17} color="#888780" />;
  if (url.includes('facebook') || url.includes('fb.watch')) return <IconBrandFacebook size={17} color="#888780" />;
  if (url.includes('youtube') || url.includes('youtu.be')) return <IconBrandYoutube size={17} color="#888780" />;
  return <IconLink size={17} color="#888780" />;
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).slice(0, 36) + '…';
  } catch {
    return url.slice(0, 36) + '…';
  }
}

function errorTitle(error: string, url: string) {
  if (error === 'private_video') return 'This video is private';
  if (error === 'unsupported_url') return 'URL not supported';
  if (error === "Restaurant couldn't be identified") return "Couldn't identify a restaurant";
  if (error === 'download_failed' && url.includes('tiktok')) return 'TikTok download blocked';
  return 'Processing failed';
}

function errorBody(error: string, url: string) {
  if (error === 'private_video') return 'Try a public video instead.';
  if (error === 'unsupported_url') return 'Paste a TikTok, Instagram, Facebook or YouTube link.';
  if (error === 'download_failed' && url.includes('tiktok'))
    return 'TikTok blocks automated downloads. Try the same restaurant on YouTube or Instagram instead.';
  return 'Try a different video with a clearly visible restaurant name or sign.';
}

const STEP_ICONS = [IconDownload, IconEye, IconLink, IconEye, IconMapPin];

function ProcessingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const url = params.get('url') || '';

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => advanceStep(1), 3000));
    timers.push(setTimeout(() => advanceStep(2), 7000));
    timers.push(setTimeout(() => advanceStep(3), 12000));
    timers.push(setTimeout(() => advanceStep(4), 18000));
    return () => timers.forEach(clearTimeout);
  }, []);

  function advanceStep(activeIndex: number) {
    setSteps(prev =>
      prev.map((s, i) => ({
        ...s,
        state: i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending',
      }))
    );
  }

  useEffect(() => {
    if (!url || called.current) return;
    called.current = true;

    fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
        setSteps(prev => prev.map(s => ({ ...s, state: 'done' })));
        sessionStorage.setItem('foodmap_result', JSON.stringify({ ...data, videoUrl: url }));
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          const topPick = data.inference?.topPick;
          const place = data.places?.[0];
          const name: string | undefined = place?.name ?? topPick?.name;
          const confidence: number | null = topPick ? Math.round(topPick.confidence * 100) : null;
          if (name) {
            if (user) {
              await supabase.from('recent_searches').insert({ user_id: user.id, restaurant_name: name, confidence });
            } else {
              const COLORS = ['#C5E8D8', '#F5D9A0', '#D5D2F5', '#F5C4B3'];
              const existing: { id: number; name: string; confidence: number | null; time: string; color: string }[] =
                JSON.parse(localStorage.getItem('foodmap_recents') || '[]');
              const entry = { id: Date.now(), name, confidence, time: new Date().toISOString(), color: COLORS[existing.length % COLORS.length] };
              localStorage.setItem('foodmap_recents', JSON.stringify([entry, ...existing].slice(0, 10)));
            }
          }
        } catch { /* ignore */ }
        setTimeout(() => router.push('/'), 600);
      })
      .catch(() => setError('Processing server unreachable'));
  }, [url, router]);

  return (
    <div className="flex flex-col flex-1">

      {/* Header */}
      <div style={{ background: '#E03030' }}>
        <StatusBar dark />
        <div className="flex items-center gap-2 px-3.5 pb-3">
          <Link href="/"><IconArrowLeft size={21} color="#FFB9B8" /></Link>
          <span style={{ color: 'white', fontSize: 17, fontWeight: 500, flex: 1 }}>Analyzing video</span>
        </div>
      </div>

      <div className="flex-1 px-3.5 py-3.5">
        {/* URL pill */}
        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 mb-4"
          style={{ background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)' }}>
          {platformIcon(url)}
          <span style={{ fontSize: 10, color: '#888780' }}>{shortUrl(url)}</span>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 mt-8">
            <IconAlertCircle size={42} color="#E24B4A" />
            <p style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2A', textAlign: 'center' }}>
              {errorTitle(error, url)}
            </p>
            <p style={{ fontSize: 12, color: '#888780', textAlign: 'center', maxWidth: 220, lineHeight: 1.6 }}>
              {errorBody(error, url)}
            </p>
            {error === 'download_failed' && url.includes('tiktok') && (
              <div className="flex gap-2 mt-1">
                <span style={{ fontSize: 10, color: '#888780', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 99, padding: '4px 10px' }}>
                  YouTube ✓
                </span>
                <span style={{ fontSize: 10, color: '#888780', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 99, padding: '4px 10px' }}>
                  Instagram ✓
                </span>
                <span style={{ fontSize: 10, color: '#888780', background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 99, padding: '4px 10px' }}>
                  Facebook ✓
                </span>
              </div>
            )}
            <Link href="/" className="px-4 py-2 rounded-lg mt-2"
              style={{ background: '#E03030', color: 'white', fontSize: 13, fontWeight: 500 }}>
              Try again
            </Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#2C2C2A', marginBottom: 3 }}>
              Finding your restaurant
            </p>
            <p style={{ fontSize: 12, color: '#888780', marginBottom: 16 }}>
              This usually takes 20–40 seconds
            </p>

            <div className="flex flex-col gap-2.5">
              {steps.map(({ label, sub, state }, i) => {
                const Icon = state === 'done' ? IconCheck : STEP_ICONS[i];
                return (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: state === 'done' ? '#FFF0F0' : state === 'active' ? '#EEEDFE' : '#F7F6F3',
                        border: state === 'active' ? '1.5px solid #7F77DD' : 'none',
                      }}>
                      <Icon
                        size={17}
                        color={state === 'done' ? '#E03030' : state === 'active' ? '#534AB7' : '#D3D1C7'}
                        style={state === 'active' ? { animation: 'spin 1s linear infinite' } : {}}
                      />
                    </div>
                    <div>
                      <p style={{
                        fontSize: 12, fontWeight: 500, marginBottom: 1,
                        color: state === 'done' ? '#E03030' : state === 'active' ? '#534AB7' : '#888780',
                      }}>
                        {label}
                      </p>
                      <span style={{ fontSize: 10, color: '#888780' }}>
                        {state === 'done' ? 'Complete' : sub}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <Link href="/" style={{ fontSize: 12, color: '#888780' }}>Cancel</Link>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function Processing() {
  return (
    <Suspense>
      <ProcessingContent />
    </Suspense>
  );
}
