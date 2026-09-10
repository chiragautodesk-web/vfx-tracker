import type { ReactNode } from 'react';
import CloudSyncWidget from './CloudSyncWidget';
import './TopBar.css';

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: { label: string; value: string | number; color?: string }[];
  showSync?: boolean;
}

export default function TopBar({ title, subtitle, actions, stats, showSync = true }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
      </div>

      {stats && stats.length > 0 && (
        <div className="topbar-stats">
          {stats.map((s) => (
            <div key={s.label} className="topbar-stat">
              <span className="stat-value" style={s.color ? { color: s.color } : undefined}>
                {s.value}
              </span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="topbar-actions">
        {showSync && <CloudSyncWidget />}
        {actions}
      </div>
    </header>
  );
}
