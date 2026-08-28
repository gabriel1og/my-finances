export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-textMuted">
      {message}
    </div>
  );
}
