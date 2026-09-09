import { useState } from 'react';
import { useStore } from '../store';
import Modal from './Modal';
import { exportFullBackupToExcel, downloadJSON, today } from '../utils';
import { useToast } from './Toast';
import { Download, RefreshCw, FileSpreadsheet, FileJson, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './DataBackupModal.css';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DataBackupModal({ isOpen, onClose }: DataBackupModalProps) {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'export' | 'reset'>('export');
  const [newProjectName, setNewProjectName] = useState('');
  const [hasExported, setHasExported] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleExportExcel = () => {
    try {
      exportFullBackupToExcel(state.projects, state.shots, state.artists);
      setHasExported(true);
      showToast('Exported complete data to Excel (.xlsx)', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export Excel file', 'error');
    }
  };

  const handleExportJSON = () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '2.2.0',
        projects: state.projects,
        shots: state.shots,
        artists: state.artists,
      };
      downloadJSON(backupData, `VFX_Tracker_Backup_${today()}.json`);
      setHasExported(true);
      showToast('Exported full JSON backup', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to export JSON backup', 'error');
    }
  };

  const handleStartFresh = () => {
    // 1. Trigger export if not already done
    if (!hasExported) {
      exportFullBackupToExcel(state.projects, state.shots, state.artists);
    }

    // 2. Dispatch reset
    dispatch({
      type: 'RESET_FOR_NEW_PROJECT',
      payload: { newProjectName: newProjectName.trim() || 'New VFX Project' },
    });

    showToast(`Old data archived. Started fresh: "${newProjectName.trim() || 'New VFX Project'}"`, 'success');
    onClose();
    setConfirmReset(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Backup & Fresh Project Setup"
      width="580px"
    >
      <div className="backup-modal-container">
        {/* Tab switcher */}
        <div className="backup-tabs">
          <button
            className={`backup-tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={16} /> Export Old Data
          </button>
          <button
            className={`backup-tab-btn ${activeTab === 'reset' ? 'active' : ''}`}
            onClick={() => setActiveTab('reset')}
          >
            <RefreshCw size={16} /> Start Fresh (New Project)
          </button>
        </div>

        {activeTab === 'export' ? (
          <div className="backup-section">
            <p className="backup-desc">
              Download a complete archive of your current projects, shots, departments, and artist assignments.
            </p>

            <div className="backup-stats-pill">
              <span><strong>{state.projects.length}</strong> Projects</span>
              <span>•</span>
              <span><strong>{state.shots.length}</strong> Shots</span>
              <span>•</span>
              <span><strong>{state.artists.length}</strong> Artists</span>
            </div>

            <div className="backup-cards-grid">
              <div className="backup-card" onClick={handleExportExcel}>
                <div className="backup-card-icon excel">
                  <FileSpreadsheet size={28} />
                </div>
                <div className="backup-card-info">
                  <div className="backup-card-title">Export as Excel (.xlsx)</div>
                  <div className="backup-card-desc">Multi-sheet workbook with Shots, Scope, Departments & Projects.</div>
                </div>
                <button className="btn btn-secondary btn-sm">Download</button>
              </div>

              <div className="backup-card" onClick={handleExportJSON}>
                <div className="backup-card-icon json">
                  <FileJson size={28} />
                </div>
                <div className="backup-card-info">
                  <div className="backup-card-title">Export Raw JSON Backup</div>
                  <div className="backup-card-desc">Full machine-readable backup snapshot.</div>
                </div>
                <button className="btn btn-secondary btn-sm">Download</button>
              </div>
            </div>

            {hasExported && (
              <div className="backup-success-banner">
                <CheckCircle2 size={18} color="var(--color-success)" />
                <span>Backup downloaded successfully! Your old data is safe.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="backup-section">
            <div className="backup-warning-banner">
              <AlertTriangle size={20} color="var(--color-warning)" />
              <div>
                <strong>Starting a new project?</strong>
                <p>
                  This will archive your current shots and configure a clean slate for your new project.
                  Existing artists and an internal snapshot will be preserved.
                </p>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
              <label className="form-label">New Project Name</label>
              <input
                className="form-input"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., Avatar 3 VFX / Commercial Seq 01"
                autoFocus
              />
            </div>

            {!confirmReset ? (
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setConfirmReset(true)}
                >
                  <RefreshCw size={16} /> Proceed to Fresh Start
                </button>
              </div>
            ) : (
              <div className="backup-confirm-box">
                <p>
                  Click below to <strong>automatically download your backup</strong> and initialize the fresh workspace:
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={handleStartFresh}
                  >
                    <Download size={16} /> Download Backup & Reset Workspace
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setConfirmReset(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
