import { useMemo, useState } from 'react';
import {
  useStore,
  useProjectName,
  useArtistNames,
  useTodayShots,
  useTodayDeliveries,
  useInProgressShots,
  usePendingShots,
  useOverdueShots,
} from '../store';
import type { Shot, ColumnDef } from '../types';
import { STATUS_OPTIONS, DELIVERY_STATUS_OPTIONS, PRIORITY_OPTIONS, DEPARTMENT_OPTIONS } from '../types';
import { formatDate, now, today, daysRemainingText, daysRemainingSeverity, parseDepartmentList } from '../utils';
import DataGrid from '../components/DataGrid';
import TopBar from '../components/TopBar';
import { StatusBadge, DeliveryBadge, PriorityBadge, DepartmentBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { Rocket, RefreshCw, Hourglass, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './TodayPage.css';
import NotesModal from '../components/NotesModal';

export default function TodayPage() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const getProjectName = useProjectName();
  const getArtistNames = useArtistNames();

  const [notesShot, setNotesShot] = useState<Shot | null>(null);

  const todayStr = today();
  const overdueShots = useOverdueShots();
  const todayDeliveries = useTodayDeliveries();
  const todayShots = useTodayShots();
  const inProgressShots = useInProgressShots();
  const pendingShots = usePendingShots();

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Filtered rows for the DataGrid: prioritize action-needed shots
  const allTodayWork = useMemo(() => {
    return [
      ...overdueShots,
      ...todayDeliveries.filter((s) => !overdueShots.some((o) => o.id === s.id)),
      ...todayShots.filter(
        (s) => !overdueShots.some((o) => o.id === s.id) && !todayDeliveries.some((d) => d.id === s.id)
      ),
      ...inProgressShots.filter(
        (s) =>
          !overdueShots.some((o) => o.id === s.id) &&
          !todayDeliveries.some((d) => d.id === s.id) &&
          !todayShots.some((t) => t.id === s.id)
      ),
    ];
  }, [overdueShots, todayDeliveries, todayShots, inProgressShots]);

  const deliveredToday = useMemo(() => {
    return state.shots.filter(
      (s) => s.deliveryStatus === 'delivered' && s.finalDeliveryDate === todayStr
    );
  }, [state.shots, todayStr]);

  const columns: ColumnDef<Shot>[] = useMemo(() => [
    {
      key: 'priority', label: '!', width: 50,
      editable: true, type: 'select',
      options: PRIORITY_OPTIONS,
      render: (row) => <PriorityBadge priority={row.priority} />,
      getValue: (row) => row.priority,
    },
    {
      key: 'shotName',
      label: 'Shot Name',
      width: 160,
      editable: true,
      type: 'text',
      render: (row) => <span className="cell-text" style={{ fontWeight: 600 }}>{row.shotName || row.shotNumber}</span>,
      getValue: (row) => row.shotName || row.shotNumber || '',
    },
    {
      key: 'scopeOfWork',
      label: 'Scope of Work',
      width: 200,
      editable: true,
      type: 'text',
      render: (row) => (
        <span className="cell-text" title={row.scopeOfWork} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.scopeOfWork ? row.scopeOfWork : <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </span>
      ),
      getValue: (row) => row.scopeOfWork || '',
    },
    {
      key: 'department',
      label: 'Department',
      width: 190,
      editable: true,
      type: 'multiselect',
      options: DEPARTMENT_OPTIONS,
      render: (row) => <DepartmentBadge department={row.department} />,
      getValue: (row) => Array.isArray(row.department) ? row.department.join(', ') : (row.department ? String(row.department) : ''),
    },
    {
      key: 'notes', label: 'Notes', width: 250,
      render: (row) => (
        <button
          className="btn btn-ghost btn-sm cell-text"
          style={{ justifyContent: 'flex-start', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 var(--space-2)' }}
          onClick={(e) => { e.stopPropagation(); setNotesShot(row); }}
          title={row.notes}
        >
          {row.notes ? row.notes : <span style={{ color: 'var(--text-muted)' }}>+ Add notes</span>}
        </button>
      ),
      getValue: (row) => row.notes || '',
    },
    {
      key: 'projectId', label: 'Project', width: 150,
      editable: true, type: 'select',
      options: state.projects.map((p) => ({ value: p.id, label: p.name })),
      render: (row) => <span className="cell-text">{getProjectName(row.projectId)}</span>,
      getValue: (row) => getProjectName(row.projectId),
    },
    {
      key: 'artistIds', label: 'Artist', width: 140,
      editable: true,
      type: 'multiselect',
      options: state.artists.map((a) => ({ value: a.id, label: a.name })),
      render: (row) => {
        if (!row.artistIds || row.artistIds.length === 0) return <span className="cell-text" style={{ color: 'var(--text-muted)' }}>Unassigned</span>;
        
        return (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '4px 0' }}>
            {row.artistIds.map(id => {
              const artist = state.artists.find((a) => a.id === id);
              if (!artist) return null;
              return (
                <span key={id} className="artist-chip" style={{ margin: 0 }}>
                  <span className="artist-avatar" style={{ background: artist.avatarColor }}>{artist.name.charAt(0)}</span>
                  <span style={{ maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.name.split(' ')[0]}</span>
                </span>
              );
            })}
          </div>
        );
      },
      getValue: (row) => getArtistNames(row.artistIds),
    },
    {
      key: 'status', label: 'Status', width: 180,
      editable: true, type: 'select',
      options: STATUS_OPTIONS,
      render: (row) => <StatusBadge status={row.status} />,
      getValue: (row) => row.status,
    },
    {
      key: 'deliveryStatus', label: 'Delivery', width: 140,
      editable: true, type: 'select',
      options: DELIVERY_STATUS_OPTIONS,
      render: (row) => <DeliveryBadge status={row.deliveryStatus} />,
      getValue: (row) => row.deliveryStatus,
    },
    {
      key: 'finalDeliveryDate', label: 'Due Date', width: 120,
      editable: true, type: 'date',
      render: (row) => {
        const isToday = row.finalDeliveryDate === todayStr;
        return (
          <span className="cell-text" style={{ fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent-start)' : undefined }}>
            {formatDate(row.finalDeliveryDate)}
          </span>
        );
      },
      getValue: (row) => row.finalDeliveryDate,
    },
    {
      key: 'timeLeft', label: 'Time Left', width: 120,
      sortable: true, filterable: false,
      render: (row) => {
        if (row.deliveryStatus === 'delivered') return <span className="days-badge ok">✓ Done</span>;
        const severity = daysRemainingSeverity(row.finalDeliveryDate);
        return <span className={`days-badge ${severity}`}>{daysRemainingText(row.finalDeliveryDate)}</span>;
      },
      getValue: (row) => row.finalDeliveryDate || '',
    },
    {
      key: 'action', label: '', width: 110,
      sortable: false, filterable: false,
      render: (row) => {
        if (row.deliveryStatus === 'delivered') return null;
        return (
          <button
            className="btn btn-primary btn-sm"
            style={{ fontSize: 'var(--text-xs)' }}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({
                type: 'UPDATE_SHOT',
                payload: { ...row, deliveryStatus: 'delivered', finalDeliveryDate: row.finalDeliveryDate || todayStr, updatedAt: now() },
              });
              showToast(`${row.shotName || row.shotNumber} marked delivered ✓`);
            }}
          >
            Mark Delivered
          </button>
        );
      },
    },
  ], [state.projects, state.artists, getProjectName, getArtistNames, dispatch, showToast, todayStr]);

  const handleRowUpdate = (row: Shot) => {
    dispatch({ type: 'UPDATE_SHOT', payload: { ...row, department: parseDepartmentList(row.department), updatedAt: now() } });
  };

  return (
    <div className="page today-page">
      <TopBar
        title="Today's Dashboard"
        subtitle={todayDisplay}
        stats={[
          { label: 'Due Today', value: todayDeliveries.length, color: 'var(--accent-start)' },
          { label: 'In Progress', value: inProgressShots.length, color: 'var(--color-info)' },
          { label: 'Overdue', value: overdueShots.length, color: 'var(--color-danger)' },
          { label: 'Delivered', value: deliveredToday.length, color: 'var(--color-success)' },
        ]}
      />

      <div className="page-content">
        {/* Hero summary strip */}
        <div className="today-hero">
          <div className="today-hero-card today-hero-deliveries">
            <div className="hero-card-icon"><Rocket size={20} /></div>
            <div className="hero-card-body">
              <span className="hero-card-value">{todayDeliveries.length}</span>
              <span className="hero-card-label">To Deliver Today</span>
            </div>
            <div className="hero-card-shots">
              {todayDeliveries.slice(0, 3).map((s) => (
                <span key={s.id} className="hero-shot-chip">{s.shotName || s.shotNumber}</span>
              ))}
              {todayDeliveries.length > 3 && <span className="hero-shot-chip more">+{todayDeliveries.length - 3}</span>}
            </div>
          </div>

          <div className="today-hero-card today-hero-progress">
            <div className="hero-card-icon"><RefreshCw size={20} /></div>
            <div className="hero-card-body">
              <span className="hero-card-value">{inProgressShots.length}</span>
              <span className="hero-card-label">In Progress Now</span>
            </div>
            <div className="hero-card-shots">
              {inProgressShots.slice(0, 3).map((s) => (
                <span key={s.id} className="hero-shot-chip">{s.shotName || s.shotNumber}</span>
              ))}
              {inProgressShots.length > 3 && <span className="hero-shot-chip more">+{inProgressShots.length - 3}</span>}
            </div>
          </div>

          <div className="today-hero-card today-hero-pending">
            <div className="hero-card-icon"><Hourglass size={20} /></div>
            <div className="hero-card-body">
              <span className="hero-card-value">{pendingShots.length}</span>
              <span className="hero-card-label">Pending Tasks</span>
            </div>
          </div>

          <div className={`today-hero-card today-hero-overdue${overdueShots.length > 0 ? ' has-overdue' : ''}`}>
            <div className="hero-card-icon"><AlertTriangle size={20} /></div>
            <div className="hero-card-body">
              <span className="hero-card-value">{overdueShots.length}</span>
              <span className="hero-card-label">Overdue</span>
            </div>
            {overdueShots.length > 0 && (
              <div className="hero-card-shots">
                {overdueShots.slice(0, 3).map((s) => (
                  <span key={s.id} className="hero-shot-chip overdue">{s.shotName || s.shotNumber}</span>
                ))}
              </div>
            )}
          </div>

          <div className="today-hero-card today-hero-done">
            <div className="hero-card-icon"><CheckCircle2 size={20} /></div>
            <div className="hero-card-body">
              <span className="hero-card-value">{deliveredToday.length}</span>
              <span className="hero-card-label">Delivered Today</span>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="today-section-header">
          <h2 className="today-section-title">📋 Today's Work Queue</h2>
          <span className="today-section-count">{allTodayWork.length} tasks</span>
        </div>

        {/* Main DataGrid — everything needing attention today */}
        <DataGrid<Shot>
          columns={columns}
          data={allTodayWork}
          onRowUpdate={handleRowUpdate}
          onRowDelete={(id) => {
            const shot = state.shots.find((s) => s.id === id);
            dispatch({ type: 'DELETE_SHOT', payload: id });
            showToast(`Shot "${shot?.shotName || shot?.shotNumber}" deleted`, 'error');
          }}
          onBulkDelete={(ids) => {
            dispatch({ type: 'DELETE_SHOTS', payload: ids });
            showToast(`${ids.length} shots deleted`, 'error');
          }}
          emptyMessage="🎉 Nothing due today — you're all caught up!"
        />

        <div className="page-hint">
          💡 <strong>Double-click</strong> any cell to edit • <strong>Mark Delivered</strong> to complete a task • All changes auto-save
        </div>
      </div>
      <NotesModal shot={notesShot} onClose={() => setNotesShot(null)} />
    </div>
  );
}
