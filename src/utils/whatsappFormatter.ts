// WhatsApp message formatting utilities for PEELA VFX Tracker

export type FormatStyle = 'table' | 'simple' | 'executive' | 'grid';

export type MessageFieldKey =
  | 'shotName'
  | 'status'
  | 'eta'
  | 'department'
  | 'notes'
  | 'artist'
  | 'scopeOfWork'
  | 'priority'
  | 'project';

export interface FieldOption {
  key: MessageFieldKey;
  label: string;
  shortLabel: string;
  icon?: string;
  defaultChecked: boolean;
}

export const MESSAGE_FIELD_OPTIONS: FieldOption[] = [
  { key: 'shotName',    label: 'Shot Number',   shortLabel: 'Shot',     defaultChecked: true },
  { key: 'status',      label: 'Status',        shortLabel: 'Status',   defaultChecked: true },
  { key: 'eta',         label: 'ETA',           shortLabel: 'ETA',      defaultChecked: true },
  { key: 'department',  label: 'Department',    shortLabel: 'Dept',     defaultChecked: false },
  { key: 'notes',       label: 'Notes',         shortLabel: 'Notes',    defaultChecked: false },
  { key: 'artist',      label: 'Artist',        shortLabel: 'Artist',   defaultChecked: false },
  { key: 'scopeOfWork', label: 'Scope of Work', shortLabel: 'Scope',    defaultChecked: false },
  { key: 'priority',    label: 'Priority',      shortLabel: 'Priority', defaultChecked: false },
  { key: 'project',     label: 'Project',       shortLabel: 'Project',  defaultChecked: false },
];

export interface ShotMessageData {
  id?: string;
  shotName: string;
  shotNumber?: string;
  scopeOfWork?: string;
  department?: string;
  notes?: string;
  project?: string;
  artist?: string;
  status?: string;
  priority?: string;
  eta?: string;
}

