'use client';

import { useRouter } from 'next/navigation';
import { IconLogout } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2.5 px-3.5 py-2.5 border-b w-full text-left"
      style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <IconLogout size={15} color="#A32D2D" />
      <span style={{ fontSize: 10, color: '#A32D2D' }}>Sign out</span>
    </button>
  );
}
