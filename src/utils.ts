import { STATUS_OPTIONS, DELIVERY_STATUS_OPTIONS, PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS } from './types';
import type { ShotStatus, DeliveryStatus, Priority, Project } from './types';

/** Generate a unique ID */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/** Format a date string to locale display */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Get ISO date string for today */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Get ISO date string for now */
export function now(): string {
  return new Date().toISOString();
}

/** Calculate days between two dates (positive = future, negative = past) */
export function daysBetween(dateStr: string): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const todayDate = new Date(today());
  const diff = target.getTime() - todayDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Get status label from value */
export function getStatusLabel(value: ShotStatus): string {
  return STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

/** Get status color from value */
export function getStatusColor(value: ShotStatus): string {
  return STATUS_OPTIONS.find((s) => s.value === value)?.color ?? '#64748b';
}

/** Get delivery status label */
export function getDeliveryStatusLabel(value: DeliveryStatus): string {
  return DELIVERY_STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

/** Get delivery status color */
export function getDeliveryStatusColor(value: DeliveryStatus): string {
  return DELIVERY_STATUS_OPTIONS.find((s) => s.value === value)?.color ?? '#64748b';
}

/** Get priority label */
export function getPriorityLabel(value: Priority): string {
  return PRIORITY_OPTIONS.find((p) => p.value === value)?.label ?? value;
}

/** Get priority color */
export function getPriorityColor(value: Priority): string {
  return PRIORITY_OPTIONS.find((p) => p.value === value)?.color ?? '#64748b';
}

/** Get project status label */
export function getProjectStatusLabel(value: Project['status']): string {
  return PROJECT_STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

/** Get project status color */
export function getProjectStatusColor(value: Project['status']): string {
  return PROJECT_STATUS_OPTIONS.find((s) => s.value === value)?.color ?? '#64748b';
}

/** Generic sort comparator */
export function sortBy<T>(arr: T[], key: keyof T | string, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...arr].sort((a, b) => {
    const aVal = String(getNestedValue(a, key as string) ?? '');
    const bVal = String(getNestedValue(b, key as string) ?? '');
    const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
    return direction === 'asc' ? cmp : -cmp;
  });
}

/** Get a nested value from an object via dot-separated key */
function getNestedValue(obj: unknown, key: string): unknown {
  return key.split('.').reduce((o: unknown, k) => {
    if (o && typeof o === 'object' && k in (o as Record<string, unknown>)) {
      return (o as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

/** Filter rows by a search term across all string fields */
export function filterRows<T extends Record<string, unknown>>(rows: T[], search: string): T[] {
  if (!search.trim()) return rows;
  const term = search.toLowerCase();
  return rows.filter((row) =>
    Object.values(row).some((val) => {
      if (typeof val === 'string') return val.toLowerCase().includes(term);
      if (typeof val === 'number') return String(val).includes(term);
      return false;
    })
  );
}

/** Days remaining display text */
export function daysRemainingText(dateStr: string): string {
  if (!dateStr) return '—';
  const days = daysBetween(dateStr);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d remaining`;
}

/** Days remaining severity */
export function daysRemainingSeverity(dateStr: string): 'ok' | 'warning' | 'danger' | 'neutral' {
  if (!dateStr) return 'neutral';
  const days = daysBetween(dateStr);
  if (days < 0) return 'danger';
  if (days <= 3) return 'warning';
  return 'ok';
}

/** Export data rows to CSV string */
export function exportToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: string; label: string }[]
): string {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = getNestedValue(row, c.key);
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\n');
  return `${header}\n${body}`;
}

/** Trigger CSV download in browser */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
