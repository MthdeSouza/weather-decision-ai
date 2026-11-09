import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import type { UserRole } from "@/types/user";

import { db } from "./config";

export type FirebaseUserProfile = {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  provider?: string;
  role: UserRole;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
};

export const getUserProfileByUid = async (uid: string) => {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as FirebaseUserProfile;
};

export const getOrCreateUser = async (user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  provider?: string;
}) => {
  const userRef = doc(db, "users", user.uid);

  const userSnapshot = await getDoc(userRef);

  const payload = {
    uid: user.uid,
    name: user.displayName ?? "",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    provider: user.provider ?? "firebase",
    role: userSnapshot.exists()
      ? (userSnapshot.data().role ?? "basic")
      : "basic",
    createdAt: userSnapshot.exists()
      ? (userSnapshot.data().createdAt ?? serverTimestamp())
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(userRef, payload, { merge: true });

  const savedUser = (await getDoc(userRef)).data() ?? payload;

  return savedUser as FirebaseUserProfile;
};
