import React from 'react';
import { useStore } from '../store';
import type { TabId } from '../types';
import { 
  Zap, 
  FolderKanban, 
  Clapperboard, 
  BarChart3, 
  CalendarDays, 
  Users,
  Box
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'today',    label: 'Today',    icon: <Zap size={18} /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={18} /> },
  { id: 'shots',    label: 'Shots',    icon: <Clapperboard size={18} /> },
  { id: 'status',   label: 'Status',   icon: <BarChart3 size={18} /> },
  { id: 'eta',      label: 'ETA',      icon: <CalendarDays size={18} /> },
  { id: 'artists',  label: 'Artists',  icon: <Users size={18} /> },
];

export default function Sidebar() {
  const { state, dispatch } = useStore();

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Box size={24} className="logo-icon-svg" />
        </div>
        <div className="sidebar-title">
          <span className="brand-name">VFX Tracker</span>
          <span className="brand-sub">Daily Task & Delivery</span>
        </div>
      </div>

      <div className="sidebar-date">
        <span className="sidebar-date-label">Today</span>
        <span className="sidebar-date-value">{todayDate}</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`sidebar-nav-item${state.activeTab === item.id ? ' active' : ''}${item.id === 'today' ? ' nav-today' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', payload: item.id })}
          >
            <span className="nav-icon-wrapper">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {state.activeTab === item.id && <span className="nav-indicator" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-version">v2.1.0 — Corporate Edition</div>
      </div>
    </aside>
  );
}
