import React from 'react';

// Common Pulse animation helper
const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200/80 rounded-lg ${className}`} />
);

export const CommandCenterSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Top Warning Banner skeleton */}
      <div className="h-10 bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-center">
        <SkeletonPulse className="w-1/3 h-4" />
        <SkeletonPulse className="w-24 h-3 hidden sm:block" />
      </div>

      {/* Ticker skeleton */}
      <div className="h-10 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex items-center space-x-3">
        <SkeletonPulse className="w-28 h-4 bg-red-950/40 rounded" />
        <SkeletonPulse className="w-1/2 h-3.5 bg-slate-800 rounded" />
        <SkeletonPulse className="w-16 h-3.5 bg-slate-800 rounded ml-auto" />
      </div>

      {/* 4-Grid KPIs skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((id) => (
          <div key={id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center">
              <SkeletonPulse className="w-6 h-6 rounded-md" />
            </div>
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="w-16 h-3" />
              <SkeletonPulse className="w-24 h-6" />
              <SkeletonPulse className="w-28 h-3.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Recharts Analytics section skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="space-y-1.5 w-1/2">
            <SkeletonPulse className="w-3/4 h-4" />
            <SkeletonPulse className="w-1/2 h-3" />
          </div>
          <SkeletonPulse className="w-28 h-5" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-2">
            <SkeletonPulse className="w-32 h-4" />
            <div className="h-[240px] bg-slate-50 border border-slate-100 rounded-lg flex items-end p-4 space-x-2">
              {[...Array(12)].map((_, i) => (
                <SkeletonPulse key={i} className="flex-1" style={{ height: `${20 + (i * 6) % 75}%` }} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <SkeletonPulse className="w-32 h-4" />
            <div className="h-[240px] bg-slate-50 border border-slate-100 rounded-lg flex items-end p-4 space-x-2">
              {[...Array(12)].map((_, i) => (
                <SkeletonPulse key={i} className="flex-1 bg-slate-200" style={{ height: `${40 + (i * 4) % 50}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FIRSearchSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6 font-sans bg-slate-50">
      {/* Title block */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-2.5">
        <SkeletonPulse className="w-48 h-4.5 bg-blue-100/50" />
        <SkeletonPulse className="w-1/2 h-6" />
        <SkeletonPulse className="w-3/4 h-4.5" />
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          <div className="md:col-span-6">
            <SkeletonPulse className="w-full h-11" />
          </div>
          <div className="md:col-span-3">
            <SkeletonPulse className="w-full h-11" />
          </div>
          <div className="md:col-span-3">
            <SkeletonPulse className="w-full h-11" />
          </div>
        </div>
      </div>

      {/* Directory Table Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 border-b border-slate-100 p-3.5 flex justify-between items-center">
          <SkeletonPulse className="w-44 h-4.5" />
          <SkeletonPulse className="w-32 h-4" />
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="flex-1 grid grid-cols-4 gap-4">
                <SkeletonPulse className="w-24 h-4.5" />
                <SkeletonPulse className="w-28 h-4.5" />
                <SkeletonPulse className="w-32 h-4.5" />
                <SkeletonPulse className="w-20 h-4.5" />
              </div>
              <SkeletonPulse className="w-28 h-8 rounded-lg ml-4 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ReportsSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6 font-sans">
      {/* Top summary section */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-2">
        <SkeletonPulse className="w-36 h-4 bg-blue-100/40" />
        <SkeletonPulse className="w-1/3 h-6" />
        <SkeletonPulse className="w-2/3 h-4" />
      </div>

      {/* Analytical charts skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <SkeletonPulse className="w-1/2 h-5" />
            <SkeletonPulse className="w-20 h-5" />
          </div>
          <div className="h-[280px] bg-slate-50 rounded-lg flex items-end p-4 space-x-2">
            {[...Array(10)].map((_, i) => (
              <SkeletonPulse key={i} className="flex-1" style={{ height: `${30 + (i * 7) % 65}%` }} />
            ))}
          </div>
        </div>

        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <SkeletonPulse className="w-3/4 h-5 border-b border-slate-100 pb-3" />
          <div className="space-y-3.5">
            {[1, 2, 3, 4].map((id) => (
              <div key={id} className="flex justify-between items-center">
                <SkeletonPulse className="w-24 h-4" />
                <SkeletonPulse className="w-32 h-4" />
              </div>
            ))}
          </div>
          <div className="h-44 bg-slate-50 rounded-lg flex items-center justify-center">
            <SkeletonPulse className="w-28 h-28 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
