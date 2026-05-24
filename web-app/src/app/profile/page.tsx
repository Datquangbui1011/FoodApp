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
      {/* Status bar */}
      <div
        className="flex justify-between items-center px-4 pt-3 pb-1.5"
        style={{ background: '#0F6E56' }}
      >
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>9:41</span>
        <span style={{ color: '#9FE1CB', fontSize: 10, fontWeight: 500 }}>▲▲▲ ▲</span>
      </div>

      {/* Profile header */}
      <div className="px-3.5 pt-3.5 pb-6 text-center" style={{ background: '#0F6E56' }}>
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2"
          style={{ background: '#1D9E75', border: '2.5px solid #9FE1CB', fontSize: 16, fontWeight: 600, color: 'white' }}
        >
          {initials}
        </div>
        <p style={{ color: 'white', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{username}</p>
        <p style={{ color: '#9FE1CB', fontSize: 9 }}>@{username} · Member since {memberYear}</p>
      </div>

      {/* Stats card */}
      <div
        className="flex mx-3 -mt-3 rounded-xl overflow-hidden bg-white"
        style={{ border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {stats.map(({ num, label }, i) => (
          <div
            key={label}
            className="flex-1 py-2.5 text-center"
            style={{ borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
          >
            <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#2C2C2A' }}>
              {num}
            </span>
            <span style={{ fontSize: 7, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Menu */}
      <div className="flex-1 mt-3">
        {menuItems.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-3.5 py-2.5 border-b"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <Icon size={15} color="#888780" />
            <span style={{ fontSize: 10, flex: 1, color: '#2C2C2A' }}>{label}</span>
            <IconChevronRight size={12} color="#D3D1C7" />
          </div>
        ))}
        <SignOutButton />
      </div>

      <TabBar />
    </div>
  );
}
