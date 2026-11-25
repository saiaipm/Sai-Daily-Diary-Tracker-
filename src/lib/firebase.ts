import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider setup
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

export interface AuthUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ');

// In-memory token & user cache
let cachedAccessToken: string | null = null;
let cachedUser: AuthUser | null = null;
let isSigningIn = false;

// Google Identity Services (GIS) preloaded token client state
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gisTokenClient: ReturnType<
  NonNullable<NonNullable<NonNullable<Window['google']>['accounts']>['oauth2']>['initTokenClient']
> | null = null;
let gisLoadPromise: Promise<boolean> | null = null;
let pendingGisResolve: ((result: { user: AuthUser; accessToken: string }) => void) | null = null;
let pendingGisReject: ((err: Error) => void) | null = null;

function initGisTokenClientInstance() {
  const oauth2 = window.google?.accounts?.oauth2;
  const clientId = (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  if (!oauth2 || !clientId || gisTokenClient) return Boolean(gisTokenClient);

  gisTokenClient = oauth2.initTokenClient({
    client_id: clientId,
    scope: WORKSPACE_SCOPES,
    callback: async (response) => {
      try {
        if (response.error || !response.access_token) {
          throw new Error(
            response.error_description || response.error || 'Google authorization was cancelled.'
          );
        }

        const accessToken = response.access_token;

        // Fetch Google profile info using the OAuth token
        let profile: AuthUser = {
          displayName: 'Google User',
          email: null,
          photoURL: null,
        };

        try {
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (userInfoRes.ok) {
            const info = await userInfoRes.json();
            profile = {
              displayName: info.name || info.email || 'Google User',
              email: info.email || null,
              photoURL: info.picture || null,
            };
          }
        } catch (profileErr) {
          console.warn('Could not fetch Google profile info:', profileErr);
        }

        // Best-effort sync with Firebase Auth session
        try {
          const credential = GoogleAuthProvider.credential(null, accessToken);
          const firebaseRes = await signInWithCredential(auth, credential);
          if (firebaseRes.user) {
            profile = {
              displayName: firebaseRes.user.displayName || profile.displayName,
              email: firebaseRes.user.email || profile.email,
              photoURL: firebaseRes.user.photoURL || profile.photoURL,
            };
          }
        } catch (credErr) {
          // Non-fatal: the app uses the Google access token directly for Sheets API
          console.warn('Firebase credential sync skipped:', credErr);
        }

        cachedAccessToken = accessToken;
        cachedUser = profile;
        isSigningIn = false;

        const resolve = pendingGisResolve;
        pendingGisResolve = null;
        pendingGisReject = null;
        if (resolve) resolve({ user: profile, accessToken });
      } catch (err: any) {
        isSigningIn = false;
        const reject = pendingGisReject;
        pendingGisResolve = null;
        pendingGisReject = null;
        if (reject) reject(err instanceof Error ? err : new Error(String(err)));
      }
    },
    error_callback: (err) => {
      isSigningIn = false;
      const reject = pendingGisReject;
      pendingGisResolve = null;
      pendingGisReject = null;
      if (reject) {
        const msg =
          err.type === 'popup_closed'
            ? 'Direct Google sign-in popup was closed before completing authorization.'
            : err.type === 'popup_failed_to_open'
            ? 'Direct Google sign-in popup was blocked by your browser. Please allow popups for this site.'
            : err.message || `Direct Google sign-in failed (${err.type}).`;
        const errorObj = new Error(msg) as Error & { code?: string };
        errorObj.code = `gis/${err.type}`;
        reject(errorObj);
      }
    },
  });

  return true;
}

/**
 * Preloads the Google Identity Services script so Direct Sign-In can open
 * synchronously inside a user click gesture without losing popup activation.
 */
export const preloadGisClient = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (gisTokenClient) return Promise.resolve(true);
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(initGisTokenClientInstance());
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(initGisTokenClientInstance()), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(initGisTokenClientInstance());
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return gisLoadPromise;
};

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  preloadGisClient();
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        cachedUser = user;
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Firebase Auth doesn't persist the Google OAuth access token across reloads.
        cachedAccessToken = null;
        cachedUser = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else if (cachedAccessToken && cachedUser) {
      if (onAuthSuccess) onAuthSuccess(cachedUser, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      cachedUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  if (isSigningIn) {
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Sign-In');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const isEmbeddedIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const isGisReady = (): boolean => {
  if (gisTokenClient) return true;
  return initGisTokenClientInstance();
};

/**
 * Direct Google Identity Services (GIS) OAuth popup flow.
 * Bypasses Firebase's cross-origin auth iframe/storage relay, which can fail
 * with `auth/popup-closed-by-user` in embedded iframes or browsers with strict
 * Cross-Origin-Opener-Policy / third-party storage partitioning.
 */
export const googleGisSignIn = async (): Promise<{ user: AuthUser; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('A sign-in attempt is already in progress.');
  }
  if (!gisTokenClient) {
    initGisTokenClientInstance();
  }
  if (!gisTokenClient) {
    const loaded = await preloadGisClient();
    if (!loaded || !gisTokenClient) {
      throw new Error(
        'Google Sign-In library failed to load. Check your connection or disable script blockers and try again.'
      );
    }
  }

  return new Promise((resolve, reject) => {
    isSigningIn = true;
    pendingGisResolve = resolve;
    pendingGisReject = reject;
    try {
      gisTokenClient!.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      isSigningIn = false;
      pendingGisResolve = null;
      pendingGisReject = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  const tokenToRevoke = cachedAccessToken;
  cachedAccessToken = null;
  cachedUser = null;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Firebase signOut error:', err);
  }
  // Note: we avoid revoking the token so the user keeps their app grant for faster next login
  void tokenToRevoke;
};
