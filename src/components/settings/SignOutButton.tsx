'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="rounded-md border border-border px-4 py-2 text-sm text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary"
    >
      Sair da conta
    </button>
  );
}
