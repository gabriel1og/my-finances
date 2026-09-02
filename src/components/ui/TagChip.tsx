export function TagChip({
  name,
  color,
  onRemove,
}: {
  name: string;
  color: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium leading-tight"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover tag ${name}`}
          className="opacity-70 transition-opacity hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
