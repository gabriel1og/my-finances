'use client';

import { DateField } from '@/components/ui/DateField';
import { useState, useTransition } from 'react';
import { Modal, ModalTrigger } from '@/components/ui/Modal';
import { createTransfer, updateTransfer } from '@/app/(app)/transactions/actions';
import type { Account } from '@/types/database.types';

/** Valores de uma transferência existente, para o modo edição. */
export type TransferDraft = {
  group: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description: string;
};

/**
 * Como o `TransactionModal`: com `open`/`onOpenChange` o diálogo fica
 * controlado por fora e nenhum gatilho é renderizado.
 */
export function TransferModal({
  accounts,
  transfer,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  accounts: Account[];
  transfer?: TransferDraft;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const editing = Boolean(transfer);
  const controlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlled ? openProp : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  const [fromAccountId, setFromAccountId] = useState(
    transfer?.fromAccountId ?? accounts[0]?.id ?? '',
  );
  const [toAccountId, setToAccountId] = useState(transfer?.toAccountId ?? accounts[1]?.id ?? '');
  const [amount, setAmount] = useState(transfer ? String(transfer.amount).replace('.', ',') : '');
  const [date, setDate] = useState(
    transfer?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState(transfer?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const input = {
      fromAccountId,
      toAccountId,
      amount: Number(amount.replace(',', '.')),
      date,
      description,
    };

    startTransition(async () => {
      const result = editing
        ? await updateTransfer(transfer!.group, input)
        : await createTransfer(input);

      if (result.error) return setError(result.error);
      if (!editing) {
        setAmount('');
        setDescription('');
      }
      setOpen(false);
    });
  }

  return (
    <>
      {controlled ? null : (
        <ModalTrigger
          trigger={trigger}
          onOpen={() => setOpen(true)}
          fallback={
            <button
              disabled={accounts.length < 2}
              title={accounts.length < 2 ? 'Cadastre ao menos duas contas' : undefined}
              className="btn-secondary"
            >
              Transferir
            </button>
          }
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar transferência' : 'Transferência entre contas'}
      >
        <p className="mt-1 text-xs text-textSecondary">
          Move saldo de uma conta para outra. Não conta como receita nem despesa.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps">De</label>
              <select
                className="select-base mt-1"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-caps">Para</label>
              <select
                className="select-base mt-1"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps">Valor</label>
              <input
                className="input-base num mt-1"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="label-caps">Data</label>
              <DateField value={date} onChange={setDate} label="Data" className="mt-1" />
            </div>
          </div>

          <div>
            <label className="label-caps">Descrição</label>
            <input
              className="input-base mt-1"
              value={description}
              maxLength={120}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional — por padrão, De → Para"
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-xs text-expense">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={submit} disabled={pending} className="btn-primary">
            {pending ? 'Salvando...' : editing ? 'Salvar' : 'Transferir'}
          </button>
        </div>
      </Modal>
    </>
  );
}
