import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  "";

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
const privateKey = process.env.FIREBASE_PRIVATE_KEY ?? "";

const serviceAccount =
  clientEmail && privateKey
    ? {
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }
    : null;

export const isFirebaseAdminConfigured = Boolean(
  projectId &&
    (serviceAccount ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE),
);

const adminApp = getApps().length
  ? getApps()[0]
  : isFirebaseAdminConfigured
    ? initializeApp(
        serviceAccount
          ? {
              credential: cert(serviceAccount),
              projectId,
            }
          : {
              projectId,
              credential: applicationDefault(),
            },
      )
    : null;

const makeMissingFirebaseAdminProxy = <T extends object>(label: string) =>
  new Proxy({} as T, {
    get() {
      throw new Error(
        `Firebase Admin ${label} não está configurado. Defina as variáveis do Firebase Admin antes de usar o backend.`,
      );
    },
  });

export const adminDb: Firestore = adminApp
  ? getFirestore(adminApp)
  : (makeMissingFirebaseAdminProxy<Firestore>("Firestore") as Firestore);
export const adminAuth: Auth = adminApp
  ? getAuth(adminApp)
  : (makeMissingFirebaseAdminProxy<Auth>("Auth") as Auth);
