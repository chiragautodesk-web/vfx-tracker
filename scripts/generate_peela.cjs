const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelDir = path.join(__dirname, '..', 'Excel');
if (!fs.existsSync(excelDir)) {
  fs.mkdirSync(excelDir, { recursive: true });
}

const dataDir = path.join(__dirname, '..', 'src', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sourceCsvPath = 'D:/Project/PEELA_Submissions/Master_Excel/FILM TEMPLATE - VFX STATUS REPORTING v1 - SHOTS.csv';
const targetCsvPath = path.join(excelDir, 'PEELA_VFX_Breakdown.csv');
const targetXlsxPath = path.join(excelDir, 'PEELA_VFX_Breakdown.xlsx');

// Copy CSV to Excel folder
fs.copyFileSync(sourceCsvPath, targetCsvPath);

const wb = xlsx.readFile(sourceCsvPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws);

// Also write XLSX version
xlsx.writeFile(wb, targetXlsxPath);

const notesMap = {
  'PEEL_101_SH_4840': 'Need Annotation, EXR is not matching with offline',
  'PEEL_101_SH_4930': 'Need Annotation',
  'PEEL_101_SH_4940': 'Need Annotation',
  'PEEL_101_SH_4950': 'Need Annotation',
  'PEEL_101_SH_4960': 'Need Annotation',
  'PEEL_101_SH_4970': 'Need Annotation',
  'PEEL_101_SH_4990': 'Need Annotation',
  'PEEL_101_SH_5000': 'Need Annotation, EXR is not matching with offline',
};

const peelaShots = rows.map((r, i) => {
  const shotName = String(r['Shot Name'] || '').trim();
  const scopeOfWork = String(r['Scope of Work'] || '').trim();
  const methodology = String(r['Shot Methodologies'] || 'CLEANUP').trim();
  const vendor = String(r['Vendors'] || 'Satya Sai VFX studio').trim();
  const rawStatus = String(r['VFX Shot Status'] || '').trim().toUpperCase();

  // Status mapping
  let status = 'pending';
  if (rawStatus === 'WIP' || rawStatus === 'IN PROGRESS') status = 'in-progress';
  else if (rawStatus === 'REV' || rawStatus === 'REVIEW') status = 'internal-review';
  else if (rawStatus === 'APP' || rawStatus === 'APPROVED') status = 'approved';
  else if (rawStatus === 'DEL' || rawStatus === 'DELIVERED') status = 'delivered';
  else if (rawStatus === 'FB' || rawStatus === 'FEEDBACK') status = 'client-feedback';

  const note = notesMap[shotName] || String(r['Report Note'] || '').trim();

  let desc = `Methodology: ${methodology}`;
  if (vendor) desc += ` | Vendor: ${vendor}`;

  return {
    id: 'peela-shot-' + String(i + 1).padStart(3, '0'),
    projectId: 'proj-peela',
    shotNumber: shotName,
    shotName: shotName,
    scopeOfWork: scopeOfWork,
    department: ['Prep'],
    description: desc,
    notes: note,
    artistIds: [],
    status: status,
    priority: 'medium',
    eta: '',
    finalDeliveryDate: '',
    deliveryStatus: 'pending',
    clientFeedback: [],
    createdAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-10T00:00:00Z',
  };
});

const fileContent = `// Auto-generated from Excel/PEELA_VFX_Breakdown.csv
import type { Project, Shot } from '../types';

export const PEELA_PROJECT: Project = {
  id: 'proj-peela',
  name: 'PEELA',
  client: 'Satya Sai VFX studio',
  description: 'PEELA VFX Breakdown & Shot Status (288 shots)',
  status: 'active',
  createdAt: '2026-09-09T00:00:00Z',
  updatedAt: '2026-09-10T00:00:00Z',
};

export const PEELA_SHOTS: Shot[] = ${JSON.stringify(peelaShots, null, 2)};
`;

fs.writeFileSync(path.join(dataDir, 'peelaData.ts'), fileContent, 'utf8');
console.log('Successfully wrote src/data/peelaData.ts with ' + peelaShots.length + ' shots.');
