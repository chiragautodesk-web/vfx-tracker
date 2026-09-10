import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import Modal from './Modal';
import {
  isLocalhost,
  pushDataToCloud,
  pullDataFromCloud,
  getLastSyncInfo,
  formatSyncTime,
} from '../services/cloudSync';
import { Upload, Download, RefreshCw, Laptop, Globe, ExternalLink } from 'lucide-react';
import './CloudSyncWidget.css';

interface CloudSyncWidgetProps {
  compact?: boolean;
}

export default function CloudSyncWidget({ compact = false }: CloudSyncWidgetProps) {
  const { state, dispatch } = useStore();
  const { showToast } = useToast();

  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const isLocal = isLocalhost();
  const vercelUrl = 'https://vfx-tracker.vercel.app';
  const localUrl = 'http://localhost:5173';

  // Load initial sync metadata
  useEffect(() => {
    const meta = getLastSyncInfo();
    setLastSyncTime(meta.lastTime);
    setLastAction(meta.lastAction);
  }, []);

  const handlePush = async () => {
    if (isPushing || isPulling) return;
    setIsPushing(true);
    try {
      const res = await pushDataToCloud(state);
      if (res.success) {
        setLastSyncTime(res.updatedAt || new Date().toISOString());
        setLastAction(isLocal ? 'Pushed to Vercel' : 'Pushed to Cloud');
        showToast(
          isLocal
            ? `🚀 Successfully pushed ${res.shotsCount} shots to Vercel!`
            : `🚀 Pushed ${res.shotsCount} shots to Cloud!`,
          'success'
        );
      } else {
        showToast(`Sync push error: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Push failed: ${err.message}`, 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    if (isPushing || isPulling) return;
    setIsPulling(true);
    try {
      const res = await pullDataFromCloud();
      if (res.success && res.data) {
        dispatch({
          type: 'REPLACE_STATE',
          payload: res.data,
        });
        setLastSyncTime(res.updatedAt || new Date().toISOString());
        setLastAction(isLocal ? 'Pulled from Vercel' : 'Pulled from Local');
        showToast(
          isLocal
            ? `📥 Synced ${res.shotsCount} shots from Vercel!`
            : `✅ Successfully pulled ${res.shotsCount} shots from Localhost!`,
          'success'
        );
      } else {
        showToast(`Sync pull error: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Pull failed: ${err.message}`, 'error');
    } finally {
      setIsPulling(false);
    }
  };

  const isLoading = isPushing || isPulling;

  return (
    <>
      <div className="cloud-sync-bar">
        {/* Environment Badge & Sync Status */}
        <div
          className="cloud-sync-status-badge"
          onClick={() => setShowModal(true)}
          title="Click to view Cloud Sync details & history"
        >
          <span className={`sync-dot ${isLoading ? 'loading' : isLocal ? 'green' : 'blue'}`} />
          <span>
            {isLocal ? '🏠 Localhost' : '🌐 Vercel Live'} • {formatSyncTime(lastSyncTime)}
          </span>
        </div>

        {/* Primary Action Button */}
        {isLocal ? (
          // ON LOCALHOST: Primary is "Push to Vercel"
          <button
            className="btn-cloud-push"
            onClick={handlePush}
            disabled={isLoading}
            title="Push local shots and state to Vercel Cloud"
          >
            {isPushing ? (
              <>
                <RefreshCw size={13} className="spin" /> Pushing...
              </>
            ) : (
              <>
                <Upload size={13} /> Push to Vercel
              </>
            )}
          </button>
        ) : (
          // ON VERCEL: Primary is "Pull from Localhost"
          <button
            className="btn-cloud-pull"
            onClick={handlePull}
            disabled={isLoading}
            title="Pull latest shots and notes pushed from your laptop/localhost"
          >
            {isPulling ? (
              <>
                <RefreshCw size={13} className="spin" /> Pulling...
              </>
            ) : (
              <>
                <Download size={13} /> Pull from Local
              </>
            )}
          </button>
        )}

        {/* Secondary Opposite Button if not compact */}
        {!compact && (
          isLocal ? (
            <button
              className="btn btn-ghost btn-xs"
              onClick={handlePull}
              disabled={isLoading}
              title="Pull latest updates from Vercel"
              style={{ padding: '5px 8px', fontSize: '11px' }}
            >
              <Download size={12} /> Pull Vercel
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-xs"
              onClick={handlePush}
              disabled={isLoading}
              title="Push changes back to Cloud for Localhost"
              style={{ padding: '5px 8px', fontSize: '11px' }}
            >
              <Upload size={12} /> Push Cloud
            </button>
          )
        )}
      </div>

      {/* Cloud Sync Details Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="☁️ Cloud Sync (Localhost ⇄ Vercel)"
        width="560px"
      >
        <div className="cloud-sync-modal-body">
          {/* Current Environment Banner */}
          <div className="sync-env-banner">
            <div className="sync-env-title">
              {isLocal ? <Laptop size={18} color="#10b981" /> : <Globe size={18} color="#38bdf8" />}
              <span>
                Running Environment:{' '}
                <strong>{isLocal ? 'Localhost (Your Laptop)' : 'Vercel Live Production'}</strong>
              </span>
            </div>
            <span className={`sync-env-pill ${isLocal ? 'local' : 'vercel'}`}>
              {isLocal ? 'Laptop Node' : 'Vercel Cloud'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            ⚡ <strong>Two-way Cloud Bridge Active:</strong> Localhost pe updates karke{' '}
            <strong>Push to Vercel</strong> karein — Vercel par exact same data turant live ho jayega.
            Localhost pe WhatsApp messages send karne ke liye Vercel se{' '}
            <strong>Pull from Vercel</strong> karke data le sakte hain.
          </div>

          {/* Sync Action Cards */}
          <div className="sync-action-cards">
            {/* Push Card */}
            <div className="sync-card">
              <div className="sync-card-title">
                <Upload size={16} color="#10b981" />
                <span>Push to Cloud</span>
              </div>
              <div className="sync-card-desc">
                Current app state ({state.shots.length} shots) ko cloud par upload karega.
              </div>
              <button
                className="btn-cloud-push"
                onClick={handlePush}
                disabled={isLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isPushing ? '⏳ Pushing to Cloud...' : '⬆️ Push to Cloud'}
              </button>
            </div>

            {/* Pull Card */}
            <div className="sync-card">
              <div className="sync-card-title">
                <Download size={16} color="#38bdf8" />
                <span>Pull from Cloud</span>
              </div>
              <div className="sync-card-desc">
                Cloud se latest data download karke is screen par load karega.
              </div>
              <button
                className="btn-cloud-pull"
                onClick={handlePull}
                disabled={isLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isPulling ? '⏳ Pulling from Cloud...' : '⬇️ Pull from Cloud'}
              </button>
            </div>
          </div>

          {/* Stats & Metadata */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Local Shots: </span>
              <strong>{state.shots.length}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Projects: </span>
              <strong>{state.projects.length}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Last Action: </span>
              <strong>{lastAction || 'None'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Last Synced: </span>
              <strong>{formatSyncTime(lastSyncTime)}</strong>
            </div>
          </div>

          {/* Quick Direct Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="sync-links-row">
              <Globe size={15} color="#38bdf8" />
              <span style={{ flex: 1 }}>
                Vercel Live URL:{' '}
                <a
                  href={vercelUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  {vercelUrl}
                </a>
              </span>
              <ExternalLink size={13} color="var(--text-muted)" />
            </div>
            <div className="sync-links-row">
              <Laptop size={15} color="#10b981" />
              <span style={{ flex: 1 }}>
                Laptop Localhost URL:{' '}
                <a
                  href={localUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#10b981', textDecoration: 'underline' }}
                >
                  {localUrl}
                </a>
              </span>
              <ExternalLink size={13} color="var(--text-muted)" />
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
