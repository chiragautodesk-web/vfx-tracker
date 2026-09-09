import type { ShotStatus, DeliveryStatus, Priority, Project } from '../types';
import { 
  getStatusColor, getStatusLabel, 
  getDeliveryStatusColor, getDeliveryStatusLabel, 
  getPriorityColor, getPriorityLabel, 
  getProjectStatusColor, getProjectStatusLabel,
  getDepartmentColor, getDepartmentLabel 
} from '../utils';

interface StatusBadgeProps {
  status: ShotStatus;
}

export function DepartmentBadge({ department }: { department?: string }) {
  if (!department) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const color = getDepartmentColor(department);
  return (
    <span
      className="badge"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}35`,
        boxShadow: `0 0 8px ${color}12`,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {getDepartmentLabel(department)}
    </span>
  );
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = getStatusColor(status);
  return (
    <span
      className="badge"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        boxShadow: `0 0 8px ${color}15`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {getStatusLabel(status)}
    </span>
  );
}

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const color = getDeliveryStatusColor(status);
  return (
    <span
      className="badge"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
      }}
    >
      {getDeliveryStatusLabel(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const color = getPriorityColor(priority);
  return (
    <span
      className="badge"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
      }}
    >
      {getPriorityLabel(priority)}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: Project['status'] }) {
  const color = getProjectStatusColor(status);
  return (
    <span
      className="badge"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {getProjectStatusLabel(status)}
    </span>
  );
}