/** Formats ETA date nicely to match studio standard (e.g. 10 Sept 2026) */
export function formatEtaDate(dateStr?: string): string {
  if (!dateStr || dateStr === '—') return '—';
  const str = String(dateStr).trim();
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  if (ymd) {
    const year = ymd[1];
    const monthIdx = parseInt(ymd[2], 10) - 1;
    const day = parseInt(ymd[3], 10);
    const month = months[monthIdx] || ymd[2];
    return `${day} ${month} ${year}`;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Formats shots as a clean monospace tabular report with aligned columns,
 * matching WhatsApp code-block layout (`Shot Number   Status   ETA ...`).
 */
export function formatMonospaceTable(
  items: ShotMessageData[],
  fields: Record<MessageFieldKey, boolean>,
  projectName?: string
): string {
  if (items.length === 0) return '';

  const COLUMN_SPECS: Array<{
    key: MessageFieldKey;
    header: string;
    minWidth: number;
    getValue: (item: ShotMessageData) => string;
  }> = [
    {
      key: 'shotName',
      header: 'Shot Number',
      minWidth: 21,
      getValue: (i) => i.shotNumber || i.shotName || '—',
    },
    {
      key: 'status',
      header: 'Status',
      minWidth: 16,
      getValue: (i) => i.status || '—',
    },
    {
      key: 'eta',
      header: 'ETA',
      minWidth: 16,
      getValue: (i) => formatEtaDate(i.eta),
    },
    {
      key: 'department',
      header: 'Department',
      minWidth: 15,
      getValue: (i) => i.department || '—',
    },
    {
      key: 'notes',
      header: 'Notes',
      minWidth: 15,
      getValue: (i) => i.notes || '—',
    },
    {
      key: 'artist',
      header: 'Artist',
      minWidth: 15,
      getValue: (i) => i.artist || '—',
    },
    {
      key: 'scopeOfWork',
      header: 'Scope',
      minWidth: 12,
      getValue: (i) => i.scopeOfWork || '—',
    },
    {
      key: 'priority',
      header: 'Priority',
      minWidth: 10,
      getValue: (i) => i.priority || '—',
    },
    {
      key: 'project',
      header: 'Project',
      minWidth: 12,
      getValue: (i) => i.project || projectName || '—',
    },
  ];

  // Filter to active columns
  const activeCols = COLUMN_SPECS.filter((col) => fields[col.key]);
  if (activeCols.length === 0) {
    activeCols.push(COLUMN_SPECS[0]);
  }

  // Calculate width for each column
  const colWidths = activeCols.map((col, idx) => {
    let maxContent = col.header.length;
    for (const item of items) {
      const val = col.getValue(item) || '—';
      if (val.length > maxContent) maxContent = val.length;
    }
    const isLast = idx === activeCols.length - 1;
    const base = Math.max(maxContent, col.minWidth);
    return isLast ? maxContent : Math.max(base, maxContent + 4);
  });

  // Header line
  const headerLine = activeCols
    .map((c, i) => (i === activeCols.length - 1 ? c.header : c.header.padEnd(colWidths[i], ' ')))
    .join('');

  let maxLineWidth = headerLine.length;

  // Row lines
  const rowLines = items.map((item) => {
    const line = activeCols
      .map((c, i) => {
        const val = c.getValue(item) || '—';
        return i === activeCols.length - 1 ? val : val.padEnd(colWidths[i], ' ');
      })
      .join('');
    if (line.length > maxLineWidth) maxLineWidth = line.length;
    return line;
  });

  const divider = '-'.repeat(Math.max(headerLine.length, maxLineWidth));

  // Monospace code block for WhatsApp
  return '```\n' + [headerLine, divider, ...rowLines].join('\n') + '\n```';
}

export function wrapText(text: string, maxWidth: number): string[] {
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

// 1. Customizable Simple Clean Format
export function formatCustomSimpleNotes(
  items: ShotMessageData[],
  fields: Record<MessageFieldKey, boolean>,
  projectName?: string
): string {
  if (items.length === 0) return '';
  const lines: string[] = [];

  const pName = projectName ? projectName.trim() : '';
  if (fields.project && pName) {
    lines.push(`Project: ${pName}`);
    lines.push('');
  }

  // Active detail fields (other than shotName and project)
  const detailFieldKeys: MessageFieldKey[] = [
    'scopeOfWork',
    'department',
    'artist',
    'status',
    'priority',
    'eta',
    'notes',
  ];
  const activeDetailKeys = detailFieldKeys.filter((k) => fields[k]);

  // Special compact case: Only Shot Name and Notes are checked (Classic compact format)
  if (activeDetailKeys.length === 1 && activeDetailKeys[0] === 'notes' && fields.shotName) {
    const compactLines: string[] = [];
    if (fields.project && pName) {
      compactLines.push(`Project: ${pName}`);
    }
    items.forEach((item, index) => {
      const num = index + 1;
      const shot = item.shotName || 'Unnamed Shot';
      const note = (item.notes || '').trim() || '—';
      compactLines.push(`${num}. ${shot}   ${note}`);
    });
    return compactLines.join('\n\n');
  }

  // General case: Format each shot with selected fields
  items.forEach((item, index) => {
    const num = index + 1;
    const shotLabel = fields.shotName ? (item.shotName || 'Unnamed Shot') : `Shot #${num}`;
    
    // Header line
    lines.push(`${num}. *${shotLabel}*`);

    // Details indented
    const details: string[] = [];

    if (fields.project && item.project && !pName) {
      details.push(`   • Project: ${item.project}`);
    }
    if (fields.scopeOfWork && item.scopeOfWork && item.scopeOfWork !== '—') {
      details.push(`   • Scope: ${item.scopeOfWork}`);
    }
    if (fields.department && item.department && item.department !== '—') {
      details.push(`   • Dept: ${item.department}`);
    }
    if (fields.artist && item.artist && item.artist !== '—') {
      details.push(`   • Artist: ${item.artist}`);
    }
    if (fields.status && item.status && item.status !== '—') {
      const pText = fields.priority && item.priority && item.priority !== '—' ? ` | Priority: ${item.priority}` : '';
      details.push(`   • Status: ${item.status}${pText}`);
    } else if (fields.priority && item.priority && item.priority !== '—') {
      details.push(`   • Priority: ${item.priority}`);
    }
    if (fields.eta && item.eta && item.eta !== '—') {
      details.push(`   • ETA: ${item.eta}`);
    }
    if (fields.notes) {
      const note = (item.notes || '').trim() || '—';
      details.push(`   • Notes: ${note}`);
    }

    if (details.length > 0) {
      lines.push(details.join('\n'));
    }
  });

  return lines.join('\n\n');
}

// 2. Customizable Executive Card
export function formatCustomExecutiveCard(
  items: ShotMessageData[],
  fields: Record<MessageFieldKey, boolean>,
  projectName?: string,
  options: { includeHeader?: boolean; includeTimestamp?: boolean } = {}
): string {
  if (items.length === 0) return '';
  const { includeHeader = true, includeTimestamp = true } = options;

  const lines: string[] = [];
  if (includeHeader) {
    lines.push('🎬 *SSVFX STUDIO | SHOT UPDATE*');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (fields.project && projectName) lines.push(`📁 *Project:* ${projectName}`);
    lines.push(`🎯 *Total Shots:* ${items.length}`);
    if (includeTimestamp) {
      const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      lines.push(`📅 *Date:* ${nowStr}`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  items.forEach((item, index) => {
    const num = index + 1;
    const shotLabel = fields.shotName ? (item.shotName || 'Unnamed Shot') : `Shot #${num}`;
    lines.push(`🔹 *${num}. ${shotLabel}*`);

    const details: string[] = [];
    if (fields.project && item.project) {
      details.push(`📁 *Project:* ${item.project}`);
    }
    if (fields.scopeOfWork && item.scopeOfWork && item.scopeOfWork !== '—') {
      details.push(`🏷️ *Scope:* ${item.scopeOfWork}`);
    }
    if (fields.department && item.department && item.department !== '—') {
      details.push(`🎨 *Dept:* ${item.department}`);
    }
    if (fields.artist && item.artist && item.artist !== '—') {
      details.push(`👤 *Artist:* ${item.artist}`);
    }
    if (fields.status && item.status && item.status !== '—') {
      details.push(`⚡ *Status:* ${item.status}`);
    }
    if (fields.priority && item.priority && item.priority !== '—') {
      details.push(`🔥 *Priority:* ${item.priority}`);
    }
    if (fields.eta && item.eta && item.eta !== '—') {
      details.push(`📅 *ETA:* ${item.eta}`);
    }

    if (details.length > 0) {
      details.forEach((d, i) => {
        const hasNotes = fields.notes;
        const prefix = (i === details.length - 1 && !hasNotes) ? '└ ' : '├ ';
        lines.push(prefix + d);
      });
    }

    if (fields.notes) {
      const noteText = (item.notes || '—').trim();
      const noteLines = noteText.split(/\r?\n/).filter(Boolean);
      if (noteLines.length === 0) noteLines.push('—');

      lines.push('└ 📝 *Notes:*');
      noteLines.forEach((nl) => lines.push(`   ${nl}`));
    }

    if (index < items.length - 1) {
      lines.push('\n────────────────────────────\n');
    }
  });

  lines.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('_Sent via PEELA VFX Tracker_');
  return lines.join('\n');
}

// 3. Customizable Unicode Studio Grid
export function formatCustomStudioGrid(
  items: ShotMessageData[],
  fields: Record<MessageFieldKey, boolean>,
  projectName?: string,
  options: { includeHeader?: boolean; includeTimestamp?: boolean } = {}
): string {
  if (items.length === 0) return '';
  const { includeHeader = true, includeTimestamp = true } = options;

  interface ColumnDef {
    key: string;
    header: string;
    width: number;
    getValue: (item: ShotMessageData, idx: number) => string;
  }

  const columns: ColumnDef[] = [
    { key: 'num', header: '#', width: 3, getValue: (_, idx) => String(idx + 1) },
  ];

  if (fields.shotName) {
    const maxShot = Math.min(20, Math.max(9, ...items.map((s) => (s.shotName || '').length)));
    columns.push({ key: 'shot', header: 'Shot Name', width: maxShot, getValue: (s) => s.shotName || 'N/A' });
  }
  if (fields.department) {
    columns.push({ key: 'dept', header: 'Dept', width: 8, getValue: (s) => s.department || '—' });
  }
  if (fields.status) {
    columns.push({ key: 'status', header: 'Status', width: 11, getValue: (s) => s.status || '—' });
  }
  if (fields.artist) {
    columns.push({ key: 'artist', header: 'Artist', width: 12, getValue: (s) => s.artist || '—' });
  }
  if (fields.eta) {
    columns.push({ key: 'eta', header: 'ETA', width: 11, getValue: (s) => s.eta || '—' });
  }
  if (fields.scopeOfWork) {
    columns.push({ key: 'scope', header: 'Scope', width: 18, getValue: (s) => s.scopeOfWork || '—' });
  }
  if (fields.notes) {
    columns.push({ key: 'notes', header: 'Notes', width: 26, getValue: (s) => s.notes || '—' });
  }

  const pad = (str: string, len: number) => {
    if (str.length > len) return str.slice(0, len - 1) + '…';
    return str + ' '.repeat(Math.max(0, len - str.length));
  };

  const topBorder = '╔' + columns.map((c) => '═'.repeat(c.width + 2)).join('╦') + '╗';
  const midBorder = '╠' + columns.map((c) => '═'.repeat(c.width + 2)).join('╬') + '╣';
  const botBorder = '╚' + columns.map((c) => '═'.repeat(c.width + 2)).join('╩') + '╝';

  const headerLine = '║' + columns.map((c) => ' ' + pad(c.header, c.width) + ' ').join('║') + '║';
  const tableLines: string[] = [topBorder, headerLine, midBorder];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    
    // Check multiline for notes/scope
    const colWrapped = columns.map((c) => {
      const val = c.getValue(item, idx).trim();
      const paras = val.split(/\r?\n/);
      const wrapped: string[] = [];
      paras.forEach((p) => wrapped.push(...wrapText(p, c.width)));
      return wrapped.length > 0 ? wrapped : ['—'];
    });

    const maxLinesInRow = Math.max(1, ...colWrapped.map((cw) => cw.length));

    for (let r = 0; r < maxLinesInRow; r++) {
      const lineCells = columns.map((c, cIdx) => {
        const text = colWrapped[cIdx][r] || '';
        return ' ' + pad(text, c.width) + ' ';
      });
      tableLines.push('║' + lineCells.join('║') + '║');
    }

    if (idx < items.length - 1) {
      tableLines.push(midBorder);
    }
  }

  tableLines.push(botBorder);
  const tableOutput = tableLines.join('\n');

  const headerParts: string[] = [];
  if (includeHeader) {
    headerParts.push('🎬 *SSVFX STUDIO | SHOT DATA TABLE*');
    if (fields.project && projectName) headerParts.push(`📁 *Project:* ${projectName}`);
    headerParts.push(`🎯 *Total Shots:* ${items.length}`);
    if (includeTimestamp) {
      const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      headerParts.push(`📅 *Date:* ${nowStr}`);
    }
    headerParts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  return [...headerParts, '```', tableOutput, '```', '', '_Sent via PEELA VFX Tracker_'].filter(Boolean).join('\n');
}

// Backwards-compatible convenience helpers
export function formatSimpleCleanNotes(
  items: Array<{ shotName: string; notes?: string }>,
  projectName?: string
): string {
  const converted: ShotMessageData[] = items.map((i) => ({
    shotName: i.shotName,
    notes: i.notes,
  }));
  return formatCustomSimpleNotes(
    converted,
    {
      shotName: true,
      notes: true,
      scopeOfWork: false,
      department: false,
      project: false,
      artist: false,
      status: false,
      priority: false,
      eta: false,
    },
    projectName
  );
}

export function formatExecutiveCard(
  items: Array<{ shotName: string; notes?: string; scopeOfWork?: string; department?: any }>,
  projectName?: string,
  options?: { includeHeader?: boolean; includeTimestamp?: boolean }
): string {
  const converted: ShotMessageData[] = items.map((i) => ({
    shotName: i.shotName,
    notes: i.notes,
    scopeOfWork: i.scopeOfWork,
    department: Array.isArray(i.department) ? i.department.join(', ') : (i.department ? String(i.department) : undefined),
  }));
  return formatCustomExecutiveCard(
    converted,
    {
      shotName: true,
      notes: true,
      scopeOfWork: true,
      department: true,
      project: true,
      artist: false,
      status: false,
      priority: false,
      eta: false,
    },
    projectName,
    options
  );
}

export function formatStudioGrid(
  items: Array<{ shotName: string; notes?: string }>,
  projectName?: string,
  options?: { includeHeader?: boolean; includeTimestamp?: boolean }
): string {
  const converted: ShotMessageData[] = items.map((i) => ({
    shotName: i.shotName,
    notes: i.notes,
  }));
  return formatCustomStudioGrid(
    converted,
    {
      shotName: true,
      notes: true,
      scopeOfWork: false,
      department: false,
      project: false,
      artist: false,
      status: false,
      priority: false,
      eta: false,
    },
    projectName,
    options
  );
}
