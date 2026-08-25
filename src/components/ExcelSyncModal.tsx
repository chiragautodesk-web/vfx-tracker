import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useStore } from '../store';
import Modal from './Modal';
import { generateId, now } from '../utils';
import type { Shot, ShotStatus, Project } from '../types';
import './ExcelSyncModal.css';

interface ExcelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

const TRACKER_FIELDS = [
  { id: 'shotNumber', label: 'Shot Number (Identifier)' },
  { id: 'shotName', label: 'Shot Name' },
  { id: 'description', label: 'Description' },
  { id: 'notes', label: 'Notes' },
  { id: 'artistName', label: 'Assigned Artists (Names, comma separated)' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'eta', label: 'ETA Date' },
  { id: 'finalDeliveryDate', label: 'Delivery Date' },
  { id: 'clientFeedback', label: 'Client Feedback' },
];

export default function ExcelSyncModal({ isOpen, onClose, project }: ExcelSyncModalProps) {
  const { state, dispatch } = useStore();
  
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>(project.excelMapping || {});
  
  const [previewData, setPreviewData] = useState<{
    added: Shot[];
    updated: Shot[];
    missing: number;
    noChange: number;
  }>({ added: [], updated: [], missing: 0, noChange: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setExcelData([]);
    setExcelHeaders([]);
    setPreviewData({ added: [], updated: [], missing: 0, noChange: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
      
      if (data.length > 0) {
        setExcelHeaders(Object.keys(data[0] as object));
        setExcelData(data);
        
        // Try to auto-map based on common names if no mapping exists
        let newMap = { ...mapping };
        if (Object.keys(newMap).length === 0) {
           const headers = Object.keys(data[0] as object);
           headers.forEach(h => {
             const hLower = h.toLowerCase();
             if (hLower.includes('shot no') || hLower.includes('shot number')) newMap['shotNumber'] = h;
             else if (hLower.includes('name')) newMap['shotName'] = h;
             else if (hLower.includes('notes')) newMap['notes'] = h;
             else if (hLower.includes('artist')) newMap['artistName'] = h;
             else if (hLower.includes('status')) newMap['status'] = h;
             else if (hLower.includes('eta')) newMap['eta'] = h;
             else if (hLower.includes('delivery')) newMap['finalDeliveryDate'] = h;
             else if (hLower.includes('feedback') || hLower.includes('note')) newMap['clientFeedback'] = h;
           });
        }
        setMapping(newMap);
        setStep('map');
      }
    };
    reader.readAsBinaryString(file);
  };

  const generatePreview = () => {
    if (!mapping.shotNumber) {
      alert("You must map a column to Shot Number (Identifier).");
      return;
    }

    const existingShots = state.shots.filter(s => s.projectId === project.id);
    const added: Shot[] = [];
    const updated: Shot[] = [];
    let noChangeCount = 0;
    const excelShotNumbers = new Set<string>();

    excelData.forEach(row => {
      const shotNumber = String(row[mapping.shotNumber] || '').trim();
      if (!shotNumber) return;
      
      excelShotNumbers.add(shotNumber);
      
      let artistIds: string[] = [];
      if (mapping.artistName && row[mapping.artistName]) {
        const aNames = String(row[mapping.artistName]).split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
        aNames.forEach(aName => {
          const artist = state.artists.find(a => a.name.toLowerCase() === aName);
          if (artist) artistIds.push(artist.id);
        });
      }

      const rawStatus = mapping.status ? String(row[mapping.status]).trim().toLowerCase() : '';
      let status: ShotStatus = 'pending';
      if (rawStatus.includes('progress') || rawStatus.includes('wip')) status = 'in-progress';
      else if (rawStatus.includes('client review')) status = 'client-review';
      else if (rawStatus.includes('feedback')) status = 'client-feedback';
      else if (rawStatus.includes('approved')) status = 'approved';
      else if (rawStatus.includes('delivered')) status = 'delivered';
      
      const rawDate = (d: any) => {
        if (!d) return '';
        // rudimentary date formatting - assuming DD-MM-YYYY or similar string
        if (typeof d === 'number') {
          // Excel serial date
          const date = new Date((d - (25567 + 2)) * 86400 * 1000);
          return date.toISOString().split('T')[0];
        }
        return String(d).split('T')[0]; // fallback
      };

      const eta = mapping.eta ? rawDate(row[mapping.eta]) : '';
      const finalDel = mapping.finalDeliveryDate ? rawDate(row[mapping.finalDeliveryDate]) : '';
      const shotName = mapping.shotName ? String(row[mapping.shotName]) : '';
      const desc = mapping.description ? String(row[mapping.description]) : '';
      const notes = mapping.notes ? String(row[mapping.notes]) : '';
      
      const existing = existingShots.find(s => s.shotNumber === shotNumber);

      if (existing) {
        let changed = false;
        const newShot = { ...existing };
        if (artistIds.length > 0 && JSON.stringify(existing.artistIds || []) !== JSON.stringify(artistIds)) { newShot.artistIds = artistIds; changed = true; }
        if (mapping.status && existing.status !== status) { newShot.status = status; changed = true; }
        if (eta && existing.eta !== eta) { newShot.eta = eta; changed = true; }
        if (notes && existing.notes !== notes) { newShot.notes = notes; changed = true; }
        if (finalDel && existing.finalDeliveryDate !== finalDel) { newShot.finalDeliveryDate = finalDel; changed = true; }
        
        if (mapping.clientFeedback && row[mapping.clientFeedback]) {
           const note = String(row[mapping.clientFeedback]).trim();
           if (note && !existing.clientFeedback.some(f => f.note === note)) {
             newShot.clientFeedback = [...existing.clientFeedback, {
               id: generateId(),
               shotId: existing.id,
               date: now().split('T')[0],
               note,
               type: 'feedback'
             }];
             changed = true;
           }
        }

        if (changed) {
          newShot.updatedAt = now();
          updated.push(newShot);
        } else {
          noChangeCount++;
        }
      } else {
        // New shot
        added.push({
          id: generateId(),
          projectId: project.id,
          shotNumber,
          shotName: shotName || shotNumber,
          description: desc,
          notes,
          artistIds,
          status,
          priority: 'medium',
          eta,
          finalDeliveryDate: finalDel,
          deliveryStatus: status === 'delivered' ? 'delivered' : 'pending',
          clientFeedback: [],
          createdAt: now(),
          updatedAt: now(),
        });
      }
    });

    const missingCount = existingShots.filter(s => !excelShotNumbers.has(s.shotNumber)).length;

    setPreviewData({ added, updated, missing: missingCount, noChange: noChangeCount });
    
    // Save mapping to project
    dispatch({
      type: 'UPDATE_PROJECT',
      payload: { ...project, excelMapping: mapping, updatedAt: now() }
    });
    
    setStep('preview');
  };

  const handleSync = () => {
    dispatch({
      type: 'SYNC_EXCEL_SHOTS',
      payload: { projectId: project.id, added: previewData.added, updated: previewData.updated }
    });
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Sync Excel for ${project.name}`}>
      {step === 'upload' && (
        <div className="sync-upload-step">
          <p>Upload the latest Excel file from the client to sync shot statuses, ETAs, and artist assignments.</p>
          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} ref={fileInputRef} className="form-input" style={{ marginTop: 'var(--space-4)' }} />
        </div>
      )}

      {step === 'map' && (
        <div className="sync-map-step">
          <p className="sync-instruction">Map the Tracker Fields to the columns found in your Excel file.</p>
          <div className="mapping-grid">
            <div className="mapping-header">Tracker Field</div>
            <div className="mapping-header">Excel Column</div>
            
            {TRACKER_FIELDS.map(field => (
              <React.Fragment key={field.id}>
                <div className="mapping-label">{field.label} {field.id === 'shotNumber' && <span style={{color: 'var(--color-danger)'}}>*</span>}</div>
                <select 
                  className="form-input" 
                  value={mapping[field.id] || ''}
                  onChange={(e) => setMapping({...mapping, [field.id]: e.target.value})}
                >
                  <option value="">-- Ignore --</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </React.Fragment>
            ))}
          </div>
          
          <div className="modal-actions" style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
             <button className="btn btn-secondary" onClick={() => setStep('upload')}>Back</button>
             <button className="btn btn-primary" onClick={generatePreview}>Generate Preview</button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="sync-preview-step">
          <div className="sync-summary-cards">
             <div className="sync-card new">
                <span className="sync-val">{previewData.added.length}</span>
                <span className="sync-lbl">New Shots</span>
             </div>
             <div className="sync-card update">
                <span className="sync-val">{previewData.updated.length}</span>
                <span className="sync-lbl">Updated Shots</span>
             </div>
             <div className="sync-card nochange">
                <span className="sync-val">{previewData.noChange}</span>
                <span className="sync-lbl">No Change</span>
             </div>
             <div className="sync-card missing">
                <span className="sync-val">{previewData.missing}</span>
                <span className="sync-lbl">Missing in Excel</span>
             </div>
          </div>
          
          <div className="sync-details">
             {previewData.added.length > 0 && (
               <div>
                 <h4>Added:</h4>
                 <div className="sync-chips">
                   {previewData.added.map(s => <span key={s.id} className="sync-chip new">{s.shotNumber}</span>)}
                 </div>
               </div>
             )}
             {previewData.updated.length > 0 && (
               <div style={{ marginTop: 'var(--space-3)' }}>
                 <h4>Updated:</h4>
                 <div className="sync-chips">
                   {previewData.updated.map(s => <span key={s.id} className="sync-chip update">{s.shotNumber}</span>)}
                 </div>
               </div>
             )}
          </div>
          
          <div className="modal-actions" style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
             <button className="btn btn-secondary" onClick={() => setStep('map')}>Back</button>
             <button className="btn btn-primary" onClick={handleSync}>Confirm & Sync</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
