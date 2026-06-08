/**
 * Hashes a plain-text password using the SHA-256 algorithm via Web Crypto API.
 * @param {string} password - The password to hash.
 * @returns {Promise<string>} The hex-encoded SHA-256 hash.
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

/**
 * Validates a user-entered password against the secure stored hash.
 * Falls back to "guggu" hash if the environment variable is not configured.
 * @param {string} password - Plain text password entered by user.
 * @returns {Promise<boolean>} True if valid, false otherwise.
 */
export async function verifyPassword(password) {
  const userHash = await hashPassword(password);
  
  // Default to "guggu" hash as fallback if no env variable is provided
  const targetHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH || "97a9214378dbf3de3dfc0d0baa7672665843338b7cc9a462098bf91eaae4191f";
  
  if (!import.meta.env.VITE_ADMIN_PASSWORD_HASH) {
    console.warn("VITE_ADMIN_PASSWORD_HASH is not defined in environment variables. Falling back to default.");
  }
  
  return userHash === targetHash;
}

/**
 * Persists the authenticated session.
 */
export function setSessionAuthenticated() {
  localStorage.setItem("guggu_authenticated", "true");
}

/**
 * Clears the authenticated session (logout).
 */
export function clearSession() {
  localStorage.removeItem("guggu_authenticated");
}

/**
 * Checks if a valid authenticated session exists.
 * @returns {boolean}
 */
export function isSessionAuthenticated() {
  return localStorage.getItem("guggu_authenticated") === "true";
}
