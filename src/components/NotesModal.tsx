import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useStore } from '../store';
import { now } from '../utils';
import type { Shot } from '../types';

interface NotesModalProps {
  shot: Shot | null;
  onClose: () => void;
  onShareWhatsApp?: (shot: Shot) => void;
}

export default function NotesModal({ shot, onClose, onShareWhatsApp }: NotesModalProps) {
  const { dispatch } = useStore();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (shot) {
      setNotes(shot.notes || '');
    }
  }, [shot]);

  const handleSave = () => {
    if (!shot) return;
    dispatch({
      type: 'UPDATE_SHOT',
      payload: { ...shot, notes, updatedAt: now() }
    });
    onClose();
  };

  return (
    <Modal
      isOpen={!!shot}
      onClose={onClose}
      title={`Notes — ${shot?.shotName || shot?.shotNumber || ''}`}
      width="600px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          {onShareWhatsApp && shot ? (
            <button
              type="button"
              className="btn btn-whatsapp-outline btn-sm"
              onClick={() => {
                const updated = { ...shot, notes, updatedAt: now() };
                dispatch({ type: 'UPDATE_SHOT', payload: updated });
                onShareWhatsApp(updated);
              }}
              title="Send this shot note via WhatsApp"
            >
              📱 Send via WhatsApp
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Notes</button>
          </div>
        </div>
      }
    >
      <div className="form-group" style={{ marginBottom: 0 }}>
        <textarea
          className="form-input"
          style={{ minHeight: '250px', resize: 'vertical', fontSize: 'var(--text-md)' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter detailed notes here..."
          autoFocus
        />
      </div>
    </Modal>
  );
}
