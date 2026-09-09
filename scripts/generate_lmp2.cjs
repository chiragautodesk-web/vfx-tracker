const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dataDir = path.join(__dirname, '..', 'src', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const excelPath = path.join(__dirname, '..', 'Excel', 'LMP2_VFX_Breakdown_Organized.xlsx');
const wb = xlsx.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws);

const lmp2Shots = rows.map((r, i) => {
  const shotName = String(r['Shot Name'] || '').trim();
  const roto = String(r['Rotoscope'] || '').trim().toLowerCase() === 'yes';
  const prep = String(r['Prep'] || '').trim().toLowerCase() === 'yes';
  const objTrack = String(r['Object Track'] || '').trim().toLowerCase() === 'yes';
  const camTrack = String(r['Camera 3D Tracking'] || '').trim().toLowerCase() === 'yes';

  const depts = [];
  if (roto) depts.push('Roto');
  if (prep) depts.push('Prep');
  if (objTrack) depts.push('Object Tracking');
  if (camTrack) depts.push('Camera Tracking');

  const notesParts = [];
  if (r['MONK Note']) notesParts.push('MONK: ' + String(r['MONK Note']).trim());
  if (r['Note (SMP)']) notesParts.push('SMP: ' + String(r['Note (SMP)']).trim());
  if (r['Camera Details']) notesParts.push('Cam: ' + String(r['Camera Details']).replace(/[\r\n]+/g, ' ').trim());
  if (r['Background Plate']) notesParts.push('Plate: ' + String(r['Background Plate']).replace(/[\r\n]+/g, ' ').trim());
  if (r['Remark']) notesParts.push('Remark: ' + String(r['Remark']).trim());

  let desc = '';
  if (r['Shot Methodologies']) desc = 'Methodology: ' + String(r['Shot Methodologies']).trim();
  if (r['Frame Count']) desc += (desc ? ' | ' : '') + 'Frames: ' + r['Frame Count'];

  return {
    id: 'lmp2-shot-' + String(i + 1).padStart(3, '0'),
    projectId: 'proj-lmp2',
    shotNumber: shotName,
    shotName: shotName,
    scopeOfWork: String(r['Scope of Work'] || '').trim(),
    department: depts,
    description: desc,
    notes: notesParts.join(' \n\n '),
    artistIds: [],
    status: 'pending',
    priority: 'medium',
    eta: '',
    finalDeliveryDate: '',
    deliveryStatus: 'pending',
    clientFeedback: [],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-09T00:00:00Z'
  };
});

const fileContent = `// Auto-generated from Excel/LMP2_VFX_Breakdown_Organized.xlsx
import type { Project, Shot } from '../types';

export const LMP2_PROJECT: Project = {
  id: 'proj-lmp2',
  name: 'LMP2',
  client: 'LMP',
  description: 'LMP2 VFX Breakdown (63 shots)',
  status: 'active',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-09T00:00:00Z',
};

export const LMP2_SHOTS: Shot[] = ${JSON.stringify(lmp2Shots, null, 2)};
`;

fs.writeFileSync(path.join(dataDir, 'lmp2Data.ts'), fileContent, 'utf8');
console.log('Successfully wrote src/data/lmp2Data.ts with ' + lmp2Shots.length + ' shots.');
