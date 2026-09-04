import { LoginForm } from '@/components/auth/LoginForm';

/**
 * Server component só para ler o `?error=` que a rota `/auth/callback` devolve
 * quando o OAuth falha — ler isso no cliente exigiria `useSearchParams` e um
 * Suspense em volta do formulário inteiro.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LoginForm initialError={error} />
    </main>
  );
}
