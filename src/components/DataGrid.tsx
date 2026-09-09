import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { ColumnDef } from '../types';
import './DataGrid.css';

interface DataGridProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowUpdate?: (row: T) => void;
  onRowDelete?: (id: string) => void;
  onRowEditClick?: (row: T) => void;
  onRowClick?: (row: T) => void;
  onBulkDelete?: (ids: string[]) => void;
  renderBulkActions?: (selectedIds: string[], selectedRows: T[]) => React.ReactNode;
  emptyMessage?: string;
  showCheckboxes?: boolean;
}

export default function DataGrid<T extends { id: string }>({
  columns,
  data,
  onRowUpdate,
  onRowDelete,
  onRowEditClick,
  onRowClick,
  onBulkDelete,
  renderBulkActions,
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

  const [popoverSearch, setPopoverSearch] = useState('');

  // Helper for quick date offsets
  const getOffsetDate = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // Inline editing
  const startEdit = (rowId: string, colKey: string, currentValue: any) => {
    setEditingCell({ rowId, colKey });
    setEditValue(currentValue);
    setPopoverSearch('');
  };

  const commitEdit = (row: T) => {
    if (!editingCell || !onRowUpdate) return;
    const updated = { ...row, [editingCell.colKey]: editValue, updatedAt: new Date().toISOString() };
    onRowUpdate(updated);
    setEditingCell(null);
    setPopoverSearch('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setPopoverSearch('');
  };

  // Close editing cell on click outside
  useEffect(() => {
    if (!editingCell) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.cell-edit-popover') && !target.closest('.cell-edit-multiselect') && !target.closest('.editing')) {
        setEditingCell(null);
        setPopoverSearch('');
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [editingCell]);

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
          {renderBulkActions && renderBulkActions(
            Array.from(selectedIds),
            processedData.filter((r) => selectedIds.has(r.id))
          )}
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
              {(onRowDelete || onRowEditClick) && <th className="datagrid-th datagrid-action-col" />}
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
              {(onRowDelete || onRowEditClick) && <th className="datagrid-th datagrid-action-col" />}
            </tr>
          </thead>

          <tbody>
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showCheckboxes ? 1 : 0) + ((onRowDelete || onRowEditClick) ? 1 : 0)}
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
                          style={{
                            width: getColWidth(col),
                            position: col.editable && isEditing ? 'relative' : undefined,
                            zIndex: isEditing ? 100 : undefined,
                          }}
                          onClick={(e) => {
                            if (col.editable && !isEditing) {
                              e.stopPropagation();
                              const val = col.type === 'multiselect'
                                ? (Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' && rawValue.trim() ? rawValue.split(/[,/\\+;&|]+/).map((s: string) => s.trim()).filter(Boolean) : []))
                                : rawValue;
                              startEdit(row.id, col.key, val);
                            }
                          }}
                          onDoubleClick={(e) => {
                            if (col.editable && !isEditing) {
                              e.stopPropagation();
                              const val = col.type === 'multiselect'
                                ? (Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' && rawValue.trim() ? rawValue.split(/[,/\\+;&|]+/).map((s: string) => s.trim()).filter(Boolean) : []))
                                : rawValue;
                              startEdit(row.id, col.key, val);
                            }
                          }}
                        >
                          {/* Cell background display */}
                          {col.render ? (
                            col.render(row)
                          ) : (
                            <span className="cell-text">{displayValue}</span>
                          )}

                          {/* Quick Edit Popover */}
                          {isEditing && (
                            <div
                              className="cell-edit-popover"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="cell-edit-popover-header">
                                <span>{col.type === 'date' ? 'Set' : col.type === 'multiselect' ? 'Select' : 'Edit'} {col.label}</span>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1 }}
                                >
                                  ✕
                                </button>
                              </div>

                              {/* Case 1: Multiselect (Artists, Departments) */}
                              {col.type === 'multiselect' && col.options && (
                                <>
                                  <input
                                    type="text"
                                    className="form-input"
                                    placeholder={`🔍 Search ${col.label.toLowerCase()}...`}
                                    value={popoverSearch}
                                    onChange={(e) => setPopoverSearch(e.target.value)}
                                    autoFocus
                                    style={{ fontSize: 'var(--text-xs)', padding: '5px 8px', height: '28px', width: '100%', background: 'var(--bg-surface)' }}
                                  />
                                  <div className="cell-edit-popover-list">
                                    {col.options
                                      .filter((opt) => {
                                        if (!popoverSearch.trim()) return true;
                                        const q = popoverSearch.trim().toLowerCase();
                                        return opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q);
                                      })
                                      .map((opt) => {
                                        const isChecked = Array.isArray(editValue)
                                          ? editValue.some((v: string) => {
                                              const vL = String(v).toLowerCase();
                                              const optL = opt.value.toLowerCase();
                                              return vL === optL ||
                                                (optL === 'object track' && vL === 'object tracking') ||
                                                (optL === 'camera track' && vL === 'camera tracking');
                                            })
                                          : false;

                                        return (
                                          <label
                                            key={opt.value}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '8px',
                                              cursor: 'pointer',
                                              fontSize: 'var(--text-sm)',
                                              padding: '4px 6px',
                                              borderRadius: 'var(--radius-sm)',
                                              background: isChecked ? 'rgba(255,255,255,0.06)' : 'transparent',
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                const arr = Array.isArray(editValue) ? [...editValue] : [];
                                                if (e.target.checked) {
                                                  setEditValue([...arr, opt.value]);
                                                } else {
                                                  setEditValue(arr.filter((v: string) => {
                                                    const vL = String(v).toLowerCase();
                                                    const optL = opt.value.toLowerCase();
                                                    return vL !== optL &&
                                                      !(optL === 'object track' && vL === 'object tracking') &&
                                                      !(optL === 'camera track' && vL === 'camera tracking');
                                                  }));
                                                }
                                              }}
                                            />
                                            {opt.color && (
                                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                                            )}
                                            <span>{opt.label}</span>
                                          </label>
                                        );
                                      })}
                                  </div>
                                </>
                              )}

                              {/* Case 2: Select (Status, Priority, Delivery, Project) */}
                              {col.type === 'select' && col.options && (
                                <>
                                  {col.options.length > 5 && (
                                    <input
                                      type="text"
                                      className="form-input"
                                      placeholder={`🔍 Search ${col.label.toLowerCase()}...`}
                                      value={popoverSearch}
                                      onChange={(e) => setPopoverSearch(e.target.value)}
                                      autoFocus
                                      style={{ fontSize: 'var(--text-xs)', padding: '5px 8px', height: '28px', width: '100%', background: 'var(--bg-surface)' }}
                                    />
                                  )}
                                  <div className="cell-edit-popover-list">
                                    {col.options
                                      .filter((opt) => {
                                        if (!popoverSearch.trim()) return true;
                                        const q = popoverSearch.trim().toLowerCase();
                                        return opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q);
                                      })
                                      .map((opt) => {
                                        const isSelected = editValue === opt.value;
                                        return (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            className={`cell-edit-select-option${isSelected ? ' selected' : ''}`}
                                            onClick={() => setEditValue(opt.value)}
                                            onDoubleClick={() => {
                                              const updated = { ...row, [col.key]: opt.value, updatedAt: new Date().toISOString() };
                                              if (onRowUpdate) onRowUpdate(updated);
                                              setEditingCell(null);
                                              setPopoverSearch('');
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              {opt.color && (
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                                              )}
                                              <span>{opt.label}</span>
                                            </div>
                                            {isSelected && <span style={{ fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                                          </button>
                                        );
                                      })}
                                  </div>
                                </>
                              )}

                              {/* Case 3: Date (ETA, Final Delivery Date) */}
                              {col.type === 'date' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={editValue || ''}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    autoFocus
                                    style={{ fontSize: 'var(--text-sm)', padding: '6px 8px', height: '32px', width: '100%' }}
                                  />
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditValue(getOffsetDate(0))}>Today</button>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditValue(getOffsetDate(1))}>Tomorrow</button>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditValue(getOffsetDate(3))}>+3 Days</button>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditValue(getOffsetDate(7))}>+1 Wk</button>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditValue('')} style={{ color: 'var(--color-danger)' }}>Clear</button>
                                  </div>
                                </div>
                              )}

                              {/* Case 4: Text or Number input */}
                              {col.type !== 'multiselect' && col.type !== 'select' && col.type !== 'date' && (
                                <input
                                  type={col.type === 'number' ? 'number' : 'text'}
                                  className="form-input"
                                  value={editValue ?? ''}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitEdit(row);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  autoFocus
                                  style={{ fontSize: 'var(--text-sm)', padding: '6px 8px', height: '32px', width: '100%' }}
                                />
                              )}

                              {/* Popover Footer with Save & Cancel Buttons */}
                              <div className="cell-edit-popover-footer">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => commitEdit(row)}
                                  style={{ flex: 1, padding: '5px 10px', fontSize: 'var(--text-xs)', fontWeight: 600 }}
                                >
                                  ✓ Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={cancelEdit}
                                  style={{ flex: 1, padding: '5px 10px', fontSize: 'var(--text-xs)' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {(onRowDelete || onRowEditClick) && (
                      <td className="datagrid-td datagrid-action-col" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          {onRowEditClick && (
                            <button
                              className="btn btn-ghost btn-icon"
                              onClick={() => onRowEditClick(row)}
                              title="Edit row"
                            >
                              ✏️
                            </button>
                          )}
                          {onRowDelete && (
                            <button
                              className="btn btn-ghost btn-icon row-delete-btn"
                              onClick={() => onRowDelete(row.id)}
                              title="Delete row"
                            >
                              🗑
                            </button>
                          )}
                        </div>
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
