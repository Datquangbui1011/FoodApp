'use client';

import { useEffect, useState, useRef } from 'react';
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
  if (url.includes('tiktok')) return <IconBrandTiktok size={13} color="#888780" />;
  if (url.includes('instagram')) return <IconBrandInstagram size={13} color="#888780" />;
  if (url.includes('facebook') || url.includes('fb.watch')) return <IconBrandFacebook size={13} color="#888780" />;
  if (url.includes('youtube') || url.includes('youtu.be')) return <IconBrandYoutube size={13} color="#888780" />;
  return <IconLink size={13} color="#888780" />;
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).slice(0, 36) + '…';
  } catch {
    return url.slice(0, 36) + '…';
  }
}

const STEP_ICONS = [IconDownload, IconEye, IconLink, IconEye, IconMapPin];

export default function Processing() {
  const router = useRouter();
  const params = useSearchParams();
  const url = params.get('url') || '';

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  // Simulate step progression while API runs
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
        if (!res.ok) {
          setError(data.error || 'Something went wrong');
          return;
        }
        // Mark all steps done
        setSteps(prev => prev.map(s => ({ ...s, state: 'done' })));
        // Store result and navigate
        sessionStorage.setItem('foodmap_result', JSON.stringify(data));
        setTimeout(() => router.push('/result'), 600);
      })
      .catch(() => setError('Processing server unreachable'));
  }, [url, router]);

  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1.5" style={{ background: '#0F6E56' }}>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>
      <div className="flex items-center gap-2 px-3.5 pb-3 pt-2" style={{ background: '#0F6E56' }}>
        <Link href="/"><IconArrowLeft size={16} color="#9FE1CB" /></Link>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 500, flex: 1 }}>Analyzing video</span>
      </div>

      <div className="flex-1 px-3.5 py-3.5">
        {/* URL pill */}
        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 mb-4"
          style={{ background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)' }}>
          {platformIcon(url)}
          <span style={{ fontSize: 8, color: '#888780' }}>{shortUrl(url)}</span>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 mt-8">
            <IconAlertCircle size={32} color="#E24B4A" />
            <p style={{ fontSize: 12, fontWeight: 600, color: '#2C2C2A', textAlign: 'center' }}>
              {error === 'private_video' ? 'This video is private' :
               error === 'unsupported_url' ? 'URL not supported' :
               error === "Restaurant couldn't be identified" ? "Couldn't identify a restaurant" :
               'Processing failed'}
            </p>
            <p style={{ fontSize: 9, color: '#888780', textAlign: 'center' }}>
              {error === 'private_video' ? 'Try a public video instead.' :
               error === 'unsupported_url' ? 'Paste a TikTok, Instagram, Facebook or YouTube link.' :
               'Try a different video with a clearly visible restaurant.'}
            </p>
            <Link href="/" className="px-4 py-2 rounded-lg mt-2"
              style={{ background: '#0F6E56', color: 'white', fontSize: 10, fontWeight: 500 }}>
              Try again
            </Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2A', marginBottom: 3 }}>
              Finding your restaurant
            </p>
            <p style={{ fontSize: 9, color: '#888780', marginBottom: 16 }}>
              This usually takes 20–40 seconds
            </p>

            <div className="flex flex-col gap-2.5">
              {steps.map(({ label, sub, state }, i) => {
                const Icon = state === 'done' ? IconCheck : STEP_ICONS[i];
                return (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: state === 'done' ? '#E1F5EE' : state === 'active' ? '#EEEDFE' : '#F7F6F3',
                        border: state === 'active' ? '1.5px solid #7F77DD' : 'none',
                      }}>
                      <Icon
                        size={13}
                        color={state === 'done' ? '#0F6E56' : state === 'active' ? '#534AB7' : '#D3D1C7'}
                        style={state === 'active' ? { animation: 'spin 1s linear infinite' } : {}}
                      />
                    </div>
                    <div>
                      <p style={{
                        fontSize: 9, fontWeight: 500, marginBottom: 1,
                        color: state === 'done' ? '#0F6E56' : state === 'active' ? '#534AB7' : '#888780',
                      }}>
                        {label}
                      </p>
                      <span style={{ fontSize: 8, color: '#888780' }}>
                        {state === 'done' ? 'Complete' : sub}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <Link href="/" style={{ fontSize: 9, color: '#888780' }}>Cancel</Link>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
