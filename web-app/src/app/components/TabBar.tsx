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

// Routes without a tab bar (auth/onboarding/transient flows + drill-in views).
const HIDDEN_ON = ['/landing', '/auth', '/processing', '/legal', '/map'];

export default function TabBar() {
  const pathname = usePathname();

  // Rendered once at the layout level, outside the page-transition transform, so
  // it stays pinned to the real viewport bottom and its background fills the iOS
  // home-indicator safe area. Hidden on routes that shouldn't show it.
  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null;

  // Edge-to-edge by request: no safe-area reservation — the bar hugs the
  // physical bottom and the iOS home indicator floats over it.
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 9, paddingBottom: 9, borderTop: '1px solid var(--cream-200)', background: 'var(--cream)', boxShadow: '0 -2px 18px rgba(60,22,14,0.06)' }}>
      {tabs.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none', position: 'relative', padding: '2px 14px' }}>
            {/* active indicator dot */}
            <span aria-hidden style={{ position: 'absolute', top: -9, width: 18, height: 3, borderRadius: 9, background: active ? 'var(--tomato)' : 'transparent', transition: 'background 0.2s ease' }} />
            <Icon size={27} stroke={active ? 2 : 1.7} color={active ? 'var(--tomato)' : 'var(--ink-mute)'} />
            <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? 'var(--tomato)' : 'var(--ink-soft)' }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
