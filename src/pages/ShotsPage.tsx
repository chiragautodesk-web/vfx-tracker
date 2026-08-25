import { useState, useMemo } from 'react';
import { useStore, useProjectName, useArtistNames } from '../store';
import type { Shot, ColumnDef, ShotStatus, DeliveryStatus, Priority } from '../types';
import { STATUS_OPTIONS, DELIVERY_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../types';
import { generateId, now, formatDate } from '../utils';
import DataGrid from '../components/DataGrid';
import TopBar from '../components/TopBar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { StatusBadge, DeliveryBadge, PriorityBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import ExcelSyncModal from '../components/ExcelSyncModal';
import NotesModal from '../components/NotesModal';

export default function ShotsPage() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const getProjectName = useProjectName();
  const getArtistNames = useArtistNames();

  const [filterProjectId, setFilterProjectId] = useState<string>(state.selectedProjectId || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notesShot, setNotesShot] = useState<Shot | null>(null);

  const emptyForm = {
    shotNumber: '', shotName: '', description: '', notes: '',
    projectId: state.selectedProjectId || (state.projects[0]?.id ?? ''),
    artistIds: [] as string[],
    status: 'pending' as ShotStatus,
    priority: 'medium' as Priority,
    eta: '', finalDeliveryDate: '',
    deliveryStatus: 'pending' as DeliveryStatus,
  };

  const [form, setForm] = useState(emptyForm);

  const filteredShots = useMemo(() => {
    if (!filterProjectId) return state.shots;
    return state.shots.filter((s) => s.projectId === filterProjectId);
  }, [state.shots, filterProjectId]);

  const columns: ColumnDef<Shot>[] = useMemo(() => [
    { key: 'shotNumber', label: 'Shot #', width: 100, editable: true, type: 'text' },
    { key: 'shotName', label: 'Shot Name', width: 160, editable: true, type: 'text' },
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
      editable: true, type: 'select',
      options: state.projects.map((p) => ({ value: p.id, label: p.name })),
      render: (row) => <span className="cell-text">{getProjectName(row.projectId)}</span>,
      getValue: (row) => getProjectName(row.projectId),
    },
    {
      key: 'artistIds', label: 'Artist', width: 150,
      editable: false,
      type: 'text',
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
      key: 'status', label: 'Status', width: 170,
      editable: true, type: 'select',
      options: STATUS_OPTIONS,
      render: (row) => <StatusBadge status={row.status} />,
      getValue: (row) => row.status,
    },
    {
      key: 'priority', label: 'Priority', width: 100,
      editable: true, type: 'select',
      options: PRIORITY_OPTIONS,
      render: (row) => <PriorityBadge priority={row.priority} />,
      getValue: (row) => row.priority,
    },
    {
      key: 'eta', label: 'ETA', width: 120,
      editable: true, type: 'date',
      render: (row) => <span className="cell-text">{formatDate(row.eta)}</span>,
      getValue: (row) => row.eta,
    },
    {
      key: 'deliveryStatus', label: 'Delivery', width: 140,
      editable: true, type: 'select',
      options: DELIVERY_STATUS_OPTIONS,
      render: (row) => <DeliveryBadge status={row.deliveryStatus} />,
      getValue: (row) => row.deliveryStatus,
    },
    {
      key: 'finalDeliveryDate', label: 'Final Date', width: 120,
      editable: true, type: 'date',
      render: (row) => <span className="cell-text">{formatDate(row.finalDeliveryDate)}</span>,
      getValue: (row) => row.finalDeliveryDate,
    },
  ], [state.projects, state.artists, getProjectName, getArtistNames]);

  const handleAdd = () => {
    if (!form.shotNumber.trim() || !form.projectId) return;
    const shot: Shot = {
      id: generateId(),
      projectId: form.projectId,
      shotNumber: form.shotNumber.trim(),
      shotName: form.shotName.trim(),
      description: form.description.trim(),
      notes: form.notes?.trim() || '',
      artistIds: form.artistIds,
      status: form.status,
      priority: form.priority,
      eta: form.eta,
      finalDeliveryDate: form.finalDeliveryDate,
      deliveryStatus: form.deliveryStatus,
      clientFeedback: [],
      createdAt: now(),
      updatedAt: now(),
    };
    dispatch({ type: 'ADD_SHOT', payload: shot });
    showToast(`Shot "${shot.shotNumber}" added`);
    setShowAddModal(false);
    setForm(emptyForm);
  };

  const handleRowUpdate = (row: Shot) => {
    dispatch({ type: 'UPDATE_SHOT', payload: { ...row, updatedAt: now() } });
  };

  return (
    <div className="page">
      <TopBar
        title="Shots"
        subtitle={`${filteredShots.length} shot${filteredShots.length !== 1 ? 's' : ''}`}
        stats={[
          { label: 'In Progress', value: filteredShots.filter((s) => s.status === 'in-progress' || s.status === 'wip').length, color: 'var(--color-info)' },
          { label: 'Delivered', value: filteredShots.filter((s) => s.deliveryStatus === 'delivered').length, color: 'var(--color-success)' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {filterProjectId && (
              <button className="btn btn-secondary" onClick={() => setShowSyncModal(true)}>
                🔄 Sync / Update from Excel
              </button>
            )}
            <button className="btn btn-primary" onClick={() => { setForm({ ...emptyForm, projectId: filterProjectId || emptyForm.projectId }); setShowAddModal(true); }}>
              + Add Shot
            </button>
          </div>
        }
      />

      <div className="page-content">
        {/* Project filter */}
        <div className="page-filters">
          <label>Project:</label>
          <select value={filterProjectId} onChange={(e) => { setFilterProjectId(e.target.value); dispatch({ type: 'SELECT_PROJECT', payload: e.target.value || null }); }}>
            <option value="">All Projects</option>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {filterProjectId && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterProjectId(''); dispatch({ type: 'SELECT_PROJECT', payload: null }); }}>
              Clear
            </button>
          )}
        </div>

        <DataGrid<Shot>
          columns={columns}
          data={filteredShots}
          onRowUpdate={handleRowUpdate}
          onRowDelete={(id) => setDeleteId(id)}
          onBulkDelete={(ids) => { dispatch({ type: 'DELETE_SHOTS', payload: ids }); showToast(`${ids.length} shots deleted`, 'error'); }}
          emptyMessage="No shots found — click 'Add Shot' to create one"
        />

        <div className="page-hint">
          💡 <strong>Double-click</strong> any cell to edit inline • Use <strong>column filters</strong> to search
        </div>
      </div>

      {/* Add Shot Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Shot"
        width="620px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!form.shotNumber.trim() || !form.projectId}>Add Shot</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Shot Number *</label>
            <input className="form-input" value={form.shotNumber} onChange={(e) => setForm({ ...form, shotNumber: e.target.value })} placeholder="e.g., DQ_050" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Shot Name</label>
            <input className="form-input" value={form.shotName} onChange={(e) => setForm({ ...form, shotName: e.target.value })} placeholder="e.g., Dragon Chase" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Project *</label>
            <select className="form-input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">Select project…</option>
              {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Artists</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', maxHeight: '120px', overflowY: 'auto' }}>
              {state.artists.map((a) => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.artistIds.includes(a.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, artistIds: [...form.artistIds, a.id] });
                      } else {
                        setForm({ ...form, artistIds: form.artistIds.filter(id => id !== a.id) });
                      }
                    }}
                  />
                  <span className="artist-chip" style={{ margin: 0 }}>
                    <span className="artist-avatar" style={{ background: a.avatarColor }}>{a.name.charAt(0)}</span>
                    {a.name}
                  </span>
                </label>
              ))}
              {state.artists.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No artists available</span>}
            </div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ShotStatus })}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ETA Date</label>
            <input className="form-input" type="date" value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Final Delivery Date</label>
            <input className="form-input" type="date" value={form.finalDeliveryDate} onChange={(e) => setForm({ ...form, finalDeliveryDate: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description…" />
        </div>
        <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Detail wise description exactly what to do..." />
        </div>
      </Modal>

      {/* Excel Sync Modal */}
      {filterProjectId && (
        <ExcelSyncModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          project={state.projects.find(p => p.id === filterProjectId)!}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            const shot = state.shots.find((s) => s.id === deleteId);
            dispatch({ type: 'DELETE_SHOT', payload: deleteId });
            showToast(`Shot "${shot?.shotNumber}" deleted`, 'error');
          }
        }}
        title="Delete Shot"
        message="Are you sure you want to delete this shot? This action cannot be undone."
      />

      <NotesModal shot={notesShot} onClose={() => setNotesShot(null)} />
    </div>
  );
}
