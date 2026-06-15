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

    const serverUrl = process.env.NEXT_PUBLIC_PROCESSING_SERVER_URL || '/api/process';
    const apiKey = process.env.NEXT_PUBLIC_PROCESSING_SERVER_API_KEY || '';
    fetch(`${serverUrl}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
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
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)' }}>

      {/* Header */}
      <header style={{ background: 'radial-gradient(120% 120% at 50% -20%, #F2603F 0%, var(--tomato) 60%)' }}>
        <StatusBar dark />
        <div className="flex items-center gap-3 px-4 pb-3.5">
          <Link href="/" aria-label="Back"><IconArrowLeft size={22} color="#FFF8F4" /></Link>
          <span style={{ color: '#FFF8F4', fontSize: 16, fontWeight: 600, flex: 1 }}>Analyzing video</span>
        </div>
      </header>

      <div className="flex-1" style={{ padding: '16px 16px' }}>
        {/* URL pill */}
        <div className="flex items-center gap-2 mb-5"
          style={{ background: 'var(--cream)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow-warm-sm)', width: 'fit-content', maxWidth: '100%' }}>
          {platformIcon(url)}
          <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{shortUrl(url)}</span>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 mt-8">
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--tomato-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconAlertCircle size={36} color="var(--tomato)" />
            </div>
            <p className="font-display" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', margin: 0 }}>
              {errorTitle(error, url)}
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', maxWidth: 240, lineHeight: 1.6 }}>
              {errorBody(error, url)}
            </p>
            {error === 'download_failed' && url.includes('tiktok') && (
              <div className="flex gap-2 mt-1">
                {['YouTube', 'Instagram', 'Facebook'].map(p => (
                  <span key={p} style={{ fontSize: 11, color: 'var(--ink-soft)', background: 'var(--cream)', boxShadow: 'var(--shadow-warm-sm)', borderRadius: 99, padding: '5px 11px' }}>
                    {p} ✓
                  </span>
                ))}
              </div>
            )}
            <Link href="/" style={{ background: 'var(--tomato)', color: '#FFF8F4', fontSize: 14.5, fontWeight: 700, padding: '12px 22px', borderRadius: 'var(--radius)', marginTop: 6, boxShadow: 'var(--shadow-tomato)' }}>
              Try again
            </Link>
          </div>
        ) : (
          <>
            <p className="font-display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.1 }}>
              Finding your restaurant
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 22 }}>
              This usually takes 20–40 seconds
            </p>

            <div className="flex flex-col" style={{ gap: 4 }}>
              {steps.map(({ label, sub, state }, i) => {
                const Icon = state === 'done' ? IconCheck : STEP_ICONS[i];
                return (
                  <div key={label} className="flex items-center gap-3" style={{ padding: '7px 0' }}>
                    <div className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 34, height: 34,
                        background: state === 'done' ? 'var(--tomato)' : state === 'active' ? 'var(--tomato-soft)' : 'var(--cream-100)',
                        border: state === 'active' ? '1.5px solid var(--tomato)' : 'none',
                      }}>
                      <Icon
                        size={18}
                        color={state === 'done' ? '#FFF8F4' : state === 'active' ? 'var(--tomato)' : 'var(--ink-mute)'}
                        style={state === 'active' ? { animation: 'spin 1s linear infinite' } : {}}
                      />
                    </div>
                    <div>
                      <p style={{
                        fontSize: 14, fontWeight: 600, marginBottom: 1,
                        color: state === 'pending' ? 'var(--ink-mute)' : 'var(--ink)',
                      }}>
                        {label}
                      </p>
                      <span style={{ fontSize: 11.5, color: state === 'done' ? 'var(--tomato-deep)' : 'var(--ink-soft)' }}>
                        {state === 'done' ? 'Complete' : sub}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-7">
              <Link href="/" style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>Cancel</Link>
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
