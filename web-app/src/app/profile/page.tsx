import { redirect } from 'next/navigation';
import {
  IconHistory,
  IconFolders,
  IconUserEdit,
  IconBell,
  IconChevronRight,
} from '@tabler/icons-react';
import TabBar from '../components/TabBar';
import SignOutButton from '../components/SignOutButton';
import StatusBar from '../components/StatusBar';
import { createClient } from '@/lib/supabase/server';

const menuItems = [
  { icon: IconHistory, label: 'Search history' },
  { icon: IconFolders, label: 'Collections' },
  { icon: IconUserEdit, label: 'Edit profile' },
  { icon: IconBell, label: 'Notifications' },
];

export default async function Profile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const [{ count: searchCount }, { count: savedCount }] = await Promise.all([
    supabase.from('recent_searches').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('saved_restaurants').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const username = user.email?.split('@')[0] ?? 'user';
  const initials = username.slice(0, 2).toUpperCase();
  const memberYear = new Date(user.created_at).getFullYear();

  const stats = [
    { num: searchCount ?? 0, label: 'Searches' },
    { num: savedCount ?? 0, label: 'Saved' },
    { num: 0, label: 'Collections' },
  ];

  return (
    <div className="flex flex-col flex-1">

      {/* Header — warm tomato block with soft top glow */}
      <header style={{ background: 'radial-gradient(120% 120% at 50% -20%, #F2603F 0%, var(--tomato) 60%)' }}>
        <StatusBar dark />
        <div style={{ padding: '6px 18px 30px', textAlign: 'center' }}>
          <div
            style={{ width: 78, height: 78, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', background: 'var(--cream)', border: '3px solid rgba(251,247,242,0.4)', fontSize: 28, fontWeight: 600, color: 'var(--tomato)', fontFamily: 'var(--font-fraunces)', boxShadow: '0 10px 26px rgba(120,30,18,0.3)' }}
          >
            {initials}
          </div>
          <p className="font-display" style={{ color: '#FFF8F4', fontSize: 24, fontWeight: 600, margin: 0, lineHeight: 1.1 }}>{username}</p>
          <p style={{ color: 'rgba(255,248,244,0.72)', fontSize: 13, margin: '6px 0 0' }}>Member since {memberYear}</p>
        </div>
      </header>

      {/* Stats card — overlaps the header */}
      <div
        className="flex"
        style={{ margin: '-20px 14px 0', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--cream)', boxShadow: 'var(--shadow-warm)' }}
      >
        {stats.map(({ num, label }, i) => (
          <div
            key={label}
            className="flex-1 text-center"
            style={{ padding: '14px 0', borderLeft: i > 0 ? '1px solid var(--cream-200)' : 'none' }}
          >
            <span className="font-display" style={{ display: 'block', fontSize: 26, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{num}</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 5, display: 'block' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Menu — grouped settings cells */}
      <div className="flex-1" style={{ marginTop: 22 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 18px 8px' }}>Account</p>
        <div style={{ margin: '0 14px', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--cream)', boxShadow: 'var(--shadow-warm-sm)' }}>
          {menuItems.map(({ icon: Icon, label }, i) => (
            <button
              key={label}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 15px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--cream-100)' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--tomato-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color="var(--tomato)" stroke={1.9} />
              </span>
              <span style={{ fontSize: 14.5, flex: 1, color: 'var(--ink)', fontWeight: 500 }}>{label}</span>
              <IconChevronRight size={17} color="var(--ink-mute)" />
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <SignOutButton />
        </div>
      </div>

      <TabBar />
    </div>
  );
}
