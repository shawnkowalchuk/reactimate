import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";

function parseConfig(raw: string | undefined): FirebaseOptions | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FirebaseOptions;
    return parsed.apiKey && parsed.projectId ? parsed : null;
  } catch {
    return null;
  }
}

const config = parseConfig(import.meta.env.VITE_FIREBASE_CONFIG);

/**
 * Single Firebase app for the frontend — or `null` if VITE_FIREBASE_CONFIG
 * isn't set. The auth gate treats `null` as "auth disabled" and lets the
 * editor load without sign-in, preserving the localStorage-only flow.
 */
export const app: FirebaseApp | null = config ? initializeApp(config) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;

export const isAuthEnabled = app !== null;

// Analytics only activates when the config carries a measurementId (i.e.
// the Firebase project has been linked to Google Analytics) and the
// environment supports it — silently a no-op otherwise.
if (app && config?.measurementId) {
  void analyticsSupported().then((ok) => {
    if (ok) getAnalytics(app);
  });
}
