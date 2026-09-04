'use client';

import { useState, useTransition } from 'react';
import { updateProfile } from '@/app/(app)/settings/actions';
import { formatCurrency } from '@/lib/format';
import type { Profile } from '@/types/database.types';

const CURRENCIES = ['BRL', 'USD', 'EUR'] as const;

export function SettingsForm({ profile, email }: { profile: Profile; email: string }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [currency, setCurrency] = useState(profile.currency);
  const [monthlyGoal, setMonthlyGoal] = useState(
    profile.monthly_goal !== null ? String(profile.monthly_goal).replace('.', ',') : '',
  );
  const [spendingCap, setSpendingCap] = useState(
    profile.monthly_spending_cap !== null
      ? String(profile.monthly_spending_cap).replace('.', ',')
      : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const parse = (raw: string) =>
      raw.trim() === '' ? null : Number(raw.trim().replace(',', '.'));

    startTransition(async () => {
      const result = await updateProfile({
        displayName,
        currency,
        monthlyGoal: parse(monthlyGoal),
        monthlySpendingCap: parse(spendingCap),
      });
      if (result.error) return setError(result.error);
      setSaved(true);
    });
  }

  const preview = (raw: string) => {
    const parsed = Number(raw.replace(',', '.'));
    return raw.trim() && Number.isFinite(parsed) && parsed >= 0
      ? formatCurrency(parsed, currency)
      : null;
  };

  return (
    <form onSubmit={submit} className="card flex flex-col">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-sm text-textSecondary">E-mail</span>
        <span className="num text-sm">{email}</span>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="label-caps">Nome de exibição</label>
          <input
            className="input-base mt-1"
            value={displayName}
            maxLength={60}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Como você quer ser chamado"
          />
        </div>

        <div>
          <label className="label-caps">Moeda</label>
          <select
            className="select-base mt-1"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-caps">Meta mensal de economia</label>
          <input
            className="input-base num mt-1"
            inputMode="decimal"
            value={monthlyGoal}
            onChange={(e) => setMonthlyGoal(e.target.value)}
            placeholder="0,00"
          />
          <p className="num mt-1 text-2xs text-textMuted">
            {preview(monthlyGoal) ?? 'Quanto você quer que sobre no fim do mês.'}
          </p>
        </div>

        <div>
          <label className="label-caps">Teto de gastos do mês</label>
          <input
            className="input-base num mt-1"
            inputMode="decimal"
            value={spendingCap}
            onChange={(e) => setSpendingCap(e.target.value)}
            placeholder="0,00"
          />
          <p className="num mt-1 text-2xs text-textMuted">
            {preview(spendingCap) ?? 'Limite total de despesas. Deixe em branco para não usar.'}
          </p>
        </div>
      </div>

      {/* `mt-auto` cola o bloco de ação na base: os cards da mesma linha do
          grid têm a altura do mais alto, e sem isto o botão ficava boiando no
          meio de um vazio. O wrapper existe para o botão não virar item flex
          direto da coluna e esticar de ponta a ponta. */}
      <div className="mt-auto pt-5">
        {error ? <p className="mb-3 text-xs text-expense">{error}</p> : null}
        {saved ? <p className="mb-3 text-xs text-income">Preferências salvas.</p> : null}

        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
