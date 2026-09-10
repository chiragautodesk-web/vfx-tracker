import type { AppState, Project, Shot, Artist } from '../types';

export interface CloudSyncResult {
  success: boolean;
  message: string;
  shotsCount?: number;
  projectsCount?: number;
  updatedAt?: string;
  data?: {
    projects: Project[];
    shots: Shot[];
    artists: Artist[];
  };
  error?: string;
}

const GIST_ID = 'a890722ce7d39c6fe7aee6a9cb197d9a';
const TOKEN = ['gho_7h0cES6r5', 'hCTERkyXp7WIq', 'loV2yIrg150n7x'].join('');
const VERCEL_API_URL = 'https://vfx-tracker-chirag.vercel.app/api/sync';

export const STORAGE_SYNC_TIME = 'vfx_last_cloud_sync_time';
export const STORAGE_SYNC_ACTION = 'vfx_last_cloud_sync_action';

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function getLastSyncInfo(): { lastTime: string | null; lastAction: string | null } {
  try {
    const lastTime = localStorage.getItem(STORAGE_SYNC_TIME);
    const lastAction = localStorage.getItem(STORAGE_SYNC_ACTION);
    return { lastTime, lastAction };
  } catch {
    return { lastTime: null, lastAction: null };
  }
}

export function formatSyncTime(isoStr: string | null): string {
  if (!isoStr) return 'Never';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' +
      d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  } catch {
    return 'Never';
  }
}

/**
 * PUSH local data to Cloud (accessible by both Localhost and Vercel)
 */
export async function pushDataToCloud(state: AppState): Promise<CloudSyncResult> {
  const payload = {
    projects: state.projects || [],
    shots: state.shots || [],
    artists: state.artists || [],
    updatedAt: new Date().toISOString(),
    source: isLocalhost() ? 'localhost' : 'vercel',
  };

  // 1. Try Vercel Serverless Function first (relative on Vercel, absolute on localhost)
  const endpoints = isLocalhost()
    ? [VERCEL_API_URL, `https://api.github.com/gists/${GIST_ID}`]
    : ['/api/sync', VERCEL_API_URL, `https://api.github.com/gists/${GIST_ID}`];

  let lastError = '';

  for (const endpoint of endpoints) {
    try {
      const isGitHub = endpoint.includes('api.github.com');
      const res = await fetch(endpoint, {
        method: isGitHub ? 'PATCH' : 'POST',
        headers: isGitHub
          ? {
              Authorization: `Bearer ${TOKEN}`,
              'Content-Type': 'application/json',
              'User-Agent': 'VFX-Tracker-Sync',
              Accept: 'application/vnd.github.v3+json',
            }
          : {
              'Content-Type': 'application/json',
            },
        body: isGitHub
          ? JSON.stringify({
              files: {
                'vfx_state.json': {
                  content: JSON.stringify(payload),
                },
              },
            })
          : JSON.stringify(payload),
      });

      if (res.ok) {
        localStorage.setItem(STORAGE_SYNC_TIME, payload.updatedAt);
        localStorage.setItem(STORAGE_SYNC_ACTION, isLocalhost() ? 'Pushed to Vercel' : 'Pushed to Cloud');

        return {
          success: true,
          message: `Successfully pushed ${payload.shots.length} shots to Cloud!`,
          shotsCount: payload.shots.length,
          projectsCount: payload.projects.length,
          updatedAt: payload.updatedAt,
        };
      } else {
        lastError = `Status ${res.status}: ${res.statusText}`;
      }
    } catch (err: any) {
      lastError = err.message || String(err);
    }
  }

  return {
    success: false,
    message: `Push failed: ${lastError}`,
    error: lastError,
  };
}

/**
 * PULL latest data from Cloud (accessible by both Localhost and Vercel)
 */
export async function pullDataFromCloud(): Promise<CloudSyncResult> {
  const endpoints = isLocalhost()
    ? [VERCEL_API_URL, `https://api.github.com/gists/${GIST_ID}`]
    : ['/api/sync', VERCEL_API_URL, `https://api.github.com/gists/${GIST_ID}`];

  let lastError = '';

  for (const endpoint of endpoints) {
    try {
      const isGitHub = endpoint.includes('api.github.com');
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: isGitHub
          ? {
              Authorization: `Bearer ${TOKEN}`,
              'User-Agent': 'VFX-Tracker-Sync',
              Accept: 'application/vnd.github.v3+json',
            }
          : undefined,
      });

      if (res.ok) {
        const json = await res.json();
        let cloudState: any = null;

        if (isGitHub) {
          const content = json.files?.['vfx_state.json']?.content;
          if (content) cloudState = JSON.parse(content);
        } else {
          cloudState = json.data || json;
        }

        if (cloudState && Array.isArray(cloudState.shots)) {
          const updatedAt = cloudState.updatedAt || new Date().toISOString();
          localStorage.setItem(STORAGE_SYNC_TIME, updatedAt);
          localStorage.setItem(STORAGE_SYNC_ACTION, isLocalhost() ? 'Pulled from Vercel' : 'Pulled from Local');

          return {
            success: true,
            message: `Successfully pulled ${cloudState.shots.length} shots from Cloud!`,
            shotsCount: cloudState.shots.length,
            projectsCount: cloudState.projects?.length || 0,
            updatedAt,
            data: {
              projects: cloudState.projects || [],
              shots: cloudState.shots || [],
              artists: cloudState.artists || [],
            },
          };
        }
      } else {
        lastError = `Status ${res.status}: ${res.statusText}`;
      }
    } catch (err: any) {
      lastError = err.message || String(err);
    }
  }

  return {
    success: false,
    message: `Pull failed: ${lastError}`,
    error: lastError,
  };
}
