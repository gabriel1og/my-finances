'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ACCOUNT_EXISTS, translateAuthError } from '@/lib/auth-messages';
import { SESSION_COOKIE, sessionCookieOptions, sessionCookieValue } from '@/lib/session';

export type AuthResult =
  | { status: 'ok' }
  | { status: 'error'; message: string; switchToSignIn?: boolean }
  | { status: 'notice'; message: string };

/**
 * Entrar e cadastrar são server actions — e não chamadas do browser — para que
 * exista um único lugar no servidor que marca "a sessão começou agora". O outro
 * é `/auth/callback`, por onde passam Google e link de e-mail. Sem isso o
 * middleware não conseguiria distinguir "acabou de entrar" de "marcador
 * expirado", e o prazo de inatividade não teria como funcionar.
 */
async function startSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookieValue(), sessionCookieOptions());
}

/** Origem real da request — atrás do proxy da Vercel o host vem no forwarded. */
async function requestOrigin() {
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host');
  const proto = list.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) return { status: 'error', message: 'Preencha e-mail e senha.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: 'error', message: translateAuthError(error.message) };

  await startSession();
  return { status: 'ok' };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) return { status: 'error', message: 'Preencha e-mail e senha.' };
  if (password.length < 6)
    return { status: 'error', message: 'A senha precisa ter ao menos 6 caracteres.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await requestOrigin()}/auth/callback` },
  });
  if (error) return { status: 'error', message: translateAuthError(error.message) };

  // Com "Confirm email" desligado o cadastro já devolve sessão e entra direto.
  if (data.session) {
    await startSession();
    return { status: 'ok' };
  }

  // Com a confirmação ligada, e-mail já cadastrado volta como usuário sem
  // identities (o Supabase não revela que a conta existe). Sem este caso o
  // usuário fica esperando um e-mail que nunca chega.
  if (data.user && data.user.identities?.length === 0) {
    return { status: 'error', message: ACCOUNT_EXISTS, switchToSignIn: true };
  }

  return {
    status: 'notice',
    message: `Enviamos um link de confirmação para ${email}. Abra o link para ativar a conta.`,
  };
}
