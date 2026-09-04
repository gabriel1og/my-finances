import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SESSION_COOKIE, sessionCookieOptions, sessionCookieValue } from '@/lib/session';

/**
 * Retorno do OAuth (Google) e dos links de e-mail do Supabase.
 *
 * O provedor devolve um `code` de uso único; trocá-lo por sessão é o que grava
 * os cookies de autenticação. Sem esta rota o usuário volta do Google
 * autenticado no Supabase mas deslogado no app.
 *
 * A rota é pública no middleware (prefixo `/auth`) — precisa ser, porque quem
 * chega aqui ainda não tem sessão.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const errorParam = searchParams.get('error_description') ?? searchParams.get('error');
  if (errorParam) return failure(request, origin, errorParam);

  const code = searchParams.get('code');
  if (!code) return failure(request, origin, 'Link de autenticação inválido ou expirado.');

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failure(request, origin, error.message);

  // `next` vem da própria aplicação, mas chega pela URL: só caminho interno.
  const next = searchParams.get('next');
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  const response = NextResponse.redirect(resolve(request, origin, destination));
  // Marca o inicio da sessao (prazo de inatividade) — o outro ponto que faz
  // isso sao as server actions de `/login`. Ver `src/lib/session.ts`.
  response.cookies.set(SESSION_COOKIE, sessionCookieValue(), sessionCookieOptions());
  return response;
}

function failure(request: NextRequest, origin: string, message: string) {
  return NextResponse.redirect(
    resolve(request, origin, `/login?error=${encodeURIComponent(message)}`),
  );
}

/**
 * Atrás do proxy da Vercel o `origin` da request é o host interno; o host que o
 * navegador conhece vem no `x-forwarded-host`. Sem isso o redirect final sai
 * para um domínio que o usuário não consegue acessar.
 */
function resolve(request: NextRequest, origin: string, path: string) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (process.env.NODE_ENV === 'development' || !forwardedHost) return `${origin}${path}`;
  return `https://${forwardedHost}${path}`;
}
