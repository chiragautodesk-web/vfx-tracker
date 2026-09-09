import { useState, useEffect, useMemo } from 'react';
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

interface SavedContact {
  phone: string;
  name?: string;
}

const STORAGE_KEY_RECENTS = 'vfx_recent_whatsapp_recipients';
const STORAGE_KEY_LAST_CODE = 'vfx_last_whatsapp_country_code';

// Helper to wrap long note text cleanly for monospace table
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Generates an Excel-style Monospace ASCII Table for WhatsApp
export function generateWhatsAppExcelGrid(
  items: Array<{ shotName: string; notes?: string }>,
  projectName?: string,
  options: { includeHeader?: boolean; includeTimestamp?: boolean } = {}
): string {
  if (items.length === 0) return '';

  const { includeHeader = true, includeTimestamp = true } = options;

  // Calculate dynamic column width for Shot Name
  const maxShotLen = Math.max(9, ...items.map((s) => (s.shotName || '').length));
  const shotColWidth = Math.min(22, Math.max(12, maxShotLen));
  const notesColWidth = 38;

  const pad = (str: string, len: number) => {
    if (str.length > len) return str.slice(0, len - 1) + '…';
    return str + ' '.repeat(Math.max(0, len - str.length));
  };

  const border = '+' + '-'.repeat(shotColWidth + 2) + '+' + '-'.repeat(notesColWidth + 2) + '+';
  const header = '| ' + pad('Shot Name', shotColWidth) + ' | ' + pad('Notes', notesColWidth) + ' |';

  const tableLines = [border, header, border];

  for (const item of items) {
    const rawShot = item.shotName || 'N/A';
    const noteText = (item.notes || '').trim() || '—';

    // Handle existing line breaks in note first
    const paragraphs = noteText.split(/\r?\n/);
    const wrappedNoteLines: string[] = [];
    for (const p of paragraphs) {
      wrappedNoteLines.push(...wrapText(p, notesColWidth));
    }
    if (wrappedNoteLines.length === 0) wrappedNoteLines.push('—');

    // First row line
    tableLines.push('| ' + pad(rawShot, shotColWidth) + ' | ' + pad(wrappedNoteLines[0], notesColWidth) + ' |');
    // Multi-line continuation for wrapped notes
    for (let i = 1; i < wrappedNoteLines.length; i++) {
      tableLines.push('| ' + pad('', shotColWidth) + ' | ' + pad(wrappedNoteLines[i], notesColWidth) + ' |');
    }
    tableLines.push(border);
  }

  const tableOutput = tableLines.join('\n');

  // Build full message with header
  const headerParts: string[] = [];
  if (includeHeader) {
    headerParts.push('🎬 *VFX NOTES REPORT*');
    if (projectName) headerParts.push(`📁 *Project:* ${projectName}`);
    headerParts.push(`🎯 *Total Shots:* ${items.length}`);
    if (includeTimestamp) {
      const nowStr = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      headerParts.push(`📅 *Date:* ${nowStr}`);
    }
    headerParts.push('━━━━━━━━━━━━━━━━━━━━━━');
  }

  const message = [
    ...headerParts,
    '```',
    tableOutput,
    '```',
    '',
    '_Sent via PEELA VFX Tracker_',
  ].filter(Boolean).join('\n');

  return message;
}

