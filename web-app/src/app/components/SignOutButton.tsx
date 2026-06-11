'use client';

import { useRouter } from 'next/navigation';
import { IconLogout } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/landing');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      style={{ width: 'calc(100% - 28px)', margin: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 'var(--radius)', background: 'var(--tomato-soft)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
    >
      <IconLogout size={18} color="var(--tomato-deep)" stroke={1.9} />
      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tomato-deep)' }}>Sign out</span>
    </button>
  );
}
