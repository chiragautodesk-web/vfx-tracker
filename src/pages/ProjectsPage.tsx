import { useState, useMemo } from 'react';
import { useStore } from '../store';
import type { Project, ColumnDef } from '../types';
import { PROJECT_STATUS_OPTIONS } from '../types';
import { generateId, now, formatDate } from '../utils';
import DataGrid from '../components/DataGrid';
import TopBar from '../components/TopBar';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ProjectStatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import DataBackupModal from '../components/DataBackupModal';
import './ProjectsPage.css';

export default function ProjectsPage() {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', client: '', description: '', status: 'active' as Project['status'] });

  const resetForm = () => setForm({ name: '', client: '', description: '', status: 'active' });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const project: Project = {
      id: generateId(),
      name: form.name.trim(),
      client: form.client.trim(),
      description: form.description.trim(),
      status: form.status,
      createdAt: now(),
      updatedAt: now(),
    };
    dispatch({ type: 'ADD_PROJECT', payload: project });
    showToast(`Project "${project.name}" created`);
    setShowAddModal(false);
    resetForm();
  };

  const handleEdit = () => {
    if (!editProject || !form.name.trim()) return;
    const updated: Project = {
      ...editProject,
      name: form.name.trim(),
      client: form.client.trim(),
      description: form.description.trim(),
      status: form.status,
      updatedAt: now(),
    };
    dispatch({ type: 'UPDATE_PROJECT', payload: updated });
    showToast(`Project "${updated.name}" updated`);
    setEditProject(null);
    resetForm();
  };

  const openEdit = (project: Project) => {
    setForm({ name: project.name, client: project.client, description: project.description, status: project.status });
    setEditProject(project);
  };

  const shotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const shot of state.shots) {
      counts[shot.projectId] = (counts[shot.projectId] || 0) + 1;
    }
    return counts;
  }, [state.shots]);

  const columns: ColumnDef<Project>[] = useMemo(() => [
    { key: 'name', label: 'Project Name', width: 200, editable: true, type: 'text' },
    { key: 'client', label: 'Client', width: 160, editable: true, type: 'text' },
    { key: 'description', label: 'Description', width: 260, editable: true, type: 'text' },
    {
      key: 'shotCount',
      label: 'Shots',
      width: 80,
      sortable: true,
      filterable: false,
      render: (row) => (
        <span className="shot-count-badge">{shotCounts[row.id] || 0}</span>
      ),
      getValue: (row) => String(shotCounts[row.id] || 0),
    },
    {
      key: 'status',
      label: 'Status',
      width: 130,
      editable: true,
      type: 'select',
      options: PROJECT_STATUS_OPTIONS,
      render: (row) => <ProjectStatusBadge status={row.status} />,
      getValue: (row) => row.status,
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: 120,
      render: (row) => <span className="cell-text">{formatDate(row.createdAt)}</span>,
      getValue: (row) => row.createdAt,
    },
  ], [shotCounts]);

  const handleRowUpdate = (row: Project) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: { ...row, updatedAt: now() } });
  };

  const handleViewShots = (project: Project) => {
    dispatch({ type: 'SELECT_PROJECT', payload: project.id });
    dispatch({ type: 'SET_TAB', payload: 'shots' });
  };

  return (
    <div className="page projects-page">
      <TopBar
        title="Projects"
        subtitle={`${state.projects.length} total`}
        stats={[
          { label: 'Active', value: state.projects.filter((p) => p.status === 'active').length, color: 'var(--color-success)' },
          { label: 'On Hold', value: state.projects.filter((p) => p.status === 'on-hold').length, color: 'var(--color-warning)' },
          { label: 'Total Shots', value: state.shots.length },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={() => setShowBackupModal(true)}>
              📦 Export Old Data / Start Fresh
            </button>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
              + Add Project
            </button>
          </div>
        }
      />

      <div className="page-content">
        <DataGrid<Project>
          columns={columns}
          data={state.projects}
          onRowUpdate={handleRowUpdate}
          onRowDelete={(id) => setDeleteId(id)}
          onRowClick={(row) => openEdit(row)}
          emptyMessage="No projects yet — click 'Add Project' to get started"
        />

        {/* Quick actions hint */}
        <div className="page-hint">
          💡 <strong>Double-click</strong> any cell to edit inline • <strong>Click</strong> a row to edit details • <strong>Use column headers</strong> to sort
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Project"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!form.name.trim()}>Create Project</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Project Name *</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Dragon Quest VFX" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Client</label>
          <input className="form-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="e.g., Marvel Studios" />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief project description…" />
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}>
            {PROJECT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editProject}
        onClose={() => { setEditProject(null); resetForm(); }}
        title="Edit Project"
        width="600px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => handleViewShots(editProject!)}>View Shots →</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => { setEditProject(null); resetForm(); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={!form.name.trim()}>Save Changes</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Project Name *</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Client</label>
            <input className="form-input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}>
              {PROJECT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {editProject && (
          <div className="project-meta">
            <span>Shots: <strong>{shotCounts[editProject.id] || 0}</strong></span>
            <span>Created: <strong>{formatDate(editProject.createdAt)}</strong></span>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            const proj = state.projects.find((p) => p.id === deleteId);
            dispatch({ type: 'DELETE_PROJECT', payload: deleteId });
            showToast(`Project "${proj?.name}" deleted`, 'error');
          }
        }}
        title="Delete Project"
        message="Are you sure? This will also delete all shots associated with this project. This action cannot be undone."
      />

      <DataBackupModal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} />
    </div>
  );
}
