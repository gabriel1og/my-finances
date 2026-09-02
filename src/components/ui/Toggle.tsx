'use client';

/**
 * Interruptor. Usa `role="switch"` + `aria-checked` em vez de um checkbox
 * estilizado: o leitor de tela anuncia "ativado/desativado", que é exatamente
 * a informação que o desenho comunica visualmente.
 *
 * O rótulo fica ao lado, e não dentro — texto que muda ("on"/"off") obriga a
 * ler para descobrir o estado; a posição do botão mostra na hora.
 */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={hint}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 transition-opacity disabled:opacity-50"
    >
      <span
        aria-hidden
        className={[
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-surfaceAlt border border-border',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all',
            checked ? 'left-[14px] bg-white' : 'left-[2px] bg-textMuted',
          ].join(' ')}
        />
      </span>

      <span className={checked ? 'text-textPrimary' : 'text-textSecondary'}>{label}</span>
    </button>
  );
}
