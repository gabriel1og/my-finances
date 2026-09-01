import { ForecastMonthCard } from '@/components/forecast/ForecastMonthCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildForecast, monthSequence } from '@/lib/forecast';
import { currentMonth } from '@/lib/format';
import { getPostedRecurringIds, getRecurring, getUpcomingStatements } from '@/lib/queries';

const MONTHS_AHEAD = 6;

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [statements, recurring, posted] = await Promise.all([
    getUpcomingStatements(month, MONTHS_AHEAD),
    getRecurring(),
    getPostedRecurringIds(month),
  ]);

  const months = monthSequence(month, MONTHS_AHEAD);
  const forecast = buildForecast({
    months,
    statements,
    recurring,
    // Só o mês corrente tem fixos já lançados; nos futuros o Set não casa com
    // nada e todos os modelos entram como previsão.
    postedRecurringIds: posted,
  });

  const totalCommitted = forecast.reduce((sum, item) => sum + item.committed, 0);
  const totalCards = forecast.reduce((sum, item) => sum + item.cardTotal, 0);
  const totalRecurring = forecast.reduce((sum, item) => sum + item.recurringExpense, 0);
  const maxCommitted = Math.max(...forecast.map((item) => item.committed), 0);

  const hasAnything = totalCommitted > 0;

  return (
    <>
      <PageHeader
        title="Previsão"
        subtitle={`Próximos ${MONTHS_AHEAD} meses — o que já está comprometido`}
      />

      <section className="mb-6 grid grid-cols-3 gap-4">
        <KpiCard
          label="Comprometido"
          value={totalCommitted}
          tone="expense"
          subtitle={`Somando ${MONTHS_AHEAD} meses`}
        />
        <KpiCard
          label="Faturas de cartão"
          value={totalCards}
          subtitle="Compras e parcelas já feitas"
        />
        <KpiCard
          label="Fixos previstos"
          value={totalRecurring}
          subtitle="Modelos ativos ainda não lançados"
        />
      </section>

      {hasAnything ? (
        <div className="grid grid-cols-3 gap-4">
          {forecast.map((item, index) => (
            <ForecastMonthCard
              key={item.month}
              data={item}
              isCurrent={index === 0}
              maxCommitted={maxCommitted}
            />
          ))}
        </div>
      ) : (
        <EmptyState message="Nada comprometido nos próximos meses. Parcelas e lançamentos fixos aparecem aqui." />
      )}

      <p className="mt-4 text-[11px] text-textMuted">
        Faturas vêm de compras já registradas — parcela futura é transação real com data futura, não
        estimativa. Fixos são previsão: o valor pode mudar na hora de lançar.
      </p>
    </>
  );
}
