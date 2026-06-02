'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconSearch,
  IconVideo,
  IconBookmark,
  IconUser,
} from '@tabler/icons-react';

const tabs = [
  { label: 'Search',      href: '/',        icon: IconSearch   },
  { label: 'Video',       href: '/video',   icon: IconVideo    },
  { label: 'Collections', href: '/saved',   icon: IconBookmark },
  { label: 'Me',          href: '/profile', icon: IconUser     },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingTop: 8, paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(0,0,0,0.06)', background: 'white' }}>
      {tabs.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
            <Icon size={29} stroke={1.8} color={active ? '#E24B4A' : '#D3D1C7'} />
            <span style={{ fontSize: 12, fontWeight: 500, color: active ? '#E24B4A' : '#888780' }}>
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
