'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  IconMail, IconLock, IconAlertCircle,
  IconUser, IconEye, IconEyeOff, IconCheck, IconX,
} from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import StatusBar from '../components/StatusBar';

type Mode = 'signin' | 'signup';

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a number',      ok: /\d/.test(password) },
    { label: 'Contains a letter',      ok: /[a-zA-Z]/.test(password) },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 4 }}>
      {checks.map(c => (
        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {c.ok
            ? <IconCheck size={13} color="#E03030" />
            : <IconX size={13} color="#D3D1C7" />}
          <span style={{ fontSize: 11, color: c.ok ? '#E03030' : '#B0AFA9' }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function AuthContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('mode') === 'signup' ? 'signup' : 'signin';

  const [mode, setMode]               = useState<Mode>(initial);
  const [fullName, setFullName]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [info, setInfo]               = useState<string | null>(null);

  function switchMode(m: Mode) {
    setMode(m); setError(null); setInfo(null);
    setFullName(''); setPassword(''); setConfirm('');
  }

  const passwordsMatch = confirm === '' || password === confirm;
  const canSubmit = mode === 'signin'
    ? email && password
    : fullName.trim() && email && password.length >= 8 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null); setInfo(null); setLoading(true);

    const supabase = createClient();

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        setError(error.message);
      } else {
        setInfo('Check your email to confirm your account, then sign in.');
        switchMode('signin');
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
    <div className="flex flex-col flex-1" style={{ background: '#F5EDED' }}>
      {/* Header */}
      <div style={{ background: '#E03030' }}>
        <StatusBar dark />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 20px' }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, overflow: 'hidden', marginBottom: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            <img src="/logo.png" alt="Foody" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <p style={{ color: 'white', fontSize: 23, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Foody</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: '3px 0 0' }}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ margin: '16px 16px 0', display: 'flex', background: 'white', borderRadius: 12, padding: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
        {(['signin', 'signup'] as Mode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
              background: mode === m ? '#E03030' : 'transparent',
              color: mode === m ? 'white' : '#888780',
              boxShadow: mode === m ? '0 2px 8px rgba(224,48,48,0.3)' : 'none',
            }}>
            {m === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '16px 16px 24px', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Full Name — signup only */}
          {mode === 'signup' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5F5E5A', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 12, padding: '11px 14px', border: '1.5px solid #F0EFEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <IconUser size={18} color="#D3D1C7" />
                <input
                  type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required={mode === 'signup'}
                  style={{ flex: 1, outline: 'none', background: 'transparent', fontSize: 16, color: '#2C2C2A', border: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#5F5E5A', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email Address</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 12, padding: '11px 14px', border: '1.5px solid #F0EFEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <IconMail size={18} color="#D3D1C7" />
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                style={{ flex: 1, outline: 'none', background: 'transparent', fontSize: 16, color: '#2C2C2A', border: 'none', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#5F5E5A', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 12, padding: '11px 14px', border: '1.5px solid #F0EFEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <IconLock size={18} color="#D3D1C7" />
              <input
                type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                required minLength={mode === 'signup' ? 8 : 1}
                style={{ flex: 1, outline: 'none', background: 'transparent', fontSize: 16, color: '#2C2C2A', border: 'none', fontFamily: 'inherit' }}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                {showPass ? <IconEyeOff size={18} color="#B0AFA9" /> : <IconEye size={18} color="#B0AFA9" />}
              </button>
            </div>
            {mode === 'signup' && <PasswordStrength password={password} />}
          </div>

          {/* Confirm Password — signup only */}
          {mode === 'signup' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5F5E5A', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confirm Password</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 12, padding: '11px 14px', border: `1.5px solid ${!passwordsMatch ? '#E24B4A' : '#F0EFEC'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <IconLock size={18} color={!passwordsMatch ? '#E24B4A' : '#D3D1C7'} />
                <input
                  type={showConfirm ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required={mode === 'signup'}
                  style={{ flex: 1, outline: 'none', background: 'transparent', fontSize: 16, color: '#2C2C2A', border: 'none', fontFamily: 'inherit' }}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showConfirm ? <IconEyeOff size={18} color="#B0AFA9" /> : <IconEye size={18} color="#B0AFA9" />}
                </button>
              </div>
              {!passwordsMatch && confirm && (
                <p style={{ fontSize: 11, color: '#E24B4A', marginTop: 4, marginLeft: 4 }}>Passwords do not match</p>
              )}
            </div>
          )}

          {/* Error / info */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF0F0', border: '1px solid #F5C4C4', borderRadius: 10, padding: '10px 12px' }}>
              <IconAlertCircle size={17} color="#E24B4A" />
              <p style={{ fontSize: 12, color: '#A32D2D', margin: 0 }}>{error}</p>
            </div>
          )}
          {info && (
            <div style={{ background: '#FFF0F0', border: '1px solid #FFB9B8', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 12, color: '#B52020', margin: 0 }}>{info}</p>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading || !canSubmit}
            style={{ padding: '13px 0', borderRadius: 12, border: 'none', cursor: loading || !canSubmit ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, marginTop: 4,
              background: loading || !canSubmit ? '#D3D1C7' : '#E03030',
              color: 'white', boxShadow: loading || !canSubmit ? 'none' : '0 4px 16px rgba(224,48,48,0.35)',
            }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'signin' && (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#888780', margin: 0 }}>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchMode('signup')}
                style={{ background: 'none', border: 'none', color: '#E03030', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Sign up
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  );
}
