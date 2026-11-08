// import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// import { auth } from "./config";

// const googleProvider = new GoogleAuthProvider();

// export const loginWithGoogle = async () => {
//   const result = await signInWithPopup(auth, googleProvider);

//   return result.user;
// };

// export const logout = async () => {
//   await signOut(auth);
// };

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { auth } from "./config";
import { getOrCreateUser } from "./users";

const AUTH_COOKIE_NAME = "weather-decision-auth";

const setSessionCookie = (user: User | null) => {
  if (typeof document === "undefined") {
    return;
  }

  if (!user) {
    document.cookie = `${AUTH_COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Lax`;
    return;
  }

  const cookieValue = encodeURIComponent(
    JSON.stringify({
      uid: user.uid,
      email: user.email ?? "",
      name: user.displayName ?? "",
    }),
  );

  document.cookie = `${AUTH_COOKIE_NAME}=${cookieValue}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
};

export const syncLoggedUser = async (user: User) => {
  if (!user) {
    setSessionCookie(null);
    return null;
  }

  const profile = await getOrCreateUser({
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    provider: user.providerData?.[0]?.providerId ?? "firebase",
  });

  setSessionCookie(user);

  return {
    user,
    profile,
  };
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();

  const result = await signInWithPopup(auth, provider);

  return syncLoggedUser(result.user);
};

export const logout = async () => {
  await signOut(auth);
  setSessionCookie(null);
};

export const listenToAuthChanges = (
  onUser: (payload: { user: User; profile: unknown } | null) => void,
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setSessionCookie(null);
      onUser(null);
      return;
    }

    const payload = await syncLoggedUser(user);
    onUser(payload as { user: User; profile: unknown } | null);
  });
};
