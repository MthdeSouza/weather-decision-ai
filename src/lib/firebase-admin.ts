import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      serviceAccount
        ? {
            credential: cert(serviceAccount),
            projectId,
          }
        : {
            projectId,
            credential: undefined,
          },
    );

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

export const isFirebaseAdminConfigured = Boolean(
  projectId && (serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS),
);
