'use client';

import Link from 'next/link';

/**
 * Cartão de identidade no topo do menu: avatar de iniciais, nome e e-mail.
 *
 * Sem foto — o app não guarda avatar e não vai buscar imagem de terceiros só
 * para preencher um círculo. As iniciais vêm do nome; sem nome, do e-mail,
 * que é o único identificador que sempre existe.
 *
 * Recolhido, sobra só o avatar: é o que cabe em 64px e continua dizendo de
 * quem é a sessão.
 */
export function UserCard({
  name,
  email,
  collapsed = false,
}: {
  name: string | null;
  email: string | null;
  collapsed?: boolean;
}) {
  const display = name?.trim() || email?.split('@')[0] || 'Minha conta';
  const initials = initialsOf(display);

  const avatar = (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accentDim text-3xs font-semibold uppercase text-textPrimary"
    >
      {initials}
    </span>
  );

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <Link
          href="/settings"
          title={display}
          aria-label={`Conta de ${display}. Abrir configurações`}
          className="rounded-full ring-offset-2 ring-offset-surface transition-shadow hover:ring-2 hover:ring-borderHover"
        >
          {avatar}
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/settings"
      aria-label={`Conta de ${display}. Abrir configurações`}
      className="mx-3 mb-3 flex items-center gap-3 rounded-lg border border-border bg-surfaceAlt px-3 py-2.5 transition-colors hover:border-borderHover"
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-textPrimary">{display}</span>
        {/* O e-mail é truncado em 220px de barra, então o título nativo é o
            que permite ler o endereço inteiro sem sair da tela. */}
        {email ? (
          <span title={email} className="block truncate text-3xs text-textMuted">
            {email}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Primeira letra do primeiro e do segundo nome; uma só quando não há segundo. */
function initialsOf(value: string): string {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}
