import { useMemo, useState } from 'react';
import { useStore, useProjectName, useArtistName, useOverdueShots } from '../store';
import type { Shot, ColumnDef } from '../types';
import { DELIVERY_STATUS_OPTIONS } from '../types';
import { formatDate, daysRemainingText, daysRemainingSeverity, now, today } from '../utils';
import DataGrid from '../components/DataGrid';
import TopBar from '../components/TopBar';
import { DeliveryBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import NotesModal from '../components/NotesModal';

export default function ETAPage() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const getProjectName = useProjectName();
  const getArtistName = useArtistName();
  const overdueShots = useOverdueShots();
  const [notesShot, setNotesShot] = useState<Shot | null>(null);

  const onTrack = useMemo(() => {
    const todayStr = today();
    return state.shots.filter(
      (s) => s.finalDeliveryDate && s.finalDeliveryDate >= todayStr && s.deliveryStatus !== 'delivered'
    ).length;
  }, [state.shots]);

  const delivered = useMemo(() => state.shots.filter((s) => s.deliveryStatus === 'delivered').length, [state.shots]);

  const dueSoon = useMemo(() => {
    const todayStr = today();
    const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    return state.shots.filter(
      (s) => s.finalDeliveryDate && s.finalDeliveryDate >= todayStr && s.finalDeliveryDate <= threeDays && s.deliveryStatus !== 'delivered'
    ).length;
  }, [state.shots]);

  const columns: ColumnDef<Shot>[] = useMemo(() => [
    { key: 'shotNumber', label: 'Shot #', width: 100 },
    { key: 'shotName', label: 'Shot Name', width: 150 },
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
      key: 'projectId', label: 'Project', width: 160,
      render: (row) => <span className="cell-text">{getProjectName(row.projectId)}</span>,
      getValue: (row) => getProjectName(row.projectId),
    },
    {
      key: 'artistId', label: 'Artist', width: 140,
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
      key: 'eta', label: 'ETA Date', width: 120,
      editable: true, type: 'date',
      render: (row) => <span className="cell-text">{formatDate(row.eta)}</span>,
      getValue: (row) => row.eta,
    },
    {
      key: 'finalDeliveryDate', label: 'Final Delivery', width: 130,
      editable: true, type: 'date',
      render: (row) => <span className="cell-text" style={{ fontWeight: 600 }}>{formatDate(row.finalDeliveryDate)}</span>,
      getValue: (row) => row.finalDeliveryDate,
    },
    {
      key: 'deliveryStatus', label: 'Delivery Status', width: 150,
      editable: true, type: 'select',
      options: DELIVERY_STATUS_OPTIONS,
      render: (row) => <DeliveryBadge status={row.deliveryStatus} />,
      getValue: (row) => row.deliveryStatus,
    },
    {
      key: 'daysRemaining', label: 'Time Left', width: 130,
      sortable: true, filterable: false,
      render: (row) => {
        if (row.deliveryStatus === 'delivered') {
          return <span className="days-badge ok">✓ Delivered</span>;
        }
        const severity = daysRemainingSeverity(row.finalDeliveryDate);
        return <span className={`days-badge ${severity}`}>{daysRemainingText(row.finalDeliveryDate)}</span>;
      },
      getValue: (row) => {
        if (row.deliveryStatus === 'delivered') return 'zzz';
        return row.finalDeliveryDate || '';
      },
    },
    {
      key: 'markDelivered', label: '', width: 100,
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
                payload: { ...row, deliveryStatus: 'delivered', finalDeliveryDate: row.finalDeliveryDate || today(), updatedAt: now() },
              });
              showToast(`${row.shotNumber} marked as delivered`, 'success');
            }}
          >
            Mark Delivered
          </button>
        );
      },
    },
  ], [getProjectName, getArtistName, state.artists, dispatch, showToast]);

  const handleRowUpdate = (row: Shot) => {
    dispatch({ type: 'UPDATE_SHOT', payload: { ...row, updatedAt: now() } });
  };

  return (
    <div className="page">
      <TopBar
        title="ETA & Delivery"
        subtitle="Track delivery timelines"
        stats={[
          { label: 'On Track', value: onTrack, color: 'var(--color-success)' },
          { label: 'Due Soon', value: dueSoon, color: 'var(--color-warning)' },
          { label: 'Overdue', value: overdueShots.length, color: 'var(--color-danger)' },
          { label: 'Delivered', value: delivered, color: 'var(--accent-start)' },
        ]}
      />

      <div className="page-content">
        {/* Summary cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)' }}>✓</div>
            <div className="summary-card-data">
              <span className="summary-card-value" style={{ color: 'var(--color-success)' }}>{delivered}</span>
              <span className="summary-card-label">Delivered</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-info)' }}>→</div>
            <div className="summary-card-data">
              <span className="summary-card-value" style={{ color: 'var(--color-info)' }}>{onTrack}</span>
              <span className="summary-card-label">On Track</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)' }}>⚡</div>
            <div className="summary-card-data">
              <span className="summary-card-value" style={{ color: 'var(--color-warning)' }}>{dueSoon}</span>
              <span className="summary-card-label">Due in 3 Days</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-card-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>!</div>
            <div className="summary-card-data">
              <span className="summary-card-value" style={{ color: 'var(--color-danger)' }}>{overdueShots.length}</span>
              <span className="summary-card-label">Overdue</span>
            </div>
          </div>
        </div>

        <DataGrid<Shot>
          columns={columns}
          data={state.shots}
          onRowUpdate={handleRowUpdate}
          emptyMessage="No shots to track"
          showCheckboxes={false}
        />
      </div>
      <NotesModal shot={notesShot} onClose={() => setNotesShot(null)} />
    </div>
  );
}
