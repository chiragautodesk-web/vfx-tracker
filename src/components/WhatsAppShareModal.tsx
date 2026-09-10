import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import type { Shot } from '../types';
import { useProjectName, useArtistNames } from '../store';
import { getStatusLabel, getPriorityLabel, formatDepartments, formatDate } from '../utils';
import {
  type FormatStyle,
  type MessageFieldKey,
  type ShotMessageData,
  MESSAGE_FIELD_OPTIONS,
  formatCustomSimpleNotes,
  formatCustomExecutiveCard,
  formatCustomStudioGrid,
} from '../utils/whatsappFormatter';
import './WhatsAppShareModal.css';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shots: Shot[];
  projectName?: string;
}

interface SavedContact {
  phone: string;
  name?: string;
}

const STORAGE_KEY_RECENTS = 'vfx_recent_whatsapp_recipients';
const STORAGE_KEY_LAST_CODE = 'vfx_last_whatsapp_country_code';
const STORAGE_KEY_FIELDS = 'vfx_whatsapp_selected_fields';

const DEFAULT_FIELDS: Record<MessageFieldKey, boolean> = {
  shotName: true,
  notes: true,
  scopeOfWork: false,
  department: false,
  project: false,
  artist: false,
  status: false,
  priority: false,
  eta: false,
};

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  shots,
  projectName,
}: WhatsAppShareModalProps) {
  const { showToast } = useToast();
  const getProjectName = useProjectName();
  const getArtistNames = useArtistNames();

  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [formatMode, setFormatMode] = useState<FormatStyle>('simple');
  const [recents, setRecents] = useState<SavedContact[]>([]);
  const [shotSearch, setShotSearch] = useState('');

  // Field customization state (defaults to shotName + notes)
  const [selectedFields, setSelectedFields] = useState<Record<MessageFieldKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FIELDS);
      if (saved) {
        return { ...DEFAULT_FIELDS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_FIELDS;
  });

  const toggleField = (key: MessageFieldKey) => {
    setSelectedFields((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY_FIELDS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setAllFields = (val: boolean) => {
    const next: Record<MessageFieldKey, boolean> = {
      shotName: true,
      scopeOfWork: val,
      department: val,
      notes: val,
      project: val,
      artist: val,
      status: val,
      priority: val,
      eta: val,
    };
    setSelectedFields(next);
    try {
      localStorage.setItem(STORAGE_KEY_FIELDS, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const resetFieldsToDefault = () => {
    setSelectedFields(DEFAULT_FIELDS);
    try {
      localStorage.setItem(STORAGE_KEY_FIELDS, JSON.stringify(DEFAULT_FIELDS));
    } catch {
      // ignore
    }
  };

  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const API_BASE = (import.meta.env.VITE_WHATSAPP_API_URL || '').replace(/\/$/, '');
  const hasApiServer = isLocalhost || Boolean(API_BASE);

  // WhatsApp In-App Backend State
  const [backendStatus, setBackendStatus] = useState<
    'checking' | 'connected' | 'qr_ready' | 'connecting' | 'disconnected' | 'offline'
  >(hasApiServer ? 'checking' : 'offline');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showQrCodeBox, setShowQrCodeBox] = useState(true);
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const pollingRef = useRef<any>(null);

  // Load recents & last country code
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENTS);
      if (saved) setRecents(JSON.parse(saved));
      const savedCode = localStorage.getItem(STORAGE_KEY_LAST_CODE);
      if (savedCode) setCountryCode(savedCode);
    } catch {
      // ignore
    }
  }, []);

  // When shots prop changes or modal opens, select all provided shots
  useEffect(() => {
    if (isOpen && shots.length > 0) {
      setSelectedShotIds(new Set(shots.map((s) => s.id)));
    }
  }, [isOpen, shots]);

  // Check and poll WhatsApp connection status
  const checkWhatsAppStatus = async () => {
    if (!hasApiServer) {
      setBackendStatus('offline');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      if (!res.ok) {
        setBackendStatus('offline');
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setBackendStatus('offline');
        return;
      }
      const data = await res.json();
      setBackendStatus(data.status || 'disconnected');
      if (data.qrCode) {
        setQrCodeData(data.qrCode);
      }
      setUserPhone(data.userPhone || null);
      setUserName(data.userName || null);

      if (data.status === 'connected') {
        setShowQrCodeBox(false);
      } else {
        setShowQrCodeBox(true);
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    if (isOpen && hasApiServer) {
      checkWhatsAppStatus();
      pollingRef.current = setInterval(() => {
        if (backendStatus !== 'offline') {
          checkWhatsAppStatus();
        }
      }, 2500);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen, backendStatus, hasApiServer]);

  // Reconnect / generate fresh QR
  const handleReconnect = async () => {
    if (isReconnecting) return;
    setIsReconnecting(true);
    try {
      setBackendStatus('connecting');
      const res = await fetch(`${API_BASE}/api/whatsapp/reconnect`, { method: 'POST' });
      const text = await res.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          setBackendStatus(data.status || 'connecting');
          if (data.qrCode) {
            setQrCodeData(data.qrCode);
          }
        } catch {
          // ignore parse error
        }
      }
      showToast('Refreshing WhatsApp QR Code...', 'info');
      setTimeout(checkWhatsAppStatus, 1500);
    } catch {
      showToast('Refreshing QR Code...', 'info');
      checkWhatsAppStatus();
    } finally {
      setIsReconnecting(false);
    }
  };

  // Logout WhatsApp
  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/logout`, { method: 'POST' });
      await res.json();
      setBackendStatus('disconnected');
      setQrCodeData(null);
      setUserPhone(null);
      setUserName(null);
      setShowQrCodeBox(true);
      showToast('WhatsApp logged out successfully', 'info');
      checkWhatsAppStatus();
    } catch (err: any) {
      showToast('Logout error: ' + err.message, 'error');
    }
  };

  // Handle phone input change with auto country code detection
  const handlePhoneChange = (val: string) => {
    let clean = val.replace(/[^\d+]/g, '');
    if (clean.startsWith('+')) {
      if (clean.startsWith('+91') && clean.length > 3) {
        setCountryCode('+91');
        setPhoneNumber(clean.slice(3));
        return;
      } else if (clean.startsWith('+1') && clean.length > 2) {
        setCountryCode('+1');
        setPhoneNumber(clean.slice(2));
        return;
      } else if (clean.startsWith('+44') && clean.length > 3) {
        setCountryCode('+44');
        setPhoneNumber(clean.slice(3));
        return;
      } else if (clean.startsWith('+971') && clean.length > 4) {
        setCountryCode('+971');
        setPhoneNumber(clean.slice(4));
        return;
      }
    }
    if (clean.startsWith('0') && clean.length === 11) {
      clean = clean.slice(1);
    }
    setPhoneNumber(clean);
  };

  // Clean full number for WhatsApp JID/URL
  const fullCleanNumber = useMemo(() => {
    const raw = (phoneNumber || '').replace(/\D/g, '');
    if (!raw) return '';
    const codeDigits = countryCode.replace(/\D/g, '');
    if (raw.startsWith(codeDigits) && raw.length > codeDigits.length + 6) {
      return raw;
    }
    return `${codeDigits}${raw}`;
  }, [countryCode, phoneNumber]);

  // Selected shots
  const selectedShots = useMemo(() => {
    return shots.filter((s) => selectedShotIds.has(s.id));
  }, [shots, selectedShotIds]);

  // Comprehensive shot message data with all fields resolved
  const selectedShotsData = useMemo<ShotMessageData[]>(() => {
    return selectedShots.map((s) => ({
      id: s.id,
      shotName: s.shotName || s.shotNumber || 'Unnamed Shot',
      shotNumber: s.shotNumber,
      notes: s.notes,
      scopeOfWork: s.scopeOfWork,
      department: formatDepartments(s.department),
      project: projectName || getProjectName(s.projectId, s.shotName || s.shotNumber),
      artist: getArtistNames(s.artistIds),
      status: getStatusLabel(s.status),
      priority: getPriorityLabel(s.priority),
      eta: s.eta ? formatDate(s.eta) : undefined,
    }));
  }, [selectedShots, projectName, getProjectName, getArtistNames]);

  // Formatted message text based on chosen style and dynamic checked fields
  const messageText = useMemo(() => {
    if (selectedShotsData.length === 0) return '';
    if (formatMode === 'simple') {
      return formatCustomSimpleNotes(selectedShotsData, selectedFields, projectName);
    } else if (formatMode === 'executive') {
      return formatCustomExecutiveCard(selectedShotsData, selectedFields, projectName);
    } else {
      return formatCustomStudioGrid(selectedShotsData, selectedFields, projectName);
    }
  }, [selectedShotsData, selectedFields, projectName, formatMode]);

  // Filtered shots for the picker list in modal
  const filteredShots = useMemo(() => {
    if (!shotSearch.trim()) return shots;
    const q = shotSearch.toLowerCase().trim();
    return shots.filter((s) => {
      const name = (s.shotName || s.shotNumber || '').toLowerCase();
      const notes = (s.notes || '').toLowerCase();
      const dept = (formatDepartments(s.department) || '').toLowerCase();
      const artist = getArtistNames(s.artistIds).toLowerCase();
      const status = getStatusLabel(s.status).toLowerCase();
      return (
        name.includes(q) ||
        notes.includes(q) ||
        dept.includes(q) ||
        artist.includes(q) ||
        status.includes(q)
      );
    });
  }, [shots, shotSearch, getArtistNames]);

  // Save number to recents
  const saveToRecents = (phoneNum: string, name?: string) => {
    if (!phoneNum.trim()) return;
    try {
      const existing = recents.filter((r) => r.phone !== phoneNum);
      const updated: SavedContact[] = [
        { phone: phoneNum, name: name?.trim() || undefined },
        ...existing,
      ].slice(0, 8);
      setRecents(updated);
      localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEY_LAST_CODE, countryCode);
    } catch {
      // ignore
    }
  };

  const handleRemoveRecent = (phoneToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recents.filter((r) => r.phone !== phoneToRemove);
    setRecents(updated);
    try {
      localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Direct In-App Send via Baileys Multi-Device Socket
  const handleDirectSend = async () => {
    if (selectedShots.length === 0) {
      showToast('Please select at least one shot', 'warning');
      return;
    }
    if (!fullCleanNumber) {
      showToast('Please enter a recipient phone number', 'warning');
      return;
    }

    setIsSendingDirect(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullCleanNumber, message: messageText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send message');
      }

      saveToRecents(fullCleanNumber, contactName);
      showToast(`Message sent directly to +${fullCleanNumber}!`, 'success');
    } catch (err: any) {
      showToast(`Error sending message: ${err.message}`, 'error');
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Fallback: Open WhatsApp Web tab
  const handleOpenWhatsAppWeb = () => {
    if (selectedShots.length === 0) {
      showToast('Please select at least one shot', 'warning');
      return;
    }
    if (!fullCleanNumber) {
      showToast('Please enter a recipient phone number', 'warning');
      return;
    }

    saveToRecents(fullCleanNumber, contactName);
    const encodedText = encodeURIComponent(messageText);
    const webUrl = `https://web.whatsapp.com/send?phone=${fullCleanNumber}&text=${encodedText}`;
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    showToast('Opening WhatsApp Web...', 'info');
  };

  // Primary Send Handler (If linked, sends directly in app; otherwise falls back to Web)
  const handlePrimarySend = () => {
    if (backendStatus === 'connected') {
      handleDirectSend();
    } else {
      handleOpenWhatsAppWeb();
    }
  };

  // Copy to clipboard
  const handleCopyMessage = async () => {
    if (!messageText) {
      showToast('No message to copy', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(messageText);
      showToast('Copied WhatsApp message to clipboard!', 'success');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = messageText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Copied to clipboard!', 'success');
    }
  };

  const toggleShot = (id: string) => {
    setSelectedShotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectOnlyWithNotes = () => {
    const withNotes = shots.filter((s) => s.notes && s.notes.trim().length > 0).map((s) => s.id);
    setSelectedShotIds(new Set(withNotes));
    if (withNotes.length === 0) {
      showToast('No shots have notes entered', 'warning');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📱 Send Shot Notes via WhatsApp"
      width="700px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleCopyMessage}>
            📋 Copy Message
          </button>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-whatsapp"
              onClick={handlePrimarySend}
              disabled={selectedShots.length === 0 || !fullCleanNumber || isSendingDirect}
              title={backendStatus === 'connected' ? 'Send directly via linked WhatsApp' : 'Open in WhatsApp Web and send'}
            >
              {isSendingDirect ? '⏳ Sending...' : '📱 Send'}
            </button>
          </div>
        </div>
      }
    >
      <div className="wa-modal-body">
        {/* WhatsApp Connection Card */}
        {backendStatus === 'offline' ? (
          <div className="wa-connection-card connected">
            <div className="wa-connection-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>WhatsApp Web Mode:</span>
                <span className="wa-status-pill connected">
                  <span className="wa-status-dot green" />
                  <span>Cloud Ready</span>
                </span>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              ⚡ <strong>1-Click Send Active:</strong> Recipient ka number daalein aur neeche <strong>📱 Send</strong> click karein — aapke WhatsApp Web me message turant pre-fill hokar open ho jayega!
            </div>
          </div>
        ) : (
          <div className={`wa-connection-card ${backendStatus === 'connected' ? 'connected' : qrCodeData ? 'qr-needed' : ''}`}>
            <div className="wa-connection-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>WhatsApp Web Link:</span>
                {backendStatus === 'connected' && (
                  <span className="wa-status-pill connected">
                    <span className="wa-status-dot green" />
                    <span>Logged in as +{userPhone} {userName ? `(${userName})` : ''}</span>
                  </span>
                )}
                {backendStatus === 'qr_ready' && (
                  <span className="wa-status-pill waiting">
                    <span className="wa-status-dot yellow" />
                    <span>Ready to scan QR Code</span>
                  </span>
                )}
                {backendStatus === 'connecting' && (
                  <span className="wa-status-pill waiting">
                    <span className="wa-status-dot yellow" />
                    <span>Connecting to WhatsApp...</span>
                  </span>
                )}
                {backendStatus === 'disconnected' && (
                  <span className="wa-status-pill offline">
                    <span className="wa-status-dot gray" />
                    <span>Not Linked</span>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {backendStatus === 'connected' ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ color: 'var(--color-danger, #ef4444)' }}
                    onClick={handleLogout}
                  >
                    Disconnect
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowQrCodeBox(!showQrCodeBox)}
                    >
                      {showQrCodeBox ? 'Hide QR' : '🔗 Scan QR Code'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={handleReconnect}
                      disabled={isReconnecting}
                      title="Generate fresh QR Code"
                    >
                      {isReconnecting ? '⏳ Refreshing...' : '🔄 Refresh'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Interactive QR Code Box */}
            {showQrCodeBox && backendStatus !== 'connected' && (
              <div className="wa-qr-box">
                <div className="wa-qr-image-wrapper">
                  {qrCodeData ? (
                    <img src={qrCodeData} alt="WhatsApp QR Code" className="wa-qr-image" />
                  ) : (
                    <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', padding: '10px' }}>
                      ⏳ Generating QR Code...
                    </div>
                  )}
                </div>
                <div className="wa-qr-instructions">
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>
                    📱 How to link your WhatsApp:
                  </div>
                  <ol>
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Tap <strong>Menu (3 dots)</strong> or <strong>Settings</strong></li>
                    <li>Select <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong></li>
                    <li>Point your phone camera to this QR code to scan</li>
                  </ol>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
                    ⚡ Once scanned, click <strong>Send</strong> to send directly from this app!
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recipient Phone Input */}
        <div className="wa-section">
          <label className="wa-section-title">
            <span>Recipient WhatsApp Number *</span>
            {fullCleanNumber && (
              <span style={{ color: '#25D366', fontWeight: 600, fontSize: '11px' }}>
                Sending to: +{fullCleanNumber}
              </span>
            )}
          </label>
          <div className="wa-phone-row">
            <select
              className="form-input wa-country-code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              <option value="+91">🇮🇳 +91</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+971">🇦🇪 +971</option>
              <option value="+61">🇦🇺 +61</option>
              <option value="+65">🇸🇬 +65</option>
              <option value="+49">🇩🇪 +49</option>
              <option value="+81">🇯🇵 +81</option>
            </select>
            <input
              type="text"
              className="form-input wa-phone-input"
              placeholder="e.g. 9876543210 (Manual mobile number)"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              className="form-input"
              style={{ width: '140px' }}
              placeholder="Contact Name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              title="Optional contact name for recent list"
            />
          </div>

          {/* Recent numbers */}
          {recents.length > 0 && (
            <div className="wa-recents-list">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                Recent:
              </span>
              {recents.map((c) => (
                <span
                  key={c.phone}
                  className={`wa-recent-chip ${fullCleanNumber === c.phone ? 'active' : ''}`}
                  onClick={() => {
                    if (c.phone.startsWith('91') && c.phone.length === 12) {
                      setCountryCode('+91');
                      setPhoneNumber(c.phone.slice(2));
                    } else if (c.phone.startsWith('1') && c.phone.length === 11) {
                      setCountryCode('+1');
                      setPhoneNumber(c.phone.slice(1));
                    } else {
                      setPhoneNumber(c.phone);
                    }
                    if (c.name) setContactName(c.name);
                  }}
                >
                  <span>{c.name ? `${c.name} (${c.phone})` : `+${c.phone}`}</span>
                  <span
                    className="wa-recent-remove"
                    onClick={(e) => handleRemoveRecent(c.phone, e)}
                    title="Remove from recents"
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Fields to Include in WhatsApp Message */}
        <div className="wa-section">
          <div className="wa-section-title">
            <span>
              Fields to Include in Message ({Object.values(selectedFields).filter(Boolean).length} of {MESSAGE_FIELD_OPTIONS.length} active)
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={resetFieldsToDefault}
                title="Default: Shot Name + Notes only"
              >
                Default
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setAllFields(true)}
                title="Select all fields"
              >
                Select All
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setAllFields(false)}
                title="Only Shot Name"
              >
                Shot Only
              </button>
            </div>
          </div>

          <div className="wa-fields-grid">
            {MESSAGE_FIELD_OPTIONS.map((field) => {
              const isChecked = Boolean(selectedFields[field.key]);
              return (
                <label
                  key={field.key}
                  className={`wa-field-chip ${isChecked ? 'active' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleField(field.key)}
                  />
                  <span>{field.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Selected Shots Picker */}
        <div className="wa-section">
          <div className="wa-section-title">
            <span>
              Shots to Include ({selectedShots.length} of {shots.length} selected)
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setSelectedShotIds(new Set(shots.map((s) => s.id)))}
              >
                Select All
              </button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={selectOnlyWithNotes}>
                Only with Notes
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setSelectedShotIds(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          {shots.length > 5 && (
            <input
              type="text"
              className="wa-shot-search-input"
              placeholder="🔍 Filter shots by name, notes, artist, status..."
              value={shotSearch}
              onChange={(e) => setShotSearch(e.target.value)}
            />
          )}

          <div className="wa-shots-box">
            {filteredShots.map((shot, index) => {
              const isChecked = selectedShotIds.has(shot.id);
              const hasNotes = Boolean(shot.notes && shot.notes.trim().length > 0);
              const origIndex = shots.findIndex((s) => s.id === shot.id);
              const shotArtist = getArtistNames(shot.artistIds);
              const shotStatus = getStatusLabel(shot.status);
              const shotDept = formatDepartments(shot.department);

              return (
                <div
                  key={shot.id}
                  className={`wa-shot-item ${isChecked ? 'selected' : ''}`}
                  onClick={() => toggleShot(shot.id)}
                >
                  <div className="wa-shot-item-left">
                    <span className="wa-shot-index">#{origIndex >= 0 ? origIndex + 1 : index + 1}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ cursor: 'pointer' }}
                    />
                    <span className="wa-shot-name">
                      {shot.shotName || shot.shotNumber || 'Unnamed'}
                    </span>
                    <div className="wa-shot-meta-badges">
                      {shotDept && shotDept !== '—' && (
                        <span className="wa-shot-tag dept">{shotDept}</span>
                      )}
                      {shotStatus && (
                        <span className="wa-shot-tag status">{shotStatus}</span>
                      )}
                      {shotArtist && shotArtist !== 'Unassigned' && (
                        <span className="wa-shot-tag artist">{shotArtist}</span>
                      )}
                    </div>
                    <span className="wa-shot-notes-peek" title={shot.notes}>
                      {shot.notes || <span style={{ fontStyle: 'italic' }}>No notes</span>}
                    </span>
                  </div>
                  {!hasNotes && <span className="wa-shot-empty-badge">Empty Note</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Style Selector */}
        <div className="wa-options-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Format:</span>
            <div className="wa-format-pills">
              <button
                type="button"
                className={`wa-format-pill ${formatMode === 'simple' ? 'active' : ''}`}
                onClick={() => setFormatMode('simple')}
                title="Simple clean text with Shot Name & Notes only (Default)"
              >
                📋 Simple Clean (Default)
              </button>
              <button
                type="button"
                className={`wa-format-pill ${formatMode === 'executive' ? 'active' : ''}`}
                onClick={() => setFormatMode('executive')}
                title="Executive studio format with emojis & badges"
              >
                ✨ Executive Card
              </button>
              <button
                type="button"
                className={`wa-format-pill ${formatMode === 'grid' ? 'active' : ''}`}
                onClick={() => setFormatMode('grid')}
                title="Unicode double-border spreadsheet grid"
              >
                📊 Studio Grid
              </button>
            </div>
          </div>
        </div>

        {/* Live Message Preview */}
        <div className="wa-section">
          <div className="wa-section-title">
            <span>Live WhatsApp Message Preview</span>
            <span style={{ fontSize: '11px', color: '#25D366' }}>
              {selectedShots.length} shot{selectedShots.length !== 1 ? 's' : ''} in message
            </span>
          </div>

          <div className="wa-preview-container">
            <div className="wa-preview-bubble">
              {formatMode === 'grid' ? (
                <pre style={{ margin: 0, fontFamily: 'Consolas, monospace', fontSize: '11.5px', whiteSpace: 'pre', overflowX: 'auto', background: 'transparent', border: 'none', padding: 0 }}>
                  {messageText}
                </pre>
              ) : (
                messageText
              )}
            </div>
            <div className="wa-char-count">{messageText.length} characters</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
