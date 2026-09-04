'use client';

import { useEffect, useState } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { Spinner } from '@/components/ui/Spinner';
import {
  BIOMETRIC_RELOCK_SECONDS,
  clearBiometricSetting,
  isPlatformAuthenticatorAvailable,
  readBiometricSetting,
  registerBiometricCredential,
  saveBiometricSetting,
} from '@/lib/biometric';

const RELOCK_MINUTES = Math.round(BIOMETRIC_RELOCK_SECONDS / 60);

/**
 * Onde o cadeado é ligado. É um ajuste **por aparelho**, não da conta: a
 * credencial vive no autenticador deste celular ou notebook, então ligar aqui
 * não muda nada nos outros — e é por isso que o estado vem do localStorage e
 * não de `profiles`.
 */
export function BiometricPanel({ userId, label }: { userId: string; label: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(readBiometricSetting(userId) !== null);
    void isPlatformAuthenticatorAvailable().then(setSupported);
  }, [userId]);

  async function change(next: boolean) {
    setError(null);

    if (!next) {
      clearBiometricSetting();
      setEnabled(false);
      return;
    }

    setBusy(true);
    try {
      saveBiometricSetting(await registerBiometricCredential({ id: userId, label }));
      setEnabled(true);
    } catch {
      setError('Não foi possível registrar a biometria neste aparelho.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col">
      <span className="label-caps">Segurança</span>
      <p className="mt-1 text-xs text-textSecondary">
        Com o bloqueio ligado, abrir o flowly neste aparelho pede Face ID, Touch ID ou a biometria
        do sistema — inclusive quando a sessão ainda está válida e nenhum login acontece.
      </p>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm">
        <Toggle
          checked={enabled}
          onChange={(next) => void change(next)}
          disabled={busy || supported === false}
          label="Exigir biometria ao abrir"
          hint={
            supported === false
              ? 'Este aparelho não tem biometria disponível para o navegador.'
              : undefined
          }
        />
        {busy ? <Spinner className="text-textSecondary" /> : null}
      </div>

      {supported === false ? (
        <p className="mt-3 text-2xs text-textMuted">
          Este navegador não expõe biometria de plataforma. No iPhone, instale o flowly na tela de
          início — o Face ID fica disponível pelo app instalado.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      ) : null}

      <p className="mt-auto pt-3 text-2xs text-textMuted">
        Vale só neste aparelho. Volta a pedir depois de {RELOCK_MINUTES} minutos em segundo plano. É
        uma trava de tela: os dados continuam acessíveis a quem abrir o navegador com a sessão
        salva, então ela cobre celular emprestado, não invasão.
      </p>
    </div>
  );
}
