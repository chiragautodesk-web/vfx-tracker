import { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import type { Shot } from '../types';
import './WhatsAppShareModal.css';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shots: Shot[];
  projectName?: string;
}

import {
  type FormatStyle,
  formatExecutiveCard,
  formatCleanList,
  formatStudioGrid,
} from '../utils/whatsappFormatter';

interface SavedContact {
  phone: string;
  name?: string;
}

const STORAGE_KEY_RECENTS = 'vfx_recent_whatsapp_recipients';
const STORAGE_KEY_LAST_CODE = 'vfx_last_whatsapp_country_code';

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  shots,
  projectName,
}: WhatsAppShareModalProps) {
  const { showToast } = useToast();

  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [formatMode, setFormatMode] = useState<FormatStyle>('executive');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [recents, setRecents] = useState<SavedContact[]>([]);

  // WhatsApp In-App Backend State
  const [backendStatus, setBackendStatus] = useState<
    'checking' | 'connected' | 'qr_ready' | 'connecting' | 'disconnected' | 'offline'
  >('checking');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [showQrCodeBox, setShowQrCodeBox] = useState(false);
  const [isSendingDirect, setIsSendingDirect] = useState(false);
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
    try {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) {
        setBackendStatus('offline');
        return;
      }
      const data = await res.json();
      setBackendStatus(data.status || 'disconnected');
      setQrCodeData(data.qrCode || null);
      setUserPhone(data.userPhone || null);
      setUserName(data.userName || null);

      if (data.status === 'qr_ready') {
        setShowQrCodeBox(true);
      } else if (data.status === 'connected') {
        setShowQrCodeBox(false);
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkWhatsAppStatus();
      // Poll every 2.5s for real-time QR scan detection
      pollingRef.current = setInterval(checkWhatsAppStatus, 2500);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen]);

  // Reconnect / generate fresh QR
  const handleReconnect = async () => {
    try {
      setBackendStatus('connecting');
      const res = await fetch('/api/whatsapp/reconnect', { method: 'POST' });
      const data = await res.json();
      setBackendStatus(data.status || 'connecting');
      setQrCodeData(data.qrCode || null);
      showToast('Generating fresh WhatsApp QR Code...', 'info');
    } catch (err: any) {
      showToast('Error requesting QR: ' + err.message, 'error');
    }
  };

  // Logout WhatsApp
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/whatsapp/logout', { method: 'POST' });
      await res.json();
      setBackendStatus('disconnected');
      setQrCodeData(null);
      setUserPhone(null);
      setUserName(null);
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

  // Formatted message text based on chosen style
  const messageText = useMemo(() => {
    const items = selectedShots.map((s) => ({
      shotName: s.shotName || s.shotNumber || 'Unnamed Shot',
      notes: s.notes,
      scopeOfWork: s.scopeOfWork,
      department: s.department,
    }));

    if (formatMode === 'executive') {
      return formatExecutiveCard(items, projectName, { includeHeader, includeTimestamp });
    } else if (formatMode === 'list') {
      return formatCleanList(items, projectName, { includeHeader, includeTimestamp });
    } else {
      return formatStudioGrid(items, projectName, { includeHeader, includeTimestamp });
    }
  }, [selectedShots, projectName, formatMode, includeHeader, includeTimestamp]);

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
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullCleanNumber, message: messageText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send message');
      }

      saveToRecents(fullCleanNumber, contactName);
      showToast(`🚀 Message sent directly to +${fullCleanNumber}!`, 'success');
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
    showToast('Opening WhatsApp Web in new tab...', 'info');
  };

  // Fallback: wa.me universal link
  const handleOpenUniversalLink = () => {
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
    const waUrl = `https://wa.me/${fullCleanNumber}?text=${encodedText}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
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
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-whatsapp-outline"
              onClick={handleOpenUniversalLink}
              disabled={selectedShots.length === 0 || !fullCleanNumber}
              title="Open via wa.me (Desktop app / mobile)"
            >
              wa.me
            </button>
            <button
              className="btn btn-whatsapp-outline"
              onClick={handleOpenWhatsAppWeb}
              disabled={selectedShots.length === 0 || !fullCleanNumber}
              title="Open WhatsApp Web tab"
            >
              🌐 Web
            </button>

            {backendStatus === 'connected' ? (
              <button
                className="btn btn-whatsapp"
                onClick={handleDirectSend}
                disabled={selectedShots.length === 0 || !fullCleanNumber || isSendingDirect}
              >
                {isSendingDirect ? '⏳ Sending...' : '🚀 Send Directly via WhatsApp'}
              </button>
            ) : (
              <button
                className="btn btn-whatsapp"
                onClick={handleOpenWhatsAppWeb}
                disabled={selectedShots.length === 0 || !fullCleanNumber}
              >
                <span>🌐 Send via WhatsApp Web</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="wa-modal-body">
        {/* WhatsApp Connection Card */}
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
              {(backendStatus === 'disconnected' || backendStatus === 'offline') && (
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
                    title="Generate fresh QR Code"
                  >
                    🔄 Refresh
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
                  ⚡ Once scanned, messages will send directly from your phone number!
                </div>
              </div>
            </div>
          )}
        </div>

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

        {/* Selected Shots Picker */}
        <div className="wa-section">
          <div className="wa-section-title">
            <span>
              Shots to Include ({selectedShots.length} of {shots.length} selected)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
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

          <div className="wa-shots-box">
            {shots.map((shot) => {
              const isChecked = selectedShotIds.has(shot.id);
              const hasNotes = Boolean(shot.notes && shot.notes.trim().length > 0);
              return (
                <div
                  key={shot.id}
                  className={`wa-shot-item ${isChecked ? 'selected' : ''}`}
                  onClick={() => toggleShot(shot.id)}
                >
                  <div className="wa-shot-item-left">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ cursor: 'pointer' }}
                    />
                    <span className="wa-shot-name">
                      {shot.shotName || shot.shotNumber || 'Unnamed'}
                    </span>
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

        {/* Professional Format Selector */}
        <div className="wa-options-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Style:</span>
            <div className="wa-format-pills">
              <button
                type="button"
                className={`wa-format-pill ${formatMode === 'executive' ? 'active' : ''}`}
                onClick={() => setFormatMode('executive')}
                title="Professional Studio Format with stylish badges & dividers"
              >
                ✨ Executive Card
              </button>
              <button
                type="button"
                className={`wa-format-pill ${formatMode === 'list' ? 'active' : ''}`}
                onClick={() => setFormatMode('list')}
                title="Clean bulleted summary"
              >
                📝 Clean List
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

          <div style={{ display: 'flex', gap: '14px' }}>
            <label className="wa-checkbox-option">
              <input
                type="checkbox"
                checked={includeHeader}
                onChange={(e) => setIncludeHeader(e.target.checked)}
              />
              Header info
            </label>
            <label className="wa-checkbox-option">
              <input
                type="checkbox"
                checked={includeTimestamp}
                onChange={(e) => setIncludeTimestamp(e.target.checked)}
              />
              Timestamp
            </label>
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
