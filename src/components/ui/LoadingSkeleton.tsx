import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between space-x-4 py-2 border-b border-zinc-100">
          <div className="h-4 bg-zinc-200 rounded w-1/4"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/5"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/6"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/8"></div>
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-6 bg-white rounded-2xl border border-zinc-200 shadow-subtle animate-pulse">
      <div className="h-4 bg-zinc-200 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-zinc-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-zinc-200 rounded w-2/3"></div>
    </div>
  );
};

export const KpiGridSkeleton: React.FC<{ count?: number }> = ({ count = 10 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-3.5 border border-zinc-200/80 shadow-subtle">
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 bg-zinc-200 rounded w-2/3"></div>
            <div className="h-3.5 w-3.5 bg-zinc-200 rounded-full"></div>
          </div>
          <div className="h-6 bg-zinc-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 bg-zinc-200 rounded w-32"></div>
          <div className="h-3 bg-zinc-200 rounded w-20"></div>
        </div>
        <KpiGridSkeleton count={10} />
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-subtle overflow-hidden animate-pulse">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <div className="h-4 bg-zinc-200 rounded w-36 mb-1"></div>
            <div className="h-3 bg-zinc-200 rounded w-48"></div>
          </div>
          <div className="h-4 bg-zinc-200 rounded w-16"></div>
        </div>
        <TableSkeleton rows={5} />
      </div>
    </div>
  );
};

export const CampaignsListSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-200">
        <div className="h-9 bg-zinc-200 rounded-xl w-72"></div>
        <div className="h-9 bg-zinc-200 rounded-xl w-32"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};

export const CampaignDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="w-9 h-9 bg-zinc-200 rounded-xl"></div>
          <div>
            <div className="h-5 bg-zinc-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-zinc-200 rounded w-64"></div>
          </div>
        </div>
        <div className="h-9 bg-zinc-200 rounded-xl w-24"></div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-zinc-200">
        <div className="h-4 bg-zinc-200 rounded w-full mb-3"></div>
        <div className="h-3 bg-zinc-200 rounded w-1/3"></div>
      </div>
      <KpiGridSkeleton count={8} />
      <div className="bg-white rounded-2xl border border-zinc-200 p-6">
        <TableSkeleton rows={5} />
      </div>
    </div>
  );
};
