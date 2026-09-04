'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoMark } from '@/components/layout/Logo';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import {
  BIOMETRIC_LOCK_CLASS,
  clearBiometricSetting,
  readBiometricSetting,
  shouldRelock,
  verifyBiometricCredential,
  type BiometricSetting,
} from '@/lib/biometric';

/** `null` = ainda não se sabe (o localStorage só existe depois da hidratação). */
type Status = 'locked' | 'verifying' | 'unlocked' | null;

/**
 * Tela de bloqueio biométrico, irmã do `SessionGuard` no layout de `(app)`.
 *
 * Por que não basta o login: a sessão dura 12h, então na maioria das aberturas
 * nenhum login acontece — o app já abre logado. O cadeado aqui é a única coisa
 * entre abrir o ícone na tela de início e ver o saldo.
 *
 * Quando bloqueia:
 * - ao montar, se existe credencial registrada para este usuário;
 * - ao voltar do segundo plano depois de `BIOMETRIC_RELOCK_SECONDS`. Trocar de
 *   app por dez segundos não deve pedir Face ID de novo; deixar o celular na
 *   mesa por meia hora, sim.
 *
 * O flash antes da hidratação é resolvido fora daqui: `BiometricLockPaint`
 * cobre a tela antes da primeira pintura e este componente tira a cobertura
 * assim que assume o controle.
 *
 * Limite honesto: é cadeado de UI. O conteúdo continua na árvore, atrás de uma
 * camada opaca, e os cookies `sb-*` seguem no aparelho. Cobre celular emprestado,
 * não atacante técnico.
 */
export function BiometricGuard({ userId }: { userId: string }) {
  const router = useRouter();
  const [setting, setSetting] = useState<BiometricSetting | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [failed, setFailed] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const prompted = useRef(false);

  useEffect(() => {
    const stored = readBiometricSetting(userId);
    setSetting(stored);
    setStatus(stored ? 'locked' : 'unlocked');
  }, [userId]);

  // A cobertura pré-pintura sai assim que este componente sabe o que mostrar —
  // inclusive quando a resposta é "não há cadeado".
  useEffect(() => {
    if (status === null) return;
    document.documentElement.classList.remove(BIOMETRIC_LOCK_CLASS);
  }, [status]);

  const unlock = useCallback(
    async (auto = false) => {
      if (!setting) return;
      setStatus('verifying');
      setFailed(false);
      try {
        await verifyBiometricCredential(setting);
        setStatus('unlocked');
      } catch {
        // Numa tentativa automática o erro mais comum é "faltou gesto do
        // usuário" (o Safari exige um toque para o WebAuthn). Isso não é falha
        // digna de alerta vermelho — só devolve o botão.
        setStatus('locked');
        setFailed(!auto);
      }
    },
    [setting],
  );

  // Uma tentativa automática por bloqueio: no Android e no Chrome ela já abre o
  // prompt sozinha; onde o gesto é exigido, cai no botão sem alarde.
  useEffect(() => {
    if (status !== 'locked' || prompted.current) return;
    prompted.current = true;
    void unlock(true);
  }, [status, unlock]);

  useEffect(() => {
    if (!setting) return;

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      if (!shouldRelock(hiddenAt.current)) return;
      hiddenAt.current = null;
      prompted.current = false;
      setStatus('locked');
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [setting]);

  // Sem isto a página atrás continua rolando sob a camada — o gesto passa e o
  // usuário vê a barra de rolagem se mexer.
  useEffect(() => {
    if (status === null || status === 'unlocked') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [status]);

  /**
   * Saída de emergência, e ela é obrigatória: aparelho novo, biometria
   * reconfigurada ou credencial apagada pelo sistema deixariam a conta
   * inacessível para sempre. Sair remove o cadeado local junto — senão o
   * próximo login cairia na mesma tela sem chave.
   */
  async function signOutAndForget() {
    clearBiometricSetting();
    await createClient().auth.signOut();
    router.replace('/login');
  }

  if (status === null || status === 'unlocked') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="flowly bloqueado"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-bg px-6 text-center"
    >
      <LogoMark size={44} />

      <div>
        <p className="text-lg font-semibold text-textPrimary">flowly está bloqueado</p>
        <p className="mt-1 text-xs text-textSecondary">
          Confirme com a biometria do aparelho para ver seus dados.
        </p>
      </div>

      <button
        type="button"
        autoFocus
        onClick={() => void unlock()}
        disabled={status === 'verifying'}
        className="btn-primary"
      >
        {status === 'verifying' ? (
          <>
            <Spinner />
            Aguardando...
          </>
        ) : (
          'Desbloquear'
        )}
      </button>

      {failed ? (
        <p role="alert" className="text-xs text-expense">
          Não foi possível confirmar. Tente de novo.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void signOutAndForget()}
        className="text-2xs text-textMuted underline underline-offset-4 transition-colors hover:text-textSecondary"
      >
        Sair da conta e remover o bloqueio deste aparelho
      </button>
    </div>
  );
}
