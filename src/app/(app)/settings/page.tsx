import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsForm } from '@/components/settings/SettingsForm';
import { TagsManager } from '@/components/settings/TagsManager';
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
      <PageHeader
        title="Configurações"
        subtitle="Metas e preferências"
        action={<SignOutButton />}
      />
      <SettingsForm profile={profile as Profile} email={user?.email ?? ''} />

      <div className="mt-6">
        <TagsManager tags={tags} />
      </div>
    </>
  );
}
