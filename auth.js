// auth.js
// Save exactly this file as auth.js in your web root.

import { auth, db } from './firebase-init.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  ref,
  get,
  set
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/**
 * Create a firebase auth user, create a minimal profile in Realtime DB,
 * send email verification, sign out so user must verify before login.
 */
export async function createUserAndProfile(email, password, profile = {}) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  // create profile
  const userRef = ref(db, `users/${user.uid}`);
  await set(userRef, {
    email: email,
    createdAt: Date.now(),
    ...profile
  });
  // send verification
  await sendEmailVerification(user);
  // sign out so they cannot use app until verified
  await signOut(auth);
  return user;
}

/**
 * Sign in user and require email verified.
 * If not verified, sign out and throw error with code 'auth/email-not-verified'.
 */
export async function signInIfVerified(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  if (!user.emailVerified) {
    // optionally re-send verification? Better to instruct user to check email.
    await signOut(auth);
    const e = new Error('Email not verified');
    e.code = 'auth/email-not-verified';
    throw e;
  }
  // ensure profile exists
  const userRef = ref(db, `users/${user.uid}`);
  const snap = await get(userRef);
  if (!snap.exists()) {
    await set(userRef, { email: user.email, createdAt: Date.now() });
  }
  return user;
}

export function doSignOut() {
  return signOut(auth);
}

/**
 * attachAuthGuard - attach an onAuthStateChanged listener to guard a page.
 * onAuthVerified(user) is called when a user is signed in and emailVerified === true.
 * onNotAuth() is called when not signed in or not verified.
 */
export function attachAuthGuard({ onAuthVerified, onNotAuth }) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onNotAuth && onNotAuth();
      return;
    }
    if (!user.emailVerified) {
      // enforce email verification: sign them out and treat as not auth
      await signOut(auth);
      onNotAuth && onNotAuth();
      return;
    }
    onAuthVerified && onAuthVerified(user);
  });
}

/**
 * Helper for sending password reset
 */
export function sendResetEmail(email) {
  return sendPasswordResetEmail(auth, email);
}
