import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AppState, AppAction, Project, Shot, Artist } from './types';
import { now, today, generateId } from './utils';
import { supabase } from './supabaseClient';

/** Returns YYYY-MM-DD offset from today */
function daysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

// ===== Local Storage =====
const STORAGE_KEY = 'vfx-shot-tracker';

function loadFromStorage(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveToStorage(state: AppState): void {
  try {
    const { projects, shots, artists } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, shots, artists }));
  } catch { /* ignore */ }
}

// ===== Seed Data =====
function createSeedData(): { projects: Project[]; shots: Shot[]; artists: Artist[] } {
  const artists: Artist[] = [
    { id: 'artist-1', name: 'Rahul Sharma', email: 'rahul@studio.com', role: 'Compositor', avatarColor: '#3b82f6' },
    { id: 'artist-2', name: 'Priya Patel', email: 'priya@studio.com', role: 'FX Artist', avatarColor: '#8b5cf6' },
    { id: 'artist-3', name: 'Amit Kumar', email: 'amit@studio.com', role: 'Roto Artist', avatarColor: '#10b981' },
    { id: 'artist-4', name: 'Sneha Reddy', email: 'sneha@studio.com', role: 'Paint Artist', avatarColor: '#f59e0b' },
  ];

  const projects: Project[] = [
    {
      id: 'proj-1', name: 'Dragon Quest VFX', client: 'Marvel Studios',
      description: 'Full CG dragon sequences for hero shots',
      status: 'active', createdAt: '2026-07-01T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'proj-2', name: 'City Destruction Seq', client: 'Warner Bros',
      description: 'Large-scale city destruction with particle FX',
      status: 'active', createdAt: '2026-07-15T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'proj-3', name: 'Underwater World', client: 'Netflix',
      description: 'Deep-sea environment creation and creature FX',
      status: 'on-hold', createdAt: '2026-06-20T00:00:00Z', updatedAt: now(),
    },
  ];

  const shots: Shot[] = [
    {
      id: 'shot-1', projectId: 'proj-1', shotNumber: 'DQ_010', shotName: 'Dragon Reveal',
      scopeOfWork: 'Dragon wireframe & texture cleanup', department: 'Roto',
      description: 'Full CG dragon emerging from mountain',
      artistIds: ['artist-1'], status: 'in-progress', priority: 'critical',
      eta: daysFromNow(0), finalDeliveryDate: daysFromNow(0), deliveryStatus: 'to-be-delivered',
      clientFeedback: [
        { id: 'fb-1', shotId: 'shot-1', date: daysFromNow(-3), note: 'Scale of dragon needs to be 20% larger', type: 'feedback' },
      ],
      createdAt: daysFromNow(-30) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-2', projectId: 'proj-1', shotNumber: 'DQ_020', shotName: 'Dragon Flight',
      scopeOfWork: 'Canyon tracking markers & camera solve', department: 'Camera Tracking',
      description: 'Dragon flying over canyon',
      artistIds: ['artist-2'], status: 'wip', priority: 'high',
      eta: daysFromNow(0), finalDeliveryDate: daysFromNow(1), deliveryStatus: 'to-be-delivered',
      clientFeedback: [],
      createdAt: daysFromNow(-25) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-3', projectId: 'proj-1', shotNumber: 'DQ_030', shotName: 'Fire Breath',
      scopeOfWork: 'Dragon head matchmove & fire emitter track', department: 'Object Tracking',
      description: 'Dragon fire breath FX with hero interaction',
      artistIds: ['artist-2'], status: 'pending', priority: 'high',
      eta: daysFromNow(3), finalDeliveryDate: daysFromNow(5), deliveryStatus: 'pending',
      clientFeedback: [],
      createdAt: daysFromNow(-20) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-4', projectId: 'proj-1', shotNumber: 'DQ_040', shotName: 'Dragon Landing',
      scopeOfWork: 'Clean plate ground dust & rig removal', department: 'Prep',
      description: 'Dragon landing with ground impact FX',
      artistIds: ['artist-3'], status: 'approved', priority: 'medium',
      eta: daysFromNow(-2), finalDeliveryDate: daysFromNow(0), deliveryStatus: 'to-be-delivered',
      clientFeedback: [
        { id: 'fb-2', shotId: 'shot-4', date: daysFromNow(-1), note: 'Approved — great work on the dust simulation', type: 'feedback' },
      ],
      createdAt: daysFromNow(-28) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-5', projectId: 'proj-2', shotNumber: 'CD_010', shotName: 'Building Collapse',
      scopeOfWork: 'Building window reflection paint & debris prep', department: 'Prep',
      description: 'Hero building collapse with debris',
      artistIds: ['artist-2'], status: 'client-review', priority: 'critical',
      eta: daysFromNow(0), finalDeliveryDate: daysFromNow(0), deliveryStatus: 'to-be-delivered',
      clientFeedback: [
        { id: 'fb-3', shotId: 'shot-5', date: daysFromNow(-1), note: 'Dust cloud needs to linger longer — add 30 more frames', type: 'kickback' },
      ],
      createdAt: daysFromNow(-15) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-6', projectId: 'proj-2', shotNumber: 'CD_020', shotName: 'Street Explosion',
      scopeOfWork: 'Moving car matchmove & tire tracking', department: 'Object Tracking',
      description: 'Street-level explosion with car flip',
      artistIds: ['artist-1'], status: 'changes-required', priority: 'high',
      eta: daysFromNow(-1), finalDeliveryDate: daysFromNow(0), deliveryStatus: 'to-be-delivered',
      clientFeedback: [
        { id: 'fb-4', shotId: 'shot-6', date: daysFromNow(-2), note: 'Fire color is too orange, needs to be more blue at core', type: 'modification' },
      ],
      createdAt: daysFromNow(-15) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-7', projectId: 'proj-2', shotNumber: 'CD_030', shotName: 'Aerial Shot',
      scopeOfWork: 'Aerial drone 3D camera solve', department: 'Camera Tracking',
      description: 'Aerial view of destruction aftermath',
      artistIds: ['artist-4'], status: 'internal-review', priority: 'medium',
      eta: daysFromNow(2), finalDeliveryDate: daysFromNow(4), deliveryStatus: 'pending',
      clientFeedback: [],
      createdAt: daysFromNow(-10) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-8', projectId: 'proj-2', shotNumber: 'CD_040', shotName: 'Hero Rescue',
      scopeOfWork: 'Character roto edge isolation for comp', department: 'Roto',
      description: 'Hero rescue sequence with falling debris',
      artistIds: ['artist-3'], status: 'delivered', priority: 'low',
      eta: daysFromNow(-5), finalDeliveryDate: daysFromNow(-5), deliveryStatus: 'delivered',
      clientFeedback: [],
      createdAt: daysFromNow(-10) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-9', projectId: 'proj-3', shotNumber: 'UW_010', shotName: 'Deep Sea Dive',
      scopeOfWork: 'Submarine tracking & particulate clean plate', department: 'Prep',
      description: 'Camera dive into deep ocean environment',
      artistIds: ['artist-4'], status: 'pending', priority: 'medium',
      eta: daysFromNow(7), finalDeliveryDate: daysFromNow(10), deliveryStatus: 'pending',
      clientFeedback: [],
      createdAt: daysFromNow(-20) + 'T00:00:00Z', updatedAt: now(),
    },
    {
      id: 'shot-10', projectId: 'proj-3', shotNumber: 'UW_020', shotName: 'Creature Encounter',
      scopeOfWork: 'Creature tentacle articulation roto', department: 'Roto',
      description: 'Bioluminescent creature reveal',
      artistIds: ['artist-1'], status: 'client-feedback', priority: 'high',
      eta: daysFromNow(0), finalDeliveryDate: daysFromNow(1), deliveryStatus: 'pending',
      clientFeedback: [
        { id: 'fb-5', shotId: 'shot-10', date: daysFromNow(-2), note: 'Creature glow needs to pulse more rhythmically', type: 'kickback' },
      ],
      createdAt: daysFromNow(-20) + 'T00:00:00Z', updatedAt: now(),
    },
  ];

  return { projects, shots, artists };
}