// Alternative clean list format
export function generateWhatsAppListFormat(
  items: Array<{ shotName: string; notes?: string }>,
  projectName?: string,
  options: { includeHeader?: boolean; includeTimestamp?: boolean } = {}
): string {
  if (items.length === 0) return '';
  const { includeHeader = true, includeTimestamp = true } = options;

  const lines: string[] = [];
  if (includeHeader) {
    lines.push('🎬 *VFX NOTES REPORT*');
    if (projectName) lines.push(`📁 *Project:* ${projectName}`);
    lines.push(`🎯 *Total Shots:* ${items.length}`);
    if (includeTimestamp) {
      const nowStr = new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      lines.push(`📅 *Date:* ${nowStr}`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  items.forEach((item, idx) => {
    lines.push(`*${idx + 1}. ${item.shotName || 'N/A'}*`);
    const note = (item.notes || '').trim() || '—';
    lines.push(`📝 ${note}\n`);
  });

  lines.push('_Sent via PEELA VFX Tracker_');
  return lines.join('\n');
}

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
  const [formatMode, setFormatMode] = useState<'grid' | 'list'>('grid');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [recents, setRecents] = useState<SavedContact[]>([]);

  // Load recents & country code on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENTS);
      if (saved) {
        setRecents(JSON.parse(saved));
      }
      const savedCode = localStorage.getItem(STORAGE_KEY_LAST_CODE);
      if (savedCode) {
        setCountryCode(savedCode);
      }
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

  // Handle phone input change with auto country code detection
  const handlePhoneChange = (val: string) => {
    let clean = val.replace(/[^\d+]/g, '');
    if (clean.startsWith('+')) {
      // User typed e.g. +919876543210
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
    // Remove leading 0 if 10 digits follow
    if (clean.startsWith('0') && clean.length === 11) {
      clean = clean.slice(1);
    }
    setPhoneNumber(clean);
  };

  // Clean full number for WhatsApp URL
  const fullCleanNumber = useMemo(() => {
    const raw = (phoneNumber || '').replace(/\D/g, '');
    if (!raw) return '';
    const codeDigits = countryCode.replace(/\D/g, '');
    // If user already typed code in number, don't duplicate
    if (raw.startsWith(codeDigits) && raw.length > codeDigits.length + 6) {
      return raw;
    }
    return `${codeDigits}${raw}`;
  }, [countryCode, phoneNumber]);

  // Filtered selected shots
  const selectedShots = useMemo(() => {
    return shots.filter((s) => selectedShotIds.has(s.id));
  }, [shots, selectedShotIds]);

  // Generated WhatsApp message text
  const messageText = useMemo(() => {
    const items = selectedShots.map((s) => ({
      shotName: s.shotName || s.shotNumber || 'Unnamed Shot',
      notes: s.notes,
    }));

    if (formatMode === 'grid') {
      return generateWhatsAppExcelGrid(items, projectName, {
        includeHeader,
        includeTimestamp,
      });
    } else {
      return generateWhatsAppListFormat(items, projectName, {
        includeHeader,
        includeTimestamp,
      });
    }
  }, [selectedShots, projectName, formatMode, includeHeader, includeTimestamp]);

  // Save number to recents
  const saveToRecents = (phoneNum: string, name?: string) => {
    if (!phoneNum.trim()) return;
    try {
      const existing = recents.filter((r) => r.phone !== phoneNum);
      const updated: SavedContact[] = [{ phone: phoneNum, name: name?.trim() || undefined }, ...existing].slice(0, 8);
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

  // Launch WhatsApp Web
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
    showToast('Opening WhatsApp Web...', 'success');
  };

  // Launch wa.me universal link (WhatsApp app or web)
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
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = messageText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Copied to clipboard!', 'success');
    }
  };

  // Toggle shot selection
  const toggleShot = (id: string) => {
    setSelectedShotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select only shots with notes
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
      width="680px"
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
              title="Open using wa.me (Desktop app / mobile redirect)"
            >
              Open wa.me
            </button>
            <button
              className="btn btn-whatsapp"
              onClick={handleOpenWhatsAppWeb}
              disabled={selectedShots.length === 0 || !fullCleanNumber}
            >
              <span>🌐 Open in WhatsApp Web</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="wa-modal-body">
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
              style={{ width: '130px' }}
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
                    // detect code
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
                      onChange={() => {}} // handled by parent div
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

        {/* Format and options */}
        <div className="wa-options-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Format:</span>
            <div className="wa-format-pills">
              <button
                type="button"
                className={`wa-format-pill ${formatMode === 'grid' ? 'active' : ''}`}
                onClick={() => setFormatMode('grid')}
              >
                📊 Excel Grid (Table)
              </button>
              <button
                type="button"
                className={`wa-format-pill ${formatMode === 'list' ? 'active' : ''}`}
                onClick={() => setFormatMode('list')}
              >
                📝 Clean List
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
            <span>Live WhatsApp Preview</span>
            <span style={{ fontSize: '11px', color: '#25D366' }}>
              {selectedShots.length} shot{selectedShots.length !== 1 ? 's' : ''} in message
            </span>
          </div>

          <div className="wa-preview-container">
            <div className="wa-preview-bubble">
              {formatMode === 'grid' ? (
                <>
                  {includeHeader && (
                    <div style={{ whiteSpace: 'pre-line', marginBottom: '6px' }}>
                      <strong>🎬 VFX NOTES REPORT</strong>
                      {projectName && <div>📁 Project: <strong>{projectName}</strong></div>}
                      <div>🎯 Total Shots: <strong>{selectedShots.length}</strong></div>
                      {includeTimestamp && (
                        <div>📅 Date: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      )}
                      <div>━━━━━━━━━━━━━━━━━━━━━━</div>
                    </div>
                  )}
                  <pre>
                    {generateWhatsAppExcelGrid(
                      selectedShots.map((s) => ({
                        shotName: s.shotName || s.shotNumber || 'Unnamed',
                        notes: s.notes,
                      })),
                      undefined,
                      { includeHeader: false }
                    ).replace(/^```\n?/, '').replace(/\n?```\n?.*$/, '')}
                  </pre>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                    _Sent via PEELA VFX Tracker_
                  </div>
                </>
              ) : (
                <div style={{ whiteSpace: 'pre-line' }}>{messageText}</div>
              )}
            </div>
            <div className="wa-char-count">{messageText.length} characters</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
