import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Load configuration from Vite environment variables
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

let db = null;
let storage = null;
let useFirebase = false;

console.log("Firebase configuration status:");
console.log("- API Key:", FIREBASE_CONFIG.apiKey ? `LOADED (length: ${FIREBASE_CONFIG.apiKey.length})` : "MISSING ❌");
console.log("- Project ID:", FIREBASE_CONFIG.projectId ? `LOADED (${FIREBASE_CONFIG.projectId})` : "MISSING ❌");
console.log("- Auth Domain:", FIREBASE_CONFIG.authDomain ? "LOADED" : "MISSING ❌");
console.log("- Storage Bucket:", FIREBASE_CONFIG.storageBucket ? "LOADED" : "MISSING ❌");
console.log("- Messaging Sender ID:", FIREBASE_CONFIG.messagingSenderId ? "LOADED" : "MISSING ❌");
console.log("- App ID:", FIREBASE_CONFIG.appId ? "LOADED" : "MISSING ❌");

// Initialize Firebase only if the core config details are present
if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId) {
  try {
    const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
    db = getFirestore(app);
    storage = getStorage(app);
    useFirebase = true;
    console.log("Firebase initialized successfully! 🔥");
    console.log("Firebase Mode (useFirebase):", useFirebase);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.log("Firebase credentials not found. Using localStorage fallback.");
}

/**
 * Uploads a file to Firebase Storage and returns the public download URL.
 * @param {File|Blob} file - The file to upload.
 * @param {string} path - Storage path.
 * @returns {Promise<string>} Download URL.
 */
export async function uploadToFirebaseStorage(file, path) {
  if (!storage) throw new Error("Firebase Storage is not initialized");
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

/**
 * Deletes a file from Firebase Storage using its URL.
 * @param {string} url - The download URL of the file.
 * @returns {Promise<void>}
 */
export async function deleteFromFirebaseStorage(url) {
  if (!storage) throw new Error("Firebase Storage is not initialized");
  const fileRef = ref(storage, url);
  await deleteObject(fileRef);
}

export { db, storage, useFirebase };
export default db;