function migrateShot(s: any): Shot {
  const shotName = s.shotName || s.shotNumber || 'Untitled Shot';
  const shotNumber = s.shotNumber || s.shotName || '';
  return {
    ...s,
    shotName,
    shotNumber,
    scopeOfWork: s.scopeOfWork || '',
    department: s.department || '',
    artistIds: Array.isArray(s.artistIds) ? s.artistIds : (s.artistId ? [s.artistId] : []),
    clientFeedback: Array.isArray(s.clientFeedback) ? s.clientFeedback : [],
  };
}

// ===== Initial State =====
function getInitialState(): AppState {
  const saved = loadFromStorage();
  if (saved && saved.projects && saved.projects.length > 0) {
    const migratedShots = saved.shots?.map(migrateShot) || [];

    return {
      projects: saved.projects ?? [],
      shots: migratedShots,
      artists: saved.artists ?? [],
      activeTab: 'today',
      selectedProjectId: null,
    };
  }
  const seed = createSeedData();
  return {
    ...seed,
    activeTab: 'projects',
    selectedProjectId: null,
  };
}

// ===== Reducer =====
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };

    case 'SELECT_PROJECT':
      return { ...state, selectedProjectId: action.payload };

    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };

    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };

    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
        shots: state.shots.filter((s) => s.projectId !== action.payload),
        selectedProjectId: state.selectedProjectId === action.payload ? null : state.selectedProjectId,
      };

    case 'ADD_SHOT':
      return { ...state, shots: [...state.shots, action.payload] };

    case 'UPDATE_SHOT':
      return {
        ...state,
        shots: state.shots.map((s) => (s.id === action.payload.id ? action.payload : s)),
      };

    case 'DELETE_SHOT':
      return { ...state, shots: state.shots.filter((s) => s.id !== action.payload) };

    case 'DELETE_SHOTS':
      return { ...state, shots: state.shots.filter((s) => !action.payload.includes(s.id)) };

    case 'ADD_ARTIST':
      return { ...state, artists: [...state.artists, action.payload] };

    case 'UPDATE_ARTIST':
      return {
        ...state,
        artists: state.artists.map((a) => (a.id === action.payload.id ? action.payload : a)),
      };

    case 'DELETE_ARTIST':
      return { ...state, artists: state.artists.filter((a) => a.id !== action.payload) };

    case 'ADD_FEEDBACK': {
      const fb = action.payload;
      return {
        ...state,
        shots: state.shots.map((s) =>
          s.id === fb.shotId ? { ...s, clientFeedback: [...s.clientFeedback, fb], updatedAt: now() } : s
        ),
      };
    }

    case 'SYNC_EXCEL_SHOTS': {
      const { added, updated } = action.payload;
      const updatedIds = new Set(updated.map((s) => s.id));
      
      const newShots = state.shots.map((s) => {
        if (updatedIds.has(s.id)) {
          return updated.find((u) => u.id === s.id) || s;
        }
        return s;
      });
      
      return {
        ...state,
        shots: [...newShots, ...added],
      };
    }

    case 'RESET_FOR_NEW_PROJECT': {
      // 1. Automatically save a backup snapshot to localStorage
      try {
        const archiveKey = `vfx-tracker-archive-${Date.now()}`;
        localStorage.setItem(archiveKey, JSON.stringify({
          projects: state.projects,
          shots: state.shots,
          artists: state.artists,
          archivedAt: new Date().toISOString(),
        }));
      } catch { /* ignore */ }

      const newProjName = action.payload?.newProjectName || 'New VFX Project';
      const newProjectId = generateId();
      const newProject: Project = {
        id: newProjectId,
        name: newProjName,
        client: 'Client Studio',
        description: 'New production workspace',
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
      };

      return {
        ...state,
        projects: [newProject],
        shots: [], // fresh slate for new project
        selectedProjectId: newProjectId,
        activeTab: 'shots',
      };
    }

    case 'LOAD_STATE': {
      const stateData = action.payload as any;
      const migratedShots = stateData.shots?.map(migrateShot) || [];
      return { ...state, ...stateData, shots: migratedShots.length > 0 ? migratedShots : (stateData.shots || []) };
    }

    default:
      return state;
  }
}

