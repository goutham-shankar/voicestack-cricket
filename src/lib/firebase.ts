import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Credentials come from one of, in order:
 *  - FIREBASE_SERVICE_ACCOUNT_KEY: the service-account JSON itself (raw or
 *    base64), which is how a single env var fits on hosts like Vercel;
 *  - GOOGLE_APPLICATION_CREDENTIALS / the ambient metadata server, picked up by
 *    applicationDefault() on Google infrastructure and local gcloud logins;
 *  - FIRESTORE_EMULATOR_HOST alone, where no credential is needed at all.
 */
function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");

  const parsed = JSON.parse(json) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email or private_key"
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    // Env vars keep newlines escaped, so put them back before signing.
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

function createApp(): App {
  const serviceAccount = readServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // The emulator accepts any project id and ignores credentials entirely.
    return initializeApp({ projectId: projectId ?? "demo-voicestack-cricket" });
  }

  if (!projectId) {
    throw new Error(
      "Missing Firebase credentials — set FIREBASE_SERVICE_ACCOUNT_KEY, or GOOGLE_APPLICATION_CREDENTIALS together with FIREBASE_PROJECT_ID"
    );
  }

  return initializeApp({ projectId });
}

declare global {
  var _firestore: Firestore | undefined;
}

/**
 * One Firestore handle per process. Cached on `global` because Next's dev
 * server re-evaluates modules on every edit, and settings can only be applied
 * to a Firestore instance before its first use.
 *
 * FIREBASE_DATABASE_ID selects a non-default database. A Firestore database's
 * region is fixed at creation, so moving regions means creating a second
 * database in the same project and naming it here.
 */
export function getDb(): Firestore {
  if (global._firestore) return global._firestore;

  const app = getApps()[0] ?? createApp();
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim();
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  // Mongoose dropped undefined fields; keep writes equally forgiving.
  db.settings({ ignoreUndefinedProperties: true });

  global._firestore = db;
  return db;
}
