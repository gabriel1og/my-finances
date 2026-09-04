/**
 * Prazo de sessão da aplicação.
 *
 * O Supabase só oferece "Time-box user sessions" / "Inactivity timeout" no
 * plano Pro. No plano free o prazo é imposto aqui: um cookie marcador cujo
 * próprio `maxAge` é o cronômetro. Toda request autenticada regrava o cookie
 * com 12h novas; ficar 12h sem nenhuma request faz o navegador descartá-lo, e
 * o middleware trata "sessão do Supabase válida + marcador ausente" como
 * expiração.
 *
 * Escopo do que isso garante: expira a sessão *na aplicação*. O refresh token
 * do Supabase continua válido, então quem copiar os cookies e falar direto com
 * a API ainda passa — a RLS é que impede ver dados de outro usuário. O risco
 * coberto aqui é o de sessão esquecida aberta.
 */
export const SESSION_COOKIE = 'flowly_session';

/** Janela de inatividade: 12h. */
export const SESSION_IDLE_SECONDS = 12 * 60 * 60;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_IDLE_SECONDS,
  };
}

/** Valor do cookie: só um carimbo de tempo, para depuração. Nada sensível. */
export function sessionCookieValue() {
  return String(Date.now() + SESSION_IDLE_SECONDS * 1000);
}
