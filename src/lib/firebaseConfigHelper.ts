import appletConfig from '../../firebase-applet-config.json';

export interface FirebaseProjectConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
  isCustom?: boolean;
}

const CUSTOM_CONFIG_KEY = 'custom_firebase_config';

export function getActiveFirebaseConfig(): FirebaseProjectConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(CUSTOM_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.apiKey && parsed.projectId) {
          // If stored custom config was from the old temporary project, clear it
          if (parsed.projectId === 'notional-acre-4sjh2') {
            localStorage.removeItem(CUSTOM_CONFIG_KEY);
          } else {
            return {
              apiKey: parsed.apiKey.trim(),
              authDomain: parsed.authDomain ? parsed.authDomain.trim() : `${parsed.projectId.trim()}.firebaseapp.com`,
              projectId: parsed.projectId.trim(),
              storageBucket: parsed.storageBucket ? parsed.storageBucket.trim() : `${parsed.projectId.trim()}.firebasestorage.app`,
              messagingSenderId: parsed.messagingSenderId ? parsed.messagingSenderId.trim() : '',
              appId: parsed.appId ? parsed.appId.trim() : '',
              measurementId: parsed.measurementId ? parsed.measurementId.trim() : '',
              firestoreDatabaseId: parsed.firestoreDatabaseId ? parsed.firestoreDatabaseId.trim() : 'main',
              isCustom: true
            };
          }
        }
      }
    } catch (err) {
      console.warn('Error reading stored custom firebase config:', err);
    }
  }

  return {
    apiKey: appletConfig.apiKey || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_API_KEY : '') || '',
    authDomain: appletConfig.authDomain || 'taka-trek.firebaseapp.com',
    projectId: appletConfig.projectId || 'taka-trek',
    storageBucket: appletConfig.storageBucket || 'taka-trek.firebasestorage.app',
    messagingSenderId: appletConfig.messagingSenderId || '',
    appId: appletConfig.appId || '',
    measurementId: appletConfig.measurementId || '',
    firestoreDatabaseId: appletConfig.firestoreDatabaseId || 'main',
    isCustom: false
  };
}

export function saveCustomFirebaseConfig(config: Partial<FirebaseProjectConfig>): boolean {
  if (!config.apiKey || !config.projectId) {
    return false;
  }

  const sanitized: FirebaseProjectConfig = {
    apiKey: config.apiKey.trim(),
    authDomain: config.authDomain ? config.authDomain.trim() : `${config.projectId.trim()}.firebaseapp.com`,
    projectId: config.projectId.trim(),
    storageBucket: config.storageBucket ? config.storageBucket.trim() : `${config.projectId.trim()}.firebasestorage.app`,
    messagingSenderId: config.messagingSenderId ? config.messagingSenderId.trim() : '',
    appId: config.appId ? config.appId.trim() : '',
    measurementId: config.measurementId ? config.measurementId.trim() : '',
    firestoreDatabaseId: config.firestoreDatabaseId?.trim() || 'main',
    isCustom: true
  };

  localStorage.setItem(CUSTOM_CONFIG_KEY, JSON.stringify(sanitized));
  return true;
}

export function resetToDefaultFirebaseConfig(): void {
  localStorage.removeItem(CUSTOM_CONFIG_KEY);
}

export function clearAllOldConnectionsAndData(): void {
  // Clear any guest sessions and local cache keys
  localStorage.removeItem('local_guest_session');
  localStorage.removeItem(CUSTOM_CONFIG_KEY);
  
  // Clear any easy_due ledger cached data
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('easy_due_') || key.startsWith('firebase:'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();
}

/**
 * Parses user input which might be raw JSON or JS code like:
 * const firebaseConfig = {
 *   apiKey: "...",
 *   authDomain: "...",
 *   projectId: "...",
 *   ...
 * };
 */
export function parseFirebaseSnippet(input: string): Partial<FirebaseProjectConfig> | null {
  if (!input || !input.trim()) return null;
  const trimmed = input.trim();

  // Try parsing as standard JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        apiKey: parsed.apiKey || parsed.api_key,
        authDomain: parsed.authDomain || parsed.auth_domain,
        projectId: parsed.projectId || parsed.project_id,
        storageBucket: parsed.storageBucket || parsed.storage_bucket,
        messagingSenderId: parsed.messagingSenderId || parsed.messaging_sender_id,
        appId: parsed.appId || parsed.app_id,
        measurementId: parsed.measurementId || parsed.measurement_id,
        firestoreDatabaseId: parsed.firestoreDatabaseId || parsed.databaseId || 'main'
      };
    }
  } catch {
    // Not valid JSON, try regex extraction
  }

  // Regex extraction from JS object or snippet
  const extractField = (fieldName: string): string => {
    const patterns = [
      new RegExp(`['"]?${fieldName}['"]?\\s*:\\s*['"]([^'"]+)['"]`, 'i'),
      new RegExp(`['"]?${fieldName}['"]?\\s*=\\s*['"]([^'"]+)['"]`, 'i')
    ];
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) return match[1].trim();
    }
    return '';
  };

  const apiKey = extractField('apiKey') || extractField('api_key');
  const projectId = extractField('projectId') || extractField('project_id');
  const authDomain = extractField('authDomain') || extractField('auth_domain');
  const storageBucket = extractField('storageBucket') || extractField('storage_bucket');
  const messagingSenderId = extractField('messagingSenderId') || extractField('messaging_sender_id');
  const appId = extractField('appId') || extractField('app_id');
  const measurementId = extractField('measurementId') || extractField('measurement_id');
  const firestoreDatabaseId = extractField('firestoreDatabaseId') || extractField('databaseId') || 'main';

  if (apiKey || projectId) {
    return {
      apiKey,
      projectId,
      authDomain: authDomain || (projectId ? `${projectId}.firebaseapp.com` : ''),
      storageBucket: storageBucket || (projectId ? `${projectId}.firebasestorage.app` : ''),
      messagingSenderId,
      appId,
      measurementId,
      firestoreDatabaseId
    };
  }

  return null;
}
