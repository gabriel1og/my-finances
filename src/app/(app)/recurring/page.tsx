import { RecurringFormModal } from '@/components/recurring/RecurringFormModal';
import { RecurringRow } from '@/components/recurring/RecurringRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { currentMonth } from '@/lib/format';
import {
  getAccounts,
  getCards,
  getCategories,
  getPostedRecurringIds,
  getRecurring,
  getTags,
} from '@/lib/queries';

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [recurring, posted, categories, accounts, cards, tags] = await Promise.all([
    getRecurring(),
    getPostedRecurringIds(month),
    getCategories(),
    getAccounts(),
    getCards(),
    getTags(),
  ]);

  const monthStart = `${month.slice(0, 7)}-01`;

  // Um modelo só vale para o mês se já começou e ainda não terminou.
  const inRange = recurring.filter(
    (item) => item.start_month <= monthStart && (!item.end_month || item.end_month >= monthStart),
  );

  const pending = inRange.filter((item) => item.is_active && !posted.has(item.id));
  const done = inRange.filter((item) => posted.has(item.id));
  const others = recurring.filter((item) => !pending.includes(item) && !done.includes(item));

  const expected = pending.reduce(
    (sum, item) => sum + (item.type === 'expense' ? Number(item.amount) : 0),
    0,
  );
  const expectedIncome = pending.reduce(
    (sum, item) => sum + (item.type === 'income' ? Number(item.amount) : 0),
    0,
  );
  // Valor previsto dos já lançados — o valor real pode ter sido ajustado na
  // confirmação, então isto é referência, não extrato.
  const postedTotal = done.reduce((sum, item) => sum + Number(item.amount), 0);

  const common = { categories, accounts, cards, tags, month };

  return (
    <>
      <PageHeader
        title="Lançamentos fixos"
        subtitle="Modelos que você confirma a cada mês — nada é lançado sozinho"
        action={
          <RecurringFormModal
            categories={categories}
            accounts={accounts}
            cards={cards}
            tags={tags}
          />
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Pendentes no mês"
          value={expected}
          tone="expense"
          subtitle={`${pending.length} lançamento(s) a confirmar`}
        />
        <KpiCard label="Receitas previstas" value={expectedIncome} tone="income" />
        <KpiCard
          label="Já lançados"
          value={postedTotal}
          subtitle={`${done.length} neste mês · valor previsto`}
        />
      </section>

      <section>
        <span className="label-caps">Pendentes</span>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {pending.length ? (
            pending.map((item) => (
              <RecurringRow key={item.id} recurring={item} posted={false} {...common} />
            ))
          ) : (
            <EmptyState message="Nada pendente neste mês." />
          )}
        </div>
      </section>

      {done.length ? (
        <section className="mt-8">
          <span className="label-caps">Já lançados neste mês</span>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {done.map((item) => (
              <RecurringRow key={item.id} recurring={item} posted {...common} />
            ))}
          </div>
        </section>
      ) : null}

      {others.length ? (
        <section className="mt-8">
          <span className="label-caps">Fora do período ou pausados</span>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {others.map((item) => (
              <RecurringRow
                key={item.id}
                recurring={item}
                posted={posted.has(item.id)}
                {...common}
              />
            ))}
          </div>
        </section>
      ) : null}

      {recurring.length === 0 ? (
        <EmptyState message="Nenhum lançamento fixo ainda. Cadastre aluguel, salário e assinaturas para não digitar tudo de novo todo mês." />
      ) : null}
    </>
  );
}
