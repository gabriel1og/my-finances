import { PageActions } from '@/components/ui/PageActions';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { TagsManager } from '@/components/settings/TagsManager';
import { DataPanel } from '@/components/settings/DataPanel';
import { BiometricPanel } from '@/components/settings/BiometricPanel';
import { SignOutButton } from '@/components/settings/SignOutButton';
import { createClient } from '@/lib/supabase/server';
import { getTags } from '@/lib/queries';
import type { Profile } from '@/types/database.types';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tags = await getTags();

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();

  return (
    <>
      <PageActions>
        <SignOutButton />
      </PageActions>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-1 xl:grid-cols-2">
        <SettingsForm profile={profile as Profile} email={user?.email ?? ''} />

        <DataPanel />
        <TagsManager tags={tags} />

        <BiometricPanel
          userId={user!.id}
          label={(profile as Profile)?.display_name ?? user?.email ?? 'flowly'}
        />
      </div>
    </>
  );
}
