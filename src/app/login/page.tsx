import { LoginForm } from '@/components/auth/LoginForm';
import { SESSION_EXPIRED } from '@/lib/auth-messages';

/**
 * Server component só para ler o que chega na URL: o `?error=` que a rota
 * `/auth/callback` devolve e o `?expired=1` do middleware. Ler isso no cliente
 * exigiria `useSearchParams` e um Suspense em volta do formulário inteiro.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expired?: string }>;
}) {
  const { error, expired } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LoginForm initialError={expired ? SESSION_EXPIRED : error} />
    </main>
  );
}
