import { useState, useMemo } from 'react';
import { useStore, useProjectName } from '../store';
import type { Artist, ColumnDef } from '../types';
import { generateId } from '../utils';
import { formatDate } from '../utils';
import DataGrid from '../components/DataGrid';
import TopBar from '../components/TopBar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { StatusBadge, DepartmentBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];

export default function ArtistsPage() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const getProjectName = useProjectName();

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  const emptyForm = { name: '', email: '', role: '' };
  const [form, setForm] = useState(emptyForm);

  // Compute per-artist stats
  const artistStats = useMemo(() => {
    const stats: Record<string, { total: number; inProgress: number; completed: number; pending: number }> = {};
    for (const artist of state.artists) {
      const shots = state.shots.filter((s) => s.artistIds && s.artistIds.includes(artist.id));
      stats[artist.id] = {
        total: shots.length,
        inProgress: shots.filter((s) => s.status === 'in-progress' || s.status === 'wip').length,
        completed: shots.filter((s) => s.status === 'delivered' || s.status === 'approved').length,
        pending: shots.filter((s) => s.status === 'pending').length,
      };
    }
    return stats;
  }, [state.artists, state.shots]);

  const columns: ColumnDef<Artist>[] = useMemo(() => [
    {
      key: 'name', label: 'Artist Name', width: 200,
      editable: true, type: 'text',
      render: (row) => (
        <span className="artist-chip">
          <span className="artist-avatar" style={{ background: row.avatarColor }}>{row.name.charAt(0)}</span>
          <strong>{row.name}</strong>
        </span>
      ),
    },
    { key: 'role', label: 'Role', width: 150, editable: true, type: 'text' },
    { key: 'email', label: 'Email', width: 200, editable: true, type: 'text' },
    {
      key: 'total', label: 'Assigned', width: 90,
      sortable: true, filterable: false,
      render: (row) => (
        <span className="shot-count-badge">{artistStats[row.id]?.total ?? 0}</span>
      ),
      getValue: (row) => String(artistStats[row.id]?.total ?? 0),
    },
    {
      key: 'inProgress', label: 'In Progress', width: 100,
      sortable: true, filterable: false,
      render: (row) => {
        const val = artistStats[row.id]?.inProgress ?? 0;
        return <span style={{ color: val > 0 ? 'var(--color-info)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}</span>;
      },
      getValue: (row) => String(artistStats[row.id]?.inProgress ?? 0),
    },
    {
      key: 'completed', label: 'Completed', width: 100,
      sortable: true, filterable: false,
      render: (row) => {
        const val = artistStats[row.id]?.completed ?? 0;
        return <span style={{ color: val > 0 ? 'var(--color-success)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}</span>;
      },
      getValue: (row) => String(artistStats[row.id]?.completed ?? 0),
    },
    {
      key: 'pending', label: 'Pending', width: 90,
      sortable: true, filterable: false,
      render: (row) => {
        const val = artistStats[row.id]?.pending ?? 0;
        return <span style={{ color: val > 0 ? 'var(--color-warning)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}</span>;
      },
      getValue: (row) => String(artistStats[row.id]?.pending ?? 0),
    },
  ], [artistStats]);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const artist: Artist = {
      id: generateId(),
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim() || 'Artist',
      avatarColor: AVATAR_COLORS[state.artists.length % AVATAR_COLORS.length],
    };
    dispatch({ type: 'ADD_ARTIST', payload: artist });
    showToast(`Artist "${artist.name}" added`);
    setShowAddModal(false);
    setForm(emptyForm);
  };

  const handleRowUpdate = (row: Artist) => {
    dispatch({ type: 'UPDATE_ARTIST', payload: row });
  };

  const artistShots = useMemo(() => {
    if (!expandedArtist) return [];
    return state.shots.filter((s) => s.artistIds && s.artistIds.includes(expandedArtist));
  }, [expandedArtist, state.shots]);

  return (
    <div className="page">
      <TopBar
        title="Artists"
        subtitle={`${state.artists.length} team members`}
        stats={[
          { label: 'Total Artists', value: state.artists.length },
          { label: 'Active Shots', value: state.shots.filter((s) => s.status !== 'delivered').length, color: 'var(--color-info)' },
        ]}
        actions={
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowAddModal(true); }}>
            + Add Artist
          </button>
        }
      />

      <div className="page-content">
        <DataGrid<Artist>
          columns={columns}
          data={state.artists}
          onRowUpdate={handleRowUpdate}
          onRowDelete={(id) => setDeleteId(id)}
          onRowClick={(row) => setExpandedArtist(expandedArtist === row.id ? null : row.id)}
          emptyMessage="No artists yet — click 'Add Artist' to get started"
        />

        {/* Expanded artist detail */}
        {expandedArtist && (
          <div className="artist-shots-detail animate-slide-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>
                Assigned Shots — {state.artists.find((a) => a.id === expandedArtist)?.name}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setExpandedArtist(null)}>Close ✕</button>
            </div>
            {artistShots.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No shots assigned</p>
            ) : (
              <div className="artist-shots-grid">
                {artistShots.map((shot) => (
                  <div key={shot.id} className="artist-shot-card">
                    <div className="artist-shot-card-header">
                      <span className="artist-shot-name">{shot.shotName || shot.shotNumber}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {shot.department && <DepartmentBadge department={shot.department} />}
                        <StatusBadge status={shot.status} />
                      </div>
                    </div>
                    <span className="artist-shot-project">
                      {getProjectName(shot.projectId)}
                      {shot.scopeOfWork ? ` • ${shot.scopeOfWork}` : ''}
                    </span>
                    <div className="artist-shot-meta">
                      <span>ETA: {formatDate(shot.eta)}</span>
                      <span>Delivery: {formatDate(shot.finalDeliveryDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="page-hint">
          💡 <strong>Click</strong> an artist row to see their assigned shots
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Artist"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!form.name.trim()}>Add Artist</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., John Doe" autoFocus />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Role</label>
            <input className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g., Compositor" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g., john@studio.com" />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            const artist = state.artists.find((a) => a.id === deleteId);
            dispatch({ type: 'DELETE_ARTIST', payload: deleteId });
            showToast(`Artist "${artist?.name}" removed`, 'error');
          }
        }}
        title="Remove Artist"
        message="Are you sure? Shots assigned to this artist will become unassigned."
      />
    </div>
  );
}
