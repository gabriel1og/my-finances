import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function AppLoading() {
  return (
    <div className="animate-fadeUp">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="card col-span-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-[220px] w-full" />
        </div>
        <div className="card">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
