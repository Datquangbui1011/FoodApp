'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome,
  IconCompass,
  IconHeart,
  IconUser,
} from '@tabler/icons-react';

const tabs = [
  { label: 'Home', href: '/', icon: IconHome },
  { label: 'Explore', href: '/explore', icon: IconCompass },
  { label: 'Saved', href: '/saved', icon: IconHeart },
  { label: 'Profile', href: '/profile', icon: IconUser },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <div className="flex justify-around items-center pt-2 pb-3 border-t border-black/8 bg-white mt-auto">
      {tabs.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5"
          >
            <Icon
              size={22}
              stroke={1.8}
              color={active ? '#0F6E56' : '#D3D1C7'}
            />
            <span
              style={{ fontSize: 9, fontWeight: 500, color: active ? '#0F6E56' : '#888780' }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
