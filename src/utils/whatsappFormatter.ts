// WhatsApp message formatting utilities for PEELA VFX Tracker

export type FormatStyle = 'simple' | 'executive' | 'grid';

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

// 1. Simple Clean Notes (Default as requested by user: Project Name at top, then 1. [Shot] [Notes])
export function formatSimpleCleanNotes(
  items: Array<{ shotName: string; notes?: string }>,
  projectName?: string
): string {
  if (items.length === 0) return '';
  const lines: string[] = [];

  const pName = projectName ? projectName.trim() : '';
  if (pName) {
    lines.push(`Project: ${pName}`);
  }

  items.forEach((item, index) => {
    const num = index + 1;
    const shot = item.shotName || 'Unnamed Shot';
    const note = (item.notes || '').trim() || '—';
    lines.push(`${num}. ${shot}   ${note}`);
  });

  return lines.join('\n\n');
}

// 2. Executive Studio Card
export function formatExecutiveCard(
  items: Array<{ shotName: string; notes?: string; scopeOfWork?: string; department?: any }>,
  projectName?: string,
  options: { includeHeader?: boolean; includeTimestamp?: boolean } = {}
): string {
  if (items.length === 0) return '';
  const { includeHeader = true, includeTimestamp = true } = options;

  const lines: string[] = [];
  if (includeHeader) {
    lines.push('🎬 *SSVFX STUDIO | SHOT NOTES UPDATE*');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (projectName) lines.push(`📁 *Project:* ${projectName}`);
    lines.push(`🎯 *Total Shots:* ${items.length}`);
    if (includeTimestamp) {
      const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      lines.push(`📅 *Date:* ${nowStr}`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  items.forEach((item, index) => {
    lines.push(`🔹 *${item.shotName || 'Unnamed Shot'}*`);

    const details: string[] = [];
    if (item.scopeOfWork) details.push(`🏷️ *Scope:* ${item.scopeOfWork}`);
    if (item.department) {
      const depts = Array.isArray(item.department) ? item.department.join(', ') : String(item.department);
      if (depts) details.push(`🎨 *Dept:* ${depts}`);
    }

    const noteText = (item.notes || '—').trim();
    const noteLines = noteText.split(/\r?\n/).filter(Boolean);
    if (noteLines.length === 0) noteLines.push('—');

    if (details.length > 0) {
      details.forEach((d, i) => {
        const prefix = i === 0 ? '┌ ' : '├ ';
        lines.push(prefix + d);
      });
      lines.push('└ 📝 *Notes:*');
      noteLines.forEach((nl) => lines.push(`   ${nl}`));
    } else {
      lines.push('📝 *Notes:*');
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

// 3. Clean Executive List
export function formatCleanList(
  items: Array<{ shotName: string; notes?: string; scopeOfWork?: string; department?: any }>,
  projectName?: string,
  options: { includeHeader?: boolean; includeTimestamp?: boolean } = {}
): string {
  if (items.length === 0) return '';
  const { includeHeader = true, includeTimestamp = true } = options;

  const lines: string[] = [];
  if (includeHeader) {
    lines.push('🎬 *SSVFX STUDIO | SHOT NOTES*');
    if (projectName) lines.push(`📁 *Project:* ${projectName}  •  🎯 *Total:* ${items.length} Shots`);
    if (includeTimestamp) {
      const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      lines.push(`📅 *Date:* ${nowStr}`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  items.forEach((item, idx) => {
    lines.push(`*${idx + 1}. ${item.shotName || 'Unnamed Shot'}*`);
    const note = (item.notes || '').trim() || '—';
    lines.push(`📝 ${note}`);
    if (item.scopeOfWork) lines.push(`🏷️ Scope: ${item.scopeOfWork}`);
    if (idx < items.length - 1) lines.push('');
  });

  lines.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('_Sent via PEELA VFX Tracker_');
  return lines.join('\n');
}

// 4. Unicode Studio Grid
export function formatStudioGrid(
  items: Array<{ shotName: string; notes?: string }>,
  projectName?: string,
  options: { includeHeader?: boolean; includeTimestamp?: boolean } = {}
): string {
  if (items.length === 0) return '';
  const { includeHeader = true, includeTimestamp = true } = options;

  const maxShotLen = Math.max(9, ...items.map((s) => (s.shotName || '').length));
  const shotColWidth = Math.min(22, Math.max(12, maxShotLen));
  const notesColWidth = 38;

  const pad = (str: string, len: number) => {
    if (str.length > len) return str.slice(0, len - 1) + '…';
    return str + ' '.repeat(Math.max(0, len - str.length));
  };

  const topBorder = '╔' + '═'.repeat(shotColWidth + 2) + '╦' + '═'.repeat(notesColWidth + 2) + '╗';
  const midBorder = '╠' + '═'.repeat(shotColWidth + 2) + '╬' + '═'.repeat(notesColWidth + 2) + '╣';
  const botBorder = '╚' + '═'.repeat(shotColWidth + 2) + '╩' + '═'.repeat(notesColWidth + 2) + '╝';
  const header = '║ ' + pad('Shot Name', shotColWidth) + ' ║ ' + pad('Notes', notesColWidth) + ' ║';

  const tableLines = [topBorder, header, midBorder];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const rawShot = item.shotName || 'N/A';
    const noteText = (item.notes || '').trim() || '—';

    const paragraphs = noteText.split(/\r?\n/);
    const wrappedNoteLines: string[] = [];
    for (const p of paragraphs) {
      wrappedNoteLines.push(...wrapText(p, notesColWidth));
    }
    if (wrappedNoteLines.length === 0) wrappedNoteLines.push('—');

    tableLines.push('║ ' + pad(rawShot, shotColWidth) + ' ║ ' + pad(wrappedNoteLines[0], notesColWidth) + ' ║');
    for (let i = 1; i < wrappedNoteLines.length; i++) {
      tableLines.push('║ ' + pad('', shotColWidth) + ' ║ ' + pad(wrappedNoteLines[i], notesColWidth) + ' ║');
    }

    if (idx < items.length - 1) {
      tableLines.push(midBorder);
    }
  }

  tableLines.push(botBorder);
  const tableOutput = tableLines.join('\n');

  const headerParts: string[] = [];
  if (includeHeader) {
    headerParts.push('🎬 *SSVFX STUDIO | SHOT NOTES TABLE*');
    if (projectName) headerParts.push(`📁 *Project:* ${projectName}`);
    headerParts.push(`🎯 *Total Shots:* ${items.length}`);
    if (includeTimestamp) {
      const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      headerParts.push(`📅 *Date:* ${nowStr}`);
    }
    headerParts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  return [...headerParts, '```', tableOutput, '```', '', '_Sent via PEELA VFX Tracker_'].filter(Boolean).join('\n');
}
