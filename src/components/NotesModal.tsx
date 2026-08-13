import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useStore } from '../store';
import { now } from '../utils';
import type { Shot } from '../types';

interface NotesModalProps {
  shot: Shot | null;
  onClose: () => void;
}

export default function NotesModal({ shot, onClose }: NotesModalProps) {
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
      title={`Notes — ${shot?.shotNumber ?? ''}`}
      width="600px"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Notes</button>
        </>
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
