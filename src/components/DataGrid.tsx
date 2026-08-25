import { useState, useMemo, useRef, useCallback } from 'react';
import type { ColumnDef } from '../types';
import './DataGrid.css';

interface DataGridProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowUpdate?: (row: T) => void;
  onRowDelete?: (id: string) => void;
  onRowClick?: (row: T) => void;
  onBulkDelete?: (ids: string[]) => void;
  emptyMessage?: string;
  showCheckboxes?: boolean;
}

export default function DataGrid<T extends { id: string }>({
  columns,
  data,
  onRowUpdate,
  onRowDelete,
  onRowClick,
  onBulkDelete,
  emptyMessage = 'No data found',
  showCheckboxes = true,
}: DataGridProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // Sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Filter
  const handleFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Processed data
  const processedData = useMemo(() => {
    let rows = [...data];

    // Apply filters
    for (const [key, val] of Object.entries(filters)) {
      if (!val.trim()) continue;
      const col = columns.find((c) => c.key === key);
      rows = rows.filter((row) => {
        const cellVal = col?.getValue
          ? col.getValue(row)
          : String((row as Record<string, unknown>)[key] ?? '');
        return cellVal.toLowerCase().includes(val.toLowerCase());
      });
    }

    // Apply sort
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      rows.sort((a, b) => {
        const aVal = col?.getValue
          ? col.getValue(a)
          : String((a as Record<string, unknown>)[sortKey] ?? '');
        const bVal = col?.getValue
          ? col.getValue(b)
          : String((b as Record<string, unknown>)[sortKey] ?? '');
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, filters, sortKey, sortDir, columns]);

  // Selection
  const allSelected = processedData.length > 0 && processedData.every((r) => selectedIds.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedData.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Inline editing
  const startEdit = (rowId: string, colKey: string, currentValue: any) => {
    setEditingCell({ rowId, colKey });
    setEditValue(currentValue);
  };

  const commitEdit = (row: T) => {
    if (!editingCell || !onRowUpdate) return;
    const updated = { ...row, [editingCell.colKey]: editValue, updatedAt: new Date().toISOString() };
    onRowUpdate(updated);
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  // Column resize
  const onResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const col = columns.find((c) => c.key === colKey);
    const currentWidth = columnWidths[colKey] || col?.width || col?.minWidth || 120;
    resizingRef.current = { colKey, startX: e.clientX, startWidth: currentWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [resizingRef.current!.colKey]: newWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columns, columnWidths]);

  const getColWidth = (col: ColumnDef<T>) => columnWidths[col.key] || col.width || col.minWidth || 120;

  const hasActiveFilters = Object.values(filters).some((v) => v.trim());

  return (
    <div className="datagrid-wrapper">
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="datagrid-bulk-bar animate-slide-up">
          <span className="bulk-count">{selectedIds.size} selected</span>
          {onBulkDelete && (
            <button className="btn btn-danger btn-sm" onClick={() => { onBulkDelete(Array.from(selectedIds)); setSelectedIds(new Set()); }}>
              Delete Selected
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="datagrid-scroll">
        <table className="datagrid-table">
          <thead>
            {/* Header row */}
            <tr className="datagrid-header-row">
              {showCheckboxes && (
                <th className="datagrid-th datagrid-checkbox-col">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="datagrid-checkbox"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`datagrid-th${col.sortable !== false ? ' sortable' : ''}`}
                  style={{ width: getColWidth(col), minWidth: col.minWidth || 60 }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="th-content">
                    <span className="th-label">{col.label}</span>
                    {col.sortable !== false && sortKey === col.key && (
                      <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                  <div
                    className="col-resize-handle"
                    onMouseDown={(e) => onResizeStart(e, col.key)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
              {onRowDelete && <th className="datagrid-th datagrid-action-col" />}
            </tr>

            {/* Filter row */}
            <tr className="datagrid-filter-row">
              {showCheckboxes && <th className="datagrid-th datagrid-checkbox-col" />}
              {columns.map((col) => (
                <th key={col.key} className="datagrid-th datagrid-filter-cell">
                  {col.filterable !== false && (
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Filter…"
                      value={filters[col.key] || ''}
                      onChange={(e) => handleFilter(col.key, e.target.value)}
                    />
                  )}
                </th>
              ))}
              {onRowDelete && <th className="datagrid-th datagrid-action-col" />}
            </tr>
          </thead>

          <tbody>
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showCheckboxes ? 1 : 0) + (onRowDelete ? 1 : 0)}
                  className="datagrid-empty"
                >
                  <div className="empty-state">
                    <span className="empty-icon">📋</span>
                    <span className="empty-text">{hasActiveFilters ? 'No matching results' : emptyMessage}</span>
                    {hasActiveFilters && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setFilters({})}>
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              processedData.map((row) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`datagrid-row${isSelected ? ' selected' : ''}`}
                    onClick={() => onRowClick && onRowClick(row)}
                  >
                    {showCheckboxes && (
                      <td className="datagrid-td datagrid-checkbox-col" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          className="datagrid-checkbox"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                      const rawValue = (row as Record<string, unknown>)[col.key];
                      const displayValue = col.getValue ? col.getValue(row) : String(rawValue ?? '');

                      return (
                        <td
                          key={col.key}
                          className={`datagrid-td${col.editable ? ' editable' : ''}${isEditing ? ' editing' : ''}`}
                          style={{ width: getColWidth(col), position: col.type === 'multiselect' && isEditing ? 'relative' : undefined }}
                          onDoubleClick={(e) => {
                            if (col.editable && !isEditing) {
                              e.stopPropagation();
                              startEdit(row.id, col.key, rawValue);
                            }
                          }}
                        >
                          {isEditing ? (
                            col.type === 'multiselect' && col.options ? (
                              <div className="cell-edit-multiselect" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', boxShadow: 'var(--shadow-md)', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {col.options.map((opt) => (
                                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                      <input
                                        type="checkbox"
                                        checked={Array.isArray(editValue) && editValue.includes(opt.value)}
                                        onChange={(e) => {
                                          const arr = Array.isArray(editValue) ? [...editValue] : [];
                                          if (e.target.checked) setEditValue([...arr, opt.value]);
                                          else setEditValue(arr.filter((v: string) => v !== opt.value));
                                        }}
                                      />
                                      {opt.label}
                                    </label>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                  <button className="btn btn-primary btn-sm" onClick={() => commitEdit(row)} style={{ flex: 1, padding: '4px' }}>Save</button>
                                  <button className="btn btn-secondary btn-sm" onClick={cancelEdit} style={{ flex: 1, padding: '4px' }}>Cancel</button>
                                </div>
                              </div>
                            ) : col.type === 'select' && col.options ? (
                              <select
                                className="cell-edit-select"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(row)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit(row);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                              >
                                {col.options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : col.type === 'date' ? (
                              <input
                                type="date"
                                className="cell-edit-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(row)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit(row);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                              />
                            ) : (
                              <input
                                type={col.type === 'number' ? 'number' : 'text'}
                                className="cell-edit-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(row)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEdit(row);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                              />
                            )
                          ) : col.render ? (
                            col.render(row)
                          ) : (
                            <span className="cell-text">{displayValue}</span>
                          )}
                        </td>
                      );
                    })}
                    {onRowDelete && (
                      <td className="datagrid-td datagrid-action-col" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-ghost btn-icon row-delete-btn"
                          onClick={() => onRowDelete(row.id)}
                          title="Delete row"
                        >
                          🗑
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="datagrid-footer">
        <span className="datagrid-count">
          {processedData.length} of {data.length} row{data.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </span>
      </div>
    </div>
  );
}
