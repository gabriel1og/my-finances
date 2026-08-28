import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  return (
    <>
      <PageHeader title="Configurações" subtitle="Metas e preferências" />

      <div className="card max-w-lg">
        <div className="flex items-center justify-between border-b border-border py-3">
          <span className="text-sm text-textSecondary">E-mail</span>
          <span className="num text-sm">{user?.email}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border py-3">
          <span className="text-sm text-textSecondary">Moeda</span>
          <span className="num text-sm">{profile?.currency ?? 'BRL'}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-textSecondary">Meta mensal de economia</span>
          <span className="num text-sm">{profile?.monthly_goal ?? '—'}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-textMuted">
        Edição das metas e preferências: próxima iteração.
      </p>
    </>
  );
}
