import { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup, GoogleAuthProvider,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth, FIREBASE_CONFIGURED } from "../lib/firebase";
import { createUserProfile, getUserProfile, updateUserProfile } from "../utils/firestoreStorage";

const AuthContext = createContext();

// Emails that receive admin role automatically
const ADMIN_EMAILS = ["admin@ubenergy.mn"];

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  // undefined = still checking, null = logged out, object = logged in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED || !auth) {
      setUser(null);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        return;
      }

      try {
        let profile = await getUserProfile(fbUser.uid);

        // First-time Google login: create Firestore profile
        if (!profile) {
          const isGoogle = fbUser.providerData?.[0]?.providerId === "google.com";
          profile = {
            name: fbUser.displayName || fbUser.email.split("@")[0],
            email: fbUser.email,
            createdAt: new Date().toISOString(),
            role: ADMIN_EMAILS.includes(fbUser.email) ? "admin" : "user",
            type: "personal",
            org: "",
            avatar: fbUser.photoURL || null,
            verified: isGoogle || fbUser.emailVerified,
          };
          await createUserProfile(fbUser.uid, profile);
        }

        setUser({
          uid:           fbUser.uid,
          id:            fbUser.uid,                         // backward-compat alias
          name:          profile.name  || fbUser.displayName || fbUser.email.split("@")[0],
          email:         fbUser.email,
          avatar:        profile.avatar || fbUser.photoURL || null,
          role:          profile.role   || "user",
          type:          profile.type   || "personal",
          org:           profile.org    || "",
          createdAt:     profile.createdAt,
          emailVerified: fbUser.emailVerified,
          isGoogle:      fbUser.providerData?.[0]?.providerId === "google.com",
        });
      } catch (err) {
        console.error("[AuthContext] Failed to load profile:", err);
        setUser(null);
      }
    });

    return unsub;
  }, []);

  // ── Register with email/password ──
  const register = async ({ name, email, password, type, org }) => {
    if (!FIREBASE_CONFIGURED || !auth) return { ok: false, error: "not_configured" };
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user);

      await createUserProfile(cred.user.uid, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        role: ADMIN_EMAILS.includes(email.trim().toLowerCase()) ? "admin" : "user",
        type: type || "personal",
        org: org || "",
        avatar: null,
        verified: false,
      });

      return { ok: true, needsVerification: true };
    } catch (err) {
      if (err.code === "auth/email-already-in-use") return { ok: false, error: "email_taken" };
      if (err.code === "auth/weak-password")        return { ok: false, error: "too_short" };
      return { ok: false, error: err.message };
    }
  };

  // ── Login with email/password ──
  const login = async (email, password) => {
    if (!FIREBASE_CONFIGURED || !auth) return { ok: false, error: "not_configured" };
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { ok: true };
    } catch (err) {
      if (
        err.code === "auth/user-not-found"  ||
        err.code === "auth/wrong-password"  ||
        err.code === "auth/invalid-credential"
      ) return { ok: false, error: "invalid" };
      if (err.code === "auth/too-many-requests") return { ok: false, error: "too_many" };
      return { ok: false, error: err.message };
    }
  };

  // ── Google login ──
  const loginWithGoogle = async () => {
    if (!FIREBASE_CONFIGURED || !auth) return { ok: false, error: "not_configured" };
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      return { ok: true };
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") return { ok: false, error: "cancelled" };
      return { ok: false, error: err.message };
    }
  };

  // ── Logout ──
  const logout = async () => {
    if (auth) await fbSignOut(auth);
  };

  // ── Send password reset email ──
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true };
    } catch (err) {
      if (err.code === "auth/user-not-found") return { ok: false, error: "email_not_found" };
      return { ok: false, error: err.message };
    }
  };

  // ── Resend email verification ──
  const resendVerification = async () => {
    if (!auth?.currentUser) return { ok: false };
    try {
      await sendEmailVerification(auth.currentUser);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };

  // ── Update profile (name, avatar, password) ──
  const updateUser = async ({ name, currentPassword, newPassword, avatar }) => {
    if (!auth?.currentUser) return { ok: false, error: "not_found" };

    try {
      // Name update
      if (name !== undefined) {
        await updateProfile(auth.currentUser, { displayName: name });
        await updateUserProfile(auth.currentUser.uid, { name });
        setUser(prev => prev ? { ...prev, name } : prev);
      }

      // Avatar: store in Firestore (keep under ~700KB; ProfilePage enforces 2MB file limit)
      if (avatar !== undefined) {
        await updateUserProfile(auth.currentUser.uid, { avatar });
        setUser(prev => prev ? { ...prev, avatar } : prev);
      }

      // Password change — requires reauthentication
      if (newPassword !== undefined) {
        if (!currentPassword) return { ok: false, error: "wrong_password" };
        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
      }

      return { ok: true };
    } catch (err) {
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) return { ok: false, error: "wrong_password" };
      if (err.code === "auth/weak-password") return { ok: false, error: "too_short" };
      return { ok: false, error: err.message };
    }
  };

  const authLoading = user === undefined;

  return (
    <AuthContext.Provider value={{
      user:        authLoading ? null : user,
      authLoading,
      login,
      loginWithGoogle,
      logout,
      register,
      updateUser,
      resetPassword,
      resendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
