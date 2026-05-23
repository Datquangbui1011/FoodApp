import {
  IconHistory,
  IconFolders,
  IconUserEdit,
  IconBell,
  IconLogout,
  IconChevronRight,
} from '@tabler/icons-react';
import TabBar from '../components/TabBar';

const stats = [
  { num: 47, label: 'Searches' },
  { num: 23, label: 'Saved' },
  { num: 4, label: 'Collections' },
];

const menuItems = [
  { icon: IconHistory, label: 'Search history', danger: false },
  { icon: IconFolders, label: 'Collections', danger: false },
  { icon: IconUserEdit, label: 'Edit profile', danger: false },
  { icon: IconBell, label: 'Notifications', danger: false },
  { icon: IconLogout, label: 'Sign out', danger: true },
];

export default function Profile() {
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
          DB
        </div>
        <p style={{ color: 'white', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Dat Bui</p>
        <p style={{ color: '#9FE1CB', fontSize: 9 }}>@datbui · Member since 2026</p>
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
        {menuItems.map(({ icon: Icon, label, danger }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-3.5 py-2.5 border-b"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <Icon size={15} color={danger ? '#A32D2D' : '#888780'} />
            <span style={{ fontSize: 10, flex: 1, color: danger ? '#A32D2D' : '#2C2C2A' }}>
              {label}
            </span>
            {!danger && <IconChevronRight size={12} color="#D3D1C7" />}
          </div>
        ))}
      </div>

      <TabBar />
    </div>
  );
}
