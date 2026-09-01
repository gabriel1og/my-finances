'use client';

import { useState, useTransition } from 'react';
import { Modal, ModalTrigger } from '@/components/ui/Modal';
import { ACCOUNT_KIND_LABEL, CATEGORY_PALETTE } from '@/lib/constants';
import { createAccount, updateAccount } from '@/app/(app)/accounts/actions';
import type { Account, AccountKind } from '@/types/database.types';

export function AccountFormModal({
  account,
  trigger,
}: {
  account?: Account;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(account);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'checking');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [color, setColor] = useState(account?.color ?? CATEGORY_PALETTE[0]);
  const [openingBalance, setOpeningBalance] = useState(
    String(account?.opening_balance ?? '0').replace('.', ','),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const input = {
      name,
      kind,
      institution: institution || null,
      color,
      openingBalance: Number(openingBalance.replace(',', '.') || '0'),
    };

    startTransition(async () => {
      const result = editing ? await updateAccount(account!.id, input) : await createAccount(input);
      if (result.error) return setError(result.error);
      setOpen(false);
      if (!editing) {
        setName('');
        setInstitution('');
        setOpeningBalance('0');
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
          Nova conta
        </button>
        }
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar conta' : 'Nova conta'}>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label-caps">Nome</label>
                <input
                  className="input-base mt-1"
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Conta corrente, carteira..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-caps">Tipo</label>
                  <select
                    className="input-base mt-1"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as AccountKind)}
                  >
                    {Object.entries(ACCOUNT_KIND_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-caps">Instituição</label>
                  <input
                    className="input-base mt-1"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <label className="label-caps">Saldo inicial</label>
                <input
                  className="input-base num mt-1"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0,00"
                />
                <p className="mt-1 text-[11px] text-textMuted">
                  Quanto havia na conta antes do primeiro lançamento. Aceita negativo.
                </p>
              </div>

              <div>
                <label className="label-caps">Cor</label>
                <div className="mt-2 flex gap-2">
                  {CATEGORY_PALETTE.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-label={`Cor ${option}`}
                      className={[
                        'h-6 w-6 rounded-full border-2 transition-colors',
                        color.toLowerCase() === option.toLowerCase()
                          ? 'border-textPrimary'
                          : 'border-transparent',
                      ].join(' ')}
                      style={{ backgroundColor: option }}
                    />
                  ))}
                </div>
              </div>
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
