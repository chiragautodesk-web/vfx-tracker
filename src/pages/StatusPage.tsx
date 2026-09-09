import { useState, useMemo } from 'react';
import { useStore, useProjectName, useArtistNames, useStatusCounts } from '../store';
import type { Shot, ColumnDef, ClientFeedback } from '../types';
import { STATUS_OPTIONS, DEPARTMENT_OPTIONS } from '../types';
import { formatDate, generateId, now, parseDepartmentList } from '../utils';
import DataGrid from '../components/DataGrid';
import TopBar from '../components/TopBar';
import Modal from '../components/Modal';
import { StatusBadge, DepartmentBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import NotesModal from '../components/NotesModal';

export default function StatusPage() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const getProjectName = useProjectName();
  const getArtistNames = useArtistNames();
  const statusCounts = useStatusCounts();

  const [filterStatus, setFilterStatus] = useState<string>('');
  const [feedbackShot, setFeedbackShot] = useState<Shot | null>(null);
  const [notesShot, setNotesShot] = useState<Shot | null>(null);
  const [fbForm, setFbForm] = useState({ note: '', type: 'feedback' as ClientFeedback['type'] });

  const filteredShots = useMemo(() => {
    if (!filterStatus) return state.shots;
    return state.shots.filter((s) => s.status === filterStatus);
  }, [state.shots, filterStatus]);

  const columns: ColumnDef<Shot>[] = useMemo(() => [
    {
      key: 'shotName',
      label: 'Shot Name',
      width: 160,
      render: (row) => <span className="cell-text" style={{ fontWeight: 600 }}>{row.shotName || row.shotNumber}</span>,
      getValue: (row) => row.shotName || row.shotNumber || '',
    },
    {
      key: 'scopeOfWork',
      label: 'Scope of Work',
      width: 200,
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
      key: 'projectId', label: 'Project', width: 160,
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
      key: 'status', label: 'Current Status', width: 180,
      editable: true, type: 'select',
      options: STATUS_OPTIONS,
      render: (row) => <StatusBadge status={row.status} />,
      getValue: (row) => row.status,
    },
    {
      key: 'feedback', label: 'Client Feedback', width: 220,
      sortable: false, filterable: false,
      render: (row) => {
        const latest = row.clientFeedback[row.clientFeedback.length - 1];
        return (
          <button
            className="btn btn-ghost btn-sm"
            style={{ justifyContent: 'flex-start', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
            onClick={(e) => { e.stopPropagation(); setFeedbackShot(row); }}
          >
            {latest
              ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{latest.note}</span>
              : <span style={{ color: 'var(--text-muted)' }}>+ Add feedback</span>
            }
          </button>
        );
      },
    },
    {
      key: 'updatedAt', label: 'Last Updated', width: 120,
      render: (row) => <span className="cell-text">{formatDate(row.updatedAt)}</span>,
      getValue: (row) => row.updatedAt,
    },
  ], [getProjectName, getArtistNames, state.artists]);

  const handleRowUpdate = (row: Shot) => {
    dispatch({ type: 'UPDATE_SHOT', payload: { ...row, department: parseDepartmentList(row.department), updatedAt: now() } });
  };

  const handleAddFeedback = () => {
    if (!feedbackShot || !fbForm.note.trim()) return;
    const fb: ClientFeedback = {
      id: generateId(),
      shotId: feedbackShot.id,
      date: new Date().toISOString().split('T')[0],
      note: fbForm.note.trim(),
      type: fbForm.type,
    };
    dispatch({ type: 'ADD_FEEDBACK', payload: fb });
    showToast('Feedback added');
    setFbForm({ note: '', type: 'feedback' });
  };

  const feedbackTypeColor: Record<string, string> = {
    kickback: 'var(--color-danger)',
    modification: 'var(--color-warning)',
    feedback: 'var(--color-info)',
  };

  return (
    <div className="page">
      <TopBar
        title="Status Overview"
        subtitle={`${state.shots.length} total shots`}
        actions={
          <div className="page-filters" style={{ marginLeft: 0 }}>
            <label>Filter:</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        }
      />

      <div className="page-content">
        {/* Status summary cards */}
        <div className="summary-cards">
          {STATUS_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className="summary-card"
              style={{ cursor: 'pointer', borderColor: filterStatus === opt.value ? opt.color : undefined }}
              onClick={() => setFilterStatus(filterStatus === opt.value ? '' : opt.value)}
            >
              <div
                className="summary-card-icon"
                style={{ background: `${opt.color}18`, color: opt.color }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, display: 'block' }} />
              </div>
              <div className="summary-card-data">
                <span className="summary-card-value" style={{ color: opt.color }}>
                  {statusCounts[opt.value] || 0}
                </span>
                <span className="summary-card-label">{opt.label}</span>
              </div>
            </div>
          ))}
        </div>

        <DataGrid<Shot>
          columns={columns}
          data={filteredShots}
          onRowUpdate={handleRowUpdate}
          onRowClick={(row) => setFeedbackShot(row)}
          emptyMessage="No shots with this status"
          showCheckboxes={false}
        />
      </div>

      {/* Feedback Modal */}
      <Modal
        isOpen={!!feedbackShot}
        onClose={() => { setFeedbackShot(null); setFbForm({ note: '', type: 'feedback' }); }}
        title={`Feedback — ${feedbackShot?.shotName || feedbackShot?.shotNumber || ''}`}
        width="600px"
        footer={
          <button className="btn btn-secondary" onClick={() => setFeedbackShot(null)}>Close</button>
        }
      >
        {feedbackShot && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <StatusBadge status={feedbackShot.status} />
              <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                {getProjectName(feedbackShot.projectId)} • {getArtistNames(feedbackShot.artistIds)}
              </span>
            </div>

            {/* Existing feedback */}
            {feedbackShot.clientFeedback.length > 0 ? (
              <div className="feedback-list">
                {[...feedbackShot.clientFeedback].reverse().map((fb) => (
                  <div key={fb.id} className="feedback-item">
                    <div className="feedback-item-header">
                      <span className="feedback-type" style={{ color: feedbackTypeColor[fb.type] }}>
                        {fb.type}
                      </span>
                      <span className="feedback-date">{formatDate(fb.date)}</span>
                    </div>
                    <p className="feedback-note">{fb.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-4)' }}>
                No feedback yet
              </p>
            )}

            {/* Add new feedback */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Add New Feedback</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={fbForm.note}
                    onChange={(e) => setFbForm({ ...fbForm, note: e.target.value })}
                    placeholder="Enter client feedback, kickback, or modification notes…"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                <select className="form-input" style={{ width: 'auto' }} value={fbForm.type} onChange={(e) => setFbForm({ ...fbForm, type: e.target.value as ClientFeedback['type'] })}>
                  <option value="feedback">Feedback</option>
                  <option value="kickback">Kickback</option>
                  <option value="modification">Modification</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleAddFeedback} disabled={!fbForm.note.trim()}>
                  Submit Feedback
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      <NotesModal shot={notesShot} onClose={() => setNotesShot(null)} />
    </div>
  );
}
