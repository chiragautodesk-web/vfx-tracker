import { useMemo } from 'react';
import {
  useStore,
  useProjectName,
  useArtistName,
  useTodayShots,
  useTodayDeliveries,
  useInProgressShots,
  usePendingShots,
  useOverdueShots,
} from '../store';
import type { Shot, ColumnDef } from '../types';
import { STATUS_OPTIONS, DELIVERY_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../types';
import { formatDate, now, today, daysRemainingText, daysRemainingSeverity } from '../utils';
import DataGrid from '../components/DataGrid';
import TopBar from '../components/TopBar';
import { StatusBadge, DeliveryBadge, PriorityBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { Rocket, RefreshCw, Hourglass, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './TodayPage.css';
import NotesModal from '../components/NotesModal';

export default function TodayPage() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const getProjectName = useProjectName();
  const getArtistName = useArtistName();
  const [notesShot, setNotesShot] = useState<Shot | null>(null);

  const todayShots = useTodayShots();
  const todayDeliveries = useTodayDeliveries();
  const inProgressShots = useInProgressShots();
  const pendingShots = usePendingShots();
  const overdueShots = useOverdueShots();

  const todayStr = today();
  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // All shots that need attention today: due today + in progress + overdue
  const allTodayWork = useMemo(() => {
    const ids = new Set<string>();
    const combined: Shot[] = [];
    const addShot = (s: Shot) => {
      if (!ids.has(s.id)) {
        ids.add(s.id);
        combined.push(s);
      }
    };
    // Priority order: overdue first, then today deliveries, then in-progress, then today ETA
    overdueShots.forEach(addShot);
    todayDeliveries.forEach(addShot);
    todayShots.forEach(addShot);
    inProgressShots.forEach(addShot);
    return combined;
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
    { key: 'shotNumber', label: 'Shot #', width: 100, editable: true, type: 'text' },
    { key: 'shotName', label: 'Shot Name', width: 150, editable: true, type: 'text' },
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
      key: 'artistId', label: 'Artist', width: 140,
      editable: true, type: 'select',
      options: [{ value: '', label: 'Unassigned' }, ...state.artists.map((a) => ({ value: a.id, label: a.name }))],
      render: (row) => {
        const artist = state.artists.find((a) => a.id === row.artistId);
        if (!artist) return <span className="cell-text" style={{ color: 'var(--text-muted)' }}>Unassigned</span>;
        return (
          <span className="artist-chip">
            <span className="artist-avatar" style={{ background: artist.avatarColor }}>{artist.name.charAt(0)}</span>
            {artist.name}
          </span>
        );
      },
      getValue: (row) => getArtistName(row.artistId),
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
              showToast(`${row.shotNumber} marked delivered ✓`);
            }}
          >
            Mark Delivered
          </button>
        );
      },
    },
  ], [state.projects, state.artists, getProjectName, getArtistName, dispatch, showToast, todayStr]);

  const handleRowUpdate = (row: Shot) => {
    dispatch({ type: 'UPDATE_SHOT', payload: { ...row, updatedAt: now() } });
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
                <span key={s.id} className="hero-shot-chip">{s.shotNumber}</span>
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
                <span key={s.id} className="hero-shot-chip">{s.shotNumber}</span>
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
                  <span key={s.id} className="hero-shot-chip overdue">{s.shotNumber}</span>
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
            showToast(`Shot "${shot?.shotNumber}" deleted`, 'error');
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
