'use client';

import { Suspense } from 'react';
import { MonthPicker } from '@/components/layout/MonthPicker';
import { SidebarNav } from '@/components/layout/SidebarNav';

export function Sidebar() {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between px-5 py-6">
        <span className="text-lg font-semibold tracking-tight">flowly</span>
        <Suspense fallback={<div className="h-[18px] w-[86px]" />}>
          <MonthPicker />
        </Suspense>
      </div>

      {/* useSearchParams exige Suspense no App Router. */}
      <Suspense fallback={<div className="h-[264px]" />}>
        <SidebarNav />
      </Suspense>
    </aside>
  );
}
