import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { auth } from "./config";
import { getOrCreateUser, getUserProfileByUid } from "./users";

const userSyncs = new Map<
  string,
  Promise<{ user: User; profile: Awaited<ReturnType<typeof getOrCreateUser>> }>
>();

const establishServerSession = async (user: User) => {
  const token = await user.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Não foi possível iniciar a sessão segura no servidor.");
  }
};

export const syncLoggedUser = (user: User) => {
  const inFlight = userSyncs.get(user.uid);
  if (inFlight) {
    return inFlight;
  }

  const sync = (async () => {
    const profile =
      (await getUserProfileByUid(user.uid)) ??
      (await getOrCreateUser({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        provider: user.providerData?.[0]?.providerId ?? "firebase",
      }));

    await establishServerSession(user);

    return { user, profile };
  })();
  userSyncs.set(user.uid, sync);

  const clearInFlight = () => {
    if (userSyncs.get(user.uid) === sync) {
      userSyncs.delete(user.uid);
    }
  };
  void sync.then(clearInFlight, clearInFlight);

  return sync;
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();

  const result = await signInWithPopup(auth, provider);

  return syncLoggedUser(result.user);
};

export const logout = async () => {
  try {
    const response = await fetch("/api/auth/session", { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Não foi possível encerrar a sessão do servidor.");
    }
  } finally {
    await signOut(auth);
  }
};

export const listenToAuthChanges = (
  onUser: (payload: { user: User; profile: unknown } | null) => void,
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onUser(null);
      return;
    }

    try {
      const payload = await syncLoggedUser(user);
      onUser(payload as { user: User; profile: unknown } | null);
    } catch (error) {
      console.error("[auth] failed to synchronize server session", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      onUser(null);
    }
  });
};
