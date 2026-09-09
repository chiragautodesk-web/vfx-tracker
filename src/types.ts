// ===== Projects =====
export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  status: 'active' | 'on-hold' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  excelMapping?: Record<string, string>;
}

// ===== Shots =====
export type ShotStatus =
  | 'in-progress'
  | 'wip'
  | 'pending'
  | 'internal-review'
  | 'client-review'
  | 'client-feedback'
  | 'changes-required'
  | 'approved'
  | 'delivered';

export type DeliveryStatus =
  | 'pending'
  | 'to-be-delivered'
  | 'delivered'
  | 'overdue';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface ClientFeedback {
  id: string;
  shotId: string;
  date: string;
  note: string;
  type: 'kickback' | 'modification' | 'feedback';
}

export type Department =
  | 'Roto'
  | 'Prep'
  | 'Object Track'
  | 'Camera Track'
  | 'Object Tracking'
  | 'Camera Tracking'
  | 'Matchmove'
  | 'Paint'
  | 'Comp'
  | string;

export interface Shot {
  id: string;
  projectId: string;
  shotNumber?: string;
  shotName: string;
  scopeOfWork?: string;
  department?: Department[] | Department | string[] | string;
  departments?: Department[];
  description: string;
  notes?: string;
  artistIds: string[];
  status: ShotStatus;
  priority: Priority;
  eta: string;
  finalDeliveryDate: string;
  deliveryStatus: DeliveryStatus;
  clientFeedback: ClientFeedback[];
  createdAt: string;
  updatedAt: string;
}

// ===== Artists =====
export interface Artist {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
}

// ===== Department options =====
export interface DepartmentOption {
  value: Department;
  label: string;
  color: string;
}

export const DEPARTMENT_OPTIONS: DepartmentOption[] = [
  { value: 'Roto',             label: 'Roto',             color: '#8b5cf6' },
  { value: 'Prep',             label: 'Prep',             color: '#f59e0b' },
  { value: 'Object Tracking',  label: 'Object Tracking',  color: '#059669' },
  { value: 'Camera Tracking',  label: 'Camera Tracking',  color: '#0284c7' },
  { value: 'Matchmove',        label: 'Matchmove',        color: '#06b6d4' },
  { value: 'Paint',            label: 'Paint',            color: '#f97316' },
  { value: 'Comp',             label: 'Comp',             color: '#ec4899' },
];

// ===== Status options =====
export interface StatusOption {
  value: ShotStatus;
  label: string;
  color: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending',          label: 'Pending',                  color: '#64748b' },
  { value: 'in-progress',      label: 'In Progress',              color: '#0284c7' },
  { value: 'wip',              label: 'WIP',                      color: '#7c3aed' },
  { value: 'internal-review',  label: 'Internal Review',          color: '#d97706' },
  { value: 'client-review',    label: 'Client Review',            color: '#ea580c' },
  { value: 'client-feedback',  label: 'Client Feedback / Kickback', color: '#dc2626' },
  { value: 'changes-required', label: 'Changes Required',         color: '#be185d' },
  { value: 'approved',         label: 'Approved',                 color: '#059669' },
  { value: 'delivered',        label: 'Delivered',                 color: '#0891b2' },
];

export const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatus; label: string; color: string }[] = [
  { value: 'pending',          label: 'Pending',          color: '#64748b' },
  { value: 'to-be-delivered',  label: 'To Be Delivered',  color: '#d97706' },
  { value: 'delivered',        label: 'Delivered',        color: '#059669' },
  { value: 'overdue',          label: 'Overdue',          color: '#dc2626' },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: '#64748b' },
  { value: 'medium',   label: 'Medium',   color: '#0284c7' },
  { value: 'high',     label: 'High',     color: '#ea580c' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
];

export const PROJECT_STATUS_OPTIONS: { value: Project['status']; label: string; color: string }[] = [
  { value: 'active',    label: 'Active',    color: '#059669' },
  { value: 'on-hold',   label: 'On Hold',   color: '#d97706' },
  { value: 'completed', label: 'Completed', color: '#0284c7' },
  { value: 'archived',  label: 'Archived',  color: '#64748b' },
];

// ===== DataGrid Column Definition =====
export interface ColumnDef<T> {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  type?: 'text' | 'select' | 'date' | 'badge' | 'number' | 'readonly' | 'multiselect';
  options?: { value: string; label: string; color?: string }[];
  render?: (row: T) => React.ReactNode;
  getValue?: (row: T) => string;
}

// ===== App State =====
export interface AppState {
  projects: Project[];
  shots: Shot[];
  artists: Artist[];
  activeTab: TabId;
  selectedProjectId: string | null;
}

export type TabId = 'today' | 'projects' | 'shots' | 'status' | 'eta' | 'artists';

// ===== Actions =====
export type AppAction =
  | { type: 'SET_TAB'; payload: TabId }
  | { type: 'SELECT_PROJECT'; payload: string | null }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'ADD_SHOT'; payload: Shot }
  | { type: 'UPDATE_SHOT'; payload: Shot }
  | { type: 'DELETE_SHOT'; payload: string }
  | { type: 'DELETE_SHOTS'; payload: string[] }
  | { type: 'ADD_ARTIST'; payload: Artist }
  | { type: 'UPDATE_ARTIST'; payload: Artist }
  | { type: 'DELETE_ARTIST'; payload: string }
  | { type: 'ADD_FEEDBACK'; payload: ClientFeedback }
  | { type: 'SYNC_EXCEL_SHOTS'; payload: { projectId: string; added: Shot[]; updated: Shot[] } }
  | { type: 'RESET_FOR_NEW_PROJECT'; payload?: { newProjectName?: string } }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };
