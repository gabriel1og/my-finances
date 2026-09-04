import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

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

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}
