'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signIn, signUp } from '@/app/login/actions';
import { translateAuthError } from '@/lib/auth-messages';
import { Logo } from '@/components/layout/Logo';
import { Spinner } from '@/components/ui/Spinner';

/**
 * `redirecting` é um estado terminal: entra quando a autenticação deu certo e
 * não sai mais. A navegação para `/dashboard` é uma rota dinâmica (busca perfil
 * e dados no servidor) e leva um tempo perceptível; se o botão voltasse ao
 * normal quando a action responde, a tela ficaria parada e sem explicação
 * justamente no trecho mais lento. O mesmo vale para o Google, em que a página
 * ainda vai ser trocada pelo navegador.
 */
type Status = 'idle' | 'submitting' | 'google' | 'redirecting';

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const busy = status !== 'idle';

  function toDashboard() {
    setStatus('redirecting');
    // `replace`: entrar não deve deixar a tela de login no histórico — o botão
    // voltar do navegador cairia numa página que o middleware devolve.
    router.replace('/dashboard');
    router.refresh();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);
    setNotice(null);

    // Server actions, e não chamadas do browser: é no servidor que a sessão da
    // aplicação é marcada (prazo de inatividade). Ver `src/lib/session.ts`.
    const result =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password);

    if (result.status === 'ok') return toDashboard();

    setStatus('idle');
    if (result.status === 'notice') return setNotice(result.message);

    if (result.switchToSignIn) setMode('signin');
    setError(result.message);
  }

  async function signInWithGoogle() {
    setStatus('google');
    setError(null);
    setNotice(null);

    // O OAuth continua no browser: quem marca a sessão é `/auth/callback`.
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    // Em caso de sucesso o navegador já está saindo da página; só o erro volta.
    if (authError) {
      setStatus('idle');
      setError(translateAuthError(authError.message));
    }
  }

  const submitLabel =
    status === 'redirecting'
      ? 'Entrando...'
      : status === 'submitting'
        ? 'Verificando...'
        : mode === 'signin'
          ? 'Entrar'
          : 'Cadastrar';

  return (
    <form onSubmit={submit} aria-busy={busy} className="card w-full max-w-sm animate-fadeUp">
      <Logo />
      <p className="mt-1 text-sm text-textSecondary">
        {mode === 'signin' ? 'Entre na sua conta' : 'Crie sua conta'}
      </p>

      {/* fieldset desabilita tudo de uma vez: sem isso dá para reenviar o
          formulário pelo Enter enquanto o redirect está em andamento. */}
      <fieldset disabled={busy} className="contents">
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surfaceAlt text-sm font-medium text-textPrimary transition-colors hover:border-borderHover disabled:opacity-50"
        >
          {status === 'google' ? <Spinner /> : null}
          {status === 'google' ? 'Redirecionando...' : 'Continuar com Google'}
        </button>

        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          <span className="text-2xs uppercase tracking-[0.08em] text-textMuted">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="label-caps" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input-base mt-1 disabled:opacity-60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label-caps" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              className="input-base mt-1 disabled:opacity-60"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-xs text-expense">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-xs text-income">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === 'submitting' || status === 'redirecting' ? <Spinner /> : null}
          {submitLabel}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
          className="mt-3 w-full text-xs text-textSecondary transition-colors hover:text-textPrimary disabled:opacity-50"
        >
          {mode === 'signin' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </fieldset>
    </form>
  );
}
