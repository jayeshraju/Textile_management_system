
import React from 'react';

/**
 * Universal StatusBadge component for LoomIQ platform (Light Theme).
 * Supports Order statuses, Delay flags, Machine operational states, Stock alerts,
 * Quality inspection grades, Quality stages, CAPA statuses, and Dispatch lifecycle states.
 */
export const StatusBadge = ({ type = 'order', value, status, className = '' }) => {
  const actualValue = value !== undefined ? value : status;
  if (!actualValue) return null;

  const normalized = String(actualValue).toUpperCase();

  // Auto-detect type if generic or mismatched
  let resolvedType = type;
  if (type === 'order') {
    if (['OK', 'LOW', 'OUT'].includes(normalized)) {
      resolvedType = 'stock';
    } else if (['ON_TRACK', 'AT_RISK', 'OVERDUE', 'DELAYED', 'INSUFFICIENT_DATA'].includes(normalized)) {
      resolvedType = 'delay';
    }
  }

  const getBadgeConfig = () => {
    // 1. Quality Inspection Status / Verdict
    if (resolvedType === 'quality' || resolvedType === 'qualityStatus') {
      switch (normalized) {
        case 'PASS':
          return { label: 'PASS', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'REWORK':
          return { label: 'REWORK', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500 animate-pulse' };
        case 'REJECT':
          return { label: 'REJECT', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
        case 'PENDING':
        default:
          return { label: 'PENDING', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 2. Stage Badges (GREY, DYEING, FINISHING, FINAL)
    if (resolvedType === 'stage') {
      switch (normalized) {
        case 'GREY':
          return { label: '1. Grey Weave', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', dot: 'bg-slate-500' };
        case 'DYEING':
          return { label: '2. Dyeing', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' };
        case 'FINISHING':
          return { label: '3. Finishing', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' };
        case 'FINAL':
          return { label: '4. Final QC', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' };
        default:
          return { label: actualValue, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 3. Corrective Action (CAPA) Statuses
    if (resolvedType === 'actionStatus' || resolvedType === 'caStatus') {
      switch (normalized) {
        case 'OPEN':
          return { label: 'Open', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500 animate-pulse' };
        case 'IN_PROGRESS':
          return { label: 'In Progress', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
        case 'DONE':
          return { label: 'Done (Pending Verification)', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' };
        case 'VERIFIED':
          return { label: 'Verified & Closed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        default:
          return { label: actualValue, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 4. Alert Severity
    if (resolvedType === 'severity') {
      switch (normalized) {
        case 'CRITICAL':
          return { label: 'CRITICAL', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500 animate-ping' };
        case 'WARN':
        case 'WARNING':
          return { label: 'WARNING', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        case 'MINOR':
          return { label: 'MINOR', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
        case 'MAJOR':
          return { label: 'MAJOR', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        default:
          return { label: actualValue, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 5. Dispatch Lifecycle Status
    if (resolvedType === 'dispatch' || resolvedType === 'dispatchStatus') {
      switch (normalized) {
        case 'DISPATCHED':
          return { label: 'Dispatched', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' };
        case 'READY_FOR_DISPATCH':
          return { label: 'Ready for Dispatch', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500 animate-pulse' };
        case 'NOT_DISPATCHED':
        default:
          return { label: 'Not Dispatched', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 6. Order Statuses
    if (resolvedType === 'order') {
      switch (normalized) {
        case 'IN_PROGRESS':
          return { label: 'In Progress', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500 animate-pulse' };
        case 'COMPLETED':
          return { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'ON_HOLD':
          return { label: 'On Hold', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        case 'QUEUED':
          return { label: 'Queued', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' };
        case 'CANCELLED':
          return { label: 'Cancelled', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
        default:
          return { label: actualValue, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 7. Delay & Radar Statuses
    if (resolvedType === 'delay' || resolvedType === 'radar') {
      switch (normalized) {
        case 'OVERDUE':
        case 'DELAYED':
          return { label: 'OVERDUE', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500 animate-ping' };
        case 'AT_RISK':
          return { label: 'AT RISK', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500 animate-pulse' };
        case 'ON_TRACK':
          return { label: 'ON TRACK', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'INSUFFICIENT_DATA':
        case 'INSUFFICIENT_DATA_ORDERS':
          return { label: 'INSUFFICIENT DATA', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
        case 'COMPLETED':
          return { label: 'COMPLETED', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
        default:
          return null;
      }
    }

    // 8. Machine States
    if (resolvedType === 'machine') {
      switch (normalized) {
        case 'RUNNING':
          return { label: 'Busy (Running)', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500 animate-pulse' };
        case 'AVAILABLE':
        case 'IDLE':
          return { label: 'Available', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        case 'MAINTENANCE':
        case 'BREAKDOWN':
          return { label: 'Maintenance', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        case 'OFFLINE':
          return { label: 'Offline', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
        default:
          return { label: actualValue, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    // 9. Stock Levels
    if (resolvedType === 'stock') {
      switch (normalized) {
        case 'OUT':
          return { label: 'Out of Stock', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500 animate-pulse' };
        case 'LOW':
          return { label: 'Low Stock', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
        case 'OK':
          return { label: 'Healthy', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
        default:
          return { label: actualValue, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
      }
    }

    return { label: actualValue, bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
  };

  const config = getBadgeConfig();
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border} shadow-2xs ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      <span className="tracking-wide">{config.label}</span>
    </span>
  );
};

export default StatusBadge;
