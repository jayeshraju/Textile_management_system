import React from 'react';
import { PackageOpen } from 'lucide-react';

/**
 * Universal EmptyState component for LoomIQ platform.
 * Provides consistent empty state illustration, typography, and optional CTA button.
 */
export const EmptyState = ({
  icon: Icon = PackageOpen,
  title = 'No records found',
  description = 'No items match your active filters or search criteria.',
  message,
  action,
  className = '',
}) => {
  const desc = description || message;

  return (
    <div
      className={`p-8 sm:p-12 text-center bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col items-center justify-center my-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/80 text-slate-500 flex items-center justify-center mb-3.5 shadow-2xs">
        <Icon className="w-6 h-6 text-slate-500" />
      </div>
      <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
      {desc && (
        <p className="text-xs text-slate-500 max-w-md mt-1 mb-4 leading-relaxed">
          {desc}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

export default EmptyState;
