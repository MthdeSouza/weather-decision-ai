import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "./config";

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
    role: "basic",
    createdAt: userSnapshot.exists()
      ? (userSnapshot.data().createdAt ?? serverTimestamp())
      : serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(userRef, payload, { merge: true });

  const savedUser = (await getDoc(userRef)).data() ?? payload;

  return savedUser;
};