// ===== Context =====
interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, getInitialState);

  // 1. Background remote sync from Supabase with non-blocking timeout
  useEffect(() => {
    if (!supabase) return;
    
    let active = true;
    async function loadRemote() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const { data, error } = await supabase!
          .from('app_state')
          .select('data')
          .eq('id', 'global_state')
          .abortSignal(controller.signal)
          .single();
          
        clearTimeout(timeoutId);

        if (error && error.code !== 'PGRST116') {
          console.warn('Supabase remote sync bypassed:', error.message || error);
        }
        
        if (data && data.data && active) {
          dispatch({ type: 'LOAD_STATE', payload: data.data });
        }
      } catch {
        // Offline / DNS error / timeout -> silently fallback to local storage
      }
    }
    loadRemote();
    return () => { active = false; };
  }, []);

  // 2. Persist to storage (Local and Supabase) without blocking UI
  useEffect(() => {
    // Save to local storage always as primary / reliable storage
    saveToStorage(state);
    
    // Save to Supabase quietly in the background if configured
    if (supabase) {
      try {
        const { projects, shots, artists } = state;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        supabase.from('app_state').upsert({
          id: 'global_state',
          data: { projects, shots, artists },
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .abortSignal(controller.signal)
        .then(
          () => clearTimeout(timeoutId),
          () => clearTimeout(timeoutId)
        );
      } catch {
        // silent
      }
    }
  }, [state]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ===== Selectors =====
export function useShotsByProject(projectId: string | null) {
  const { state } = useStore();
  if (!projectId) return state.shots;
  return state.shots.filter((s) => s.projectId === projectId);
}

export function useShotsByArtist(artistId: string) {
  const { state } = useStore();
  return state.shots.filter((s) => s.artistIds && s.artistIds.includes(artistId));
}

export function useArtistById(artistId: string): Artist | undefined {
  const { state } = useStore();
  return state.artists.find((a) => a.id === artistId);
}

export function useProjectById(projectId: string): Project | undefined {
  const { state } = useStore();
  return state.projects.find((p) => p.id === projectId);
}

export function useStatusCounts() {
  const { state } = useStore();
  const counts: Record<string, number> = {};
  for (const shot of state.shots) {
    counts[shot.status] = (counts[shot.status] || 0) + 1;
  }
  return counts;
}

export function useOverdueShots() {
  const { state } = useStore();
  const todayStr = today();
  return state.shots.filter(
    (s) => s.finalDeliveryDate && s.finalDeliveryDate < todayStr && s.deliveryStatus !== 'delivered'
  );
}

/** Shots with ETA or finalDeliveryDate matching today */
export function useTodayShots() {
  const { state } = useStore();
  const todayStr = today();
  return state.shots.filter(
    (s) => (s.eta === todayStr || s.finalDeliveryDate === todayStr) && s.deliveryStatus !== 'delivered'
  );
}

/** Shots that need to be delivered today */
export function useTodayDeliveries() {
  const { state } = useStore();
  const todayStr = today();
  return state.shots.filter(
    (s) => s.finalDeliveryDate === todayStr && s.deliveryStatus !== 'delivered'
  );
}

/** Shots currently in progress (in-progress or wip) */
export function useInProgressShots() {
  const { state } = useStore();
  return state.shots.filter(
    (s) => s.status === 'in-progress' || s.status === 'wip'
  );
}

/** Shots that are pending and not yet started */
export function usePendingShots() {
  const { state } = useStore();
  return state.shots.filter((s) => s.status === 'pending');
}

// ===== Helper hooks =====
export function useProjectName() {
  const { state } = useStore();
  return useCallback(
    (projectId: string) => state.projects.find((p) => p.id === projectId)?.name ?? '—',
    [state.projects]
  );
}

export function useArtistNames() {
  const { state } = useStore();
  return useCallback(
    (artistIds: string[]) => {
      if (!artistIds || artistIds.length === 0) return 'Unassigned';
      return artistIds
        .map(id => state.artists.find((a) => a.id === id)?.name)
        .filter(Boolean)
        .join(', ') || 'Unassigned';
    },
    [state.artists]
  );
}
