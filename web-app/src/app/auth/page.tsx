'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMail, IconLock, IconAlertCircle } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('signin');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/');
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Status bar */}
      <div className="flex justify-between items-center px-4 pt-3 pb-1.5" style={{ background: '#0F6E56' }}>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>

      {/* Header */}
      <div className="px-3.5 pt-4 pb-6 text-center" style={{ background: '#0F6E56' }}>
        <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>FoodMap</h1>
        <p style={{ color: '#9FE1CB', fontSize: 9 }}>Find any restaurant from a video</p>
      </div>

      {/* Card */}
      <div className="flex-1 px-4 pt-5">
        {/* Mode tabs */}
        <div className="flex rounded-lg overflow-hidden mb-5" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              className="flex-1 py-2"
              style={{
                fontSize: 9,
                fontWeight: 600,
                fontFamily: 'inherit',
                border: 'none',
                cursor: 'pointer',
                background: mode === m ? '#0F6E56' : 'white',
                color: mode === m ? 'white' : '#888780',
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          {/* Email */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)' }}>
            <IconMail size={13} color="#888780" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 10, color: '#2C2C2A' }}
            />
          </div>

          {/* Password */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: '#F7F6F3', border: '1px solid rgba(0,0,0,0.1)' }}>
            <IconLock size={13} color="#888780" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 10, color: '#2C2C2A' }}
            />
          </div>

          {/* Error / info */}
          {error && (
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ background: '#FEF0F0', border: '1px solid #F5C4C4' }}>
              <IconAlertCircle size={12} color="#E24B4A" />
              <p style={{ fontSize: 9, color: '#A32D2D' }}>{error}</p>
            </div>
          )}
          {info && (
            <div className="rounded-lg px-3 py-2" style={{ background: '#E1F5EE', border: '1px solid #9FE1CB' }}>
              <p style={{ fontSize: 9, color: '#085041' }}>{info}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg mt-1"
            style={{
              background: loading ? '#D3D1C7' : '#0F6E56',
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
