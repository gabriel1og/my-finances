'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SESSION_IDLE_SECONDS } from '@/lib/session';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'visibilitychange'] as const;

/**
 * Quem impõe o prazo de sessão é o middleware — mas ele só roda quando existe
 * uma request. Uma aba deixada aberta continuaria mostrando a tela antiga por
 * tempo indefinido, e o usuário só descobriria que expirou ao clicar em algo.
 * Este timer fecha essa janela: cumpre o mesmo prazo no cliente e desloga na
 * hora, sem esperar a próxima navegação.
 *
 * É cortesia de UX, não a garantia: o servidor decide. Por isso o relógio pode
 * viver no cliente sem problema.
 */
export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function expire() {
      await createClient().auth.signOut();
      router.replace('/login?expired=1');
    }

    function reset() {
      // `visibilitychange` também dispara ao esconder a aba; só voltar a ela
      // conta como atividade.
      if (document.visibilityState === 'hidden') return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(expire, SESSION_IDLE_SECONDS * 1000);
    }

    reset();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset);
    };
    // `pathname` na lista: navegar é atividade, e reinicia a contagem.
  }, [router, pathname]);

  return null;
}
