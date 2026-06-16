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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.271h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  );
}

function SocialButton({ icon, label, onClick, loading }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #E8E7E3',
        background: 'white', cursor: loading ? 'default' : 'pointer',
        fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#2C2C2A',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#E8E7E3' }} />
      <span style={{ fontSize: 12, color: '#A8A7A1', fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#E8E7E3' }} />
    </div>
  );
}

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
            ? <IconCheck size={13} color="var(--tomato)" />
            : <IconX size={13} color="#D3D1C7" />}
          <span style={{ fontSize: 11, color: c.ok ? 'var(--tomato)' : '#B0AFA9' }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function AuthContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('mode') === 'signup' ? 'signup' : 'signin';
  const oauthError = params.get('error') === 'oauth';

  const [mode, setMode]               = useState<Mode>(initial);
  const [fullName, setFullName]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError]             = useState<string | null>(oauthError ? 'Social login failed. Please try again.' : null);
  const [info, setInfo]               = useState<string | null>(null);

  function switchMode(m: Mode) {
    setMode(m); setError(null); setInfo(null);
    setFullName(''); setPassword(''); setConfirm('');
  }

  const passwordsMatch = confirm === '' || password === confirm;
  const canSubmit = mode === 'signin'
    ? email && password
    : fullName.trim() && email && password.length >= 8 && password === confirm;

  async function handleOAuth(provider: 'google' | 'facebook') {
    setSocialLoading(provider);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setSocialLoading(null);
    }
  }

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
    <div className="flex flex-col flex-1" style={{ background: 'var(--cream)', overflowY: 'auto' }}>
      {/* Header */}
      <header style={{ background: 'radial-gradient(120% 120% at 50% -20%, #F2603F 0%, var(--tomato) 60%)', flexShrink: 0 }}>
        <StatusBar dark />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 22px' }}>
          <div style={{ width: 70, height: 70, borderRadius: 20, overflow: 'hidden', marginBottom: 12, boxShadow: '0 12px 30px rgba(120,30,18,0.35)' }}>
            <img src="/logo.png" alt="Foody app icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <p className="font-display" style={{ color: '#FFF8F4', fontSize: 28, fontWeight: 600, margin: 0, lineHeight: 1 }}>Foody</p>
          <p style={{ color: 'rgba(255,248,244,0.72)', fontSize: 13.5, margin: '6px 0 0' }}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </p>
        </div>
      </header>

      <div style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Social logins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SocialButton
            icon={<GoogleIcon />}
            label="Continue with Google"
            onClick={() => handleOAuth('google')}
            loading={socialLoading === 'google'}
          />
          <SocialButton
            icon={<FacebookIcon />}
            label="Continue with Facebook"
            onClick={() => handleOAuth('facebook')}
            loading={socialLoading === 'facebook'}
          />
        </div>

        <Divider label="or continue with email" />

        {/* Mode tabs */}
        <div style={{ display: 'flex', background: 'white', borderRadius: 12, padding: 3, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                background: mode === m ? 'var(--tomato)' : 'transparent',
                color: mode === m ? 'white' : '#888780',
                boxShadow: mode === m ? '0 2px 8px rgba(194,55,31,0.3)' : 'none',
              }}>
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Form */}
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
                  placeholder="Alex Rivera"
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
                placeholder="alex@example.com"
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
            <div style={{ background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: 12, color: '#166534', margin: 0 }}>{info}</p>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading || !canSubmit}
            style={{ padding: '13px 0', borderRadius: 12, border: 'none', cursor: loading || !canSubmit ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, marginTop: 4,
              background: loading || !canSubmit ? '#D3D1C7' : 'var(--tomato)',
              color: 'white', boxShadow: loading || !canSubmit ? 'none' : '0 4px 16px rgba(194,55,31,0.35)',
            }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'signin' && (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#888780', margin: 0 }}>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchMode('signup')}
                style={{ background: 'none', border: 'none', color: 'var(--tomato)', fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Sign up
              </button>
            </p>
          )}
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#B0AFA9', margin: 0, lineHeight: 1.5 }}>
          By continuing, you agree to Foody&apos;s Terms of Service and Privacy Policy.
        </p>
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
