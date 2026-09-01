'use client';

import { useState, useTransition } from 'react';
import { Modal, ModalTrigger } from '@/components/ui/Modal';
import { TagPicker } from '@/components/ui/TagPicker';
import { createRecurring, updateRecurring } from '@/app/(app)/recurring/actions';
import { ACCOUNT_METHODS, PAYMENT_METHOD_LABEL } from '@/lib/constants';
import type {
  Account,
  Category,
  CreditCard,
  PaymentMethod,
  RecurringWithRelations,
  SettlementKind,
  Tag,
  TransactionType,
} from '@/types/database.types';

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

export function RecurringFormModal({
  categories,
  accounts,
  cards,
  tags,
  recurring,
  trigger,
}: {
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  tags: Tag[];
  recurring?: RecurringWithRelations;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(recurring);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>(recurring?.type ?? 'expense');
  const [description, setDescription] = useState(recurring?.description ?? '');
  const [amount, setAmount] = useState(recurring ? String(recurring.amount).replace('.', ',') : '');
  const [dayOfMonth, setDayOfMonth] = useState(recurring?.day_of_month ?? 5);
  const [categoryId, setCategoryId] = useState(recurring?.category_id ?? '');
  const [settlement, setSettlement] = useState<SettlementKind>(recurring?.settlement ?? 'account');
  const [accountId, setAccountId] = useState(recurring?.account_id ?? accounts[0]?.id ?? '');
  const [cardId, setCardId] = useState(recurring?.card_id ?? cards[0]?.id ?? '');
  const [method, setMethod] = useState<PaymentMethod>(recurring?.payment_method ?? 'debit');
  const [startMonth, setStartMonth] = useState(
    (recurring?.start_month ?? new Date().toISOString()).slice(0, 7),
  );
  const [endMonth, setEndMonth] = useState(recurring?.end_month?.slice(0, 7) ?? '');
  const [tagIds, setTagIds] = useState<string[]>(recurring?.tags?.map((tag) => tag.id) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = categories.filter((category) => category.kind === type);

  function changeType(next: TransactionType) {
    setType(next);
    if (next === 'income') setSettlement('account');
    if (!categories.some((category) => category.id === categoryId && category.kind === next)) {
      setCategoryId('');
    }
  }

  function submit() {
    setError(null);
    const onCard = type === 'expense' && settlement === 'card';

    startTransition(async () => {
      const input = {
        description,
        amount: Number(amount.replace(',', '.')),
        type,
        dayOfMonth,
        categoryId: categoryId || null,
        settlement: onCard ? ('card' as const) : ('account' as const),
        accountId: onCard ? null : accountId || null,
        cardId: onCard ? cardId || null : null,
        paymentMethod: onCard ? ('credit' as const) : method,
        startMonth: `${startMonth}-01`,
        endMonth: endMonth ? `${endMonth}-01` : null,
        tagIds,
      };

      const result = editing
        ? await updateRecurring(recurring!.id, input)
        : await createRecurring(input);

      if (result.error) return setError(result.error);
      setOpen(false);
      if (!editing) {
        setDescription('');
        setAmount('');
        setTagIds([]);
      }
    });
  }

  return (
    <>
      <ModalTrigger
        trigger={trigger}
        onOpen={() => setOpen(true)}
        fallback={
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
            Novo fixo
          </button>
        }
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar lançamento fixo' : 'Novo lançamento fixo'}
      >
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-md border border-border p-1">
          {(['income', 'expense'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeType(option)}
              className={[
                'rounded-sm py-1.5 text-sm transition-colors',
                type === option
                  ? option === 'income'
                    ? 'bg-incomeDim text-income'
                    : 'bg-expenseDim text-expense'
                  : 'text-textSecondary hover:text-textPrimary',
              ].join(' ')}
            >
              {option === 'income' ? 'Receita' : 'Despesa'}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label-caps">Descrição</label>
            <input
              className="input-base mt-1"
              value={description}
              maxLength={120}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aluguel, salário, Netflix..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps">Valor previsto</label>
              <input
                className="input-base num mt-1"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="label-caps">Dia do mês</label>
              <select
                className="input-base num mt-1"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-textMuted">
            O valor é uma previsão — dá para ajustar na hora de lançar. Dia 29, 30 ou 31 vira o
            último dia do mês quando ele não existe.
          </p>

          {type === 'expense' ? (
            <div>
              <label className="label-caps">Onde essa despesa cai</label>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-md border border-border p-1">
                {(['account', 'card'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSettlement(option)}
                    disabled={option === 'card' && cards.length === 0}
                    className={[
                      'rounded-sm py-1.5 text-sm transition-colors disabled:opacity-40',
                      settlement === option
                        ? 'bg-surfaceAlt text-textPrimary'
                        : 'text-textSecondary hover:text-textPrimary',
                    ].join(' ')}
                  >
                    {option === 'account' ? 'Direto na conta' : 'Fatura do cartão'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {type === 'expense' && settlement === 'card' ? (
            <div>
              <label className="label-caps">Cartão</label>
              <select
                className="input-base mt-1"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-caps">Conta</label>
                <select
                  className="input-base mt-1"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">Sem conta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-caps">Forma</label>
                <select
                  className="input-base mt-1"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  {ACCOUNT_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {PAYMENT_METHOD_LABEL[option]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="label-caps">Categoria</label>
            <select
              className="input-base mt-1"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">
                {options.length ? 'Sem categoria' : 'Nenhuma categoria deste tipo'}
              </option>
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps">Começa em</label>
              <input
                type="month"
                className="input-base num mt-1"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
              />
            </div>
            <div>
              <label className="label-caps">Termina em</label>
              <input
                type="month"
                className="input-base num mt-1"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-textMuted">Opcional. Útil para parcelas fixas.</p>
            </div>
          </div>

          <TagPicker tags={tags} selected={tagIds} onChange={setTagIds} />
        </div>

        {error ? <p className="mt-3 text-xs text-expense">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-4 py-2 text-sm text-textSecondary transition-colors hover:text-textPrimary"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </>
  );
}
