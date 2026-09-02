/**
 * Mesmo símbolo do favicon (`src/app/icon.svg`), agora como componente para
 * poder ser usado na sidebar — antes o estado recolhido mostrava a letra "f"
 * em texto, que era placeholder.
 *
 * As cores são fixas, não `currentColor`: o símbolo é a marca, e marca não
 * muda de cor com hover ou estado ativo.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="flowly"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="7.5" fill="#5B6EF5" />
      <rect x="11" y="8" width="4" height="16" rx="1.2" fill="#F2F4FA" />
      <rect x="11" y="8" width="11" height="4" rx="1.2" fill="#F2F4FA" />
      <rect x="11" y="14.6" width="8" height="3.6" rx="1.2" fill="#C3CCFF" />
    </svg>
  );
}

/** Símbolo + nome, para os cabeçalhos com espaço. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-lg font-semibold tracking-tight">flowly</span>
    </span>
  );
}
