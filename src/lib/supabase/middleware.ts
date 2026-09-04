import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';
import { SESSION_COOKIE, sessionCookieOptions, sessionCookieValue } from '@/lib/session';

const PUBLIC_ROUTES = ['/login', '/auth'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { pathname, searchParams } = request.nextUrl;

  // Resgate do `code` do OAuth.
  //
  // Quando a URL passada em `redirectTo` nao esta na lista de Redirect URLs do
  // Supabase, ele ignora o pedido e devolve o usuario na Site URL — com o
  // `code` na query, mas fora de `/auth/callback`. Ai o codigo chega em `/`,
  // este middleware manda para `/login` por falta de sessao e o login "nao sai
  // do lugar", mesmo com o usuario ja criado no Supabase.
  //
  // Nenhuma rota da aplicacao usa `code` como parametro, entao encaminhar e
  // seguro. Nao vale para `error`: `/login?error=...` e justamente para onde o
  // callback devolve as falhas, e encaminhar criaria um laco.
  if (searchParams.has('code') && !pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    if (pathname !== '/' && !PUBLIC_ROUTES.includes(pathname)) {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // Prazo de inatividade (ver `src/lib/session.ts`). O marcador e regravado
    // com 12h novas a cada request autenticada; se ele sumiu, o navegador o
    // descartou por vencimento — ou seja, 12h sem nenhuma request.
    //
    // `/auth` fica de fora: e por la que a sessao comeca, e derrubar os cookies
    // no meio do callback descartaria o `code` antes da troca por sessao.
    if (!request.cookies.has(SESSION_COOKIE) && !pathname.startsWith('/auth')) {
      return expire(request);
    }
    response.cookies.set(SESSION_COOKIE, sessionCookieValue(), sessionCookieOptions());
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * Encerra a sessao expirada: manda para o login com aviso e apaga os cookies do
 * Supabase, para a proxima request ja chegar deslogada. Apagar na resposta e
 * melhor que `signOut()` aqui, que custaria uma ida a rede no middleware.
 */
function expire(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '?expired=1';

  const redirect = NextResponse.redirect(url);
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) redirect.cookies.delete({ name: cookie.name, path: '/' });
  }
  redirect.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return redirect;
}
