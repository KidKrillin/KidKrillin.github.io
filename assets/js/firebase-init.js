// Replace with your Firebase project's config (Project settings → Your apps → Web)
// Keep your apiKey key-restricted by domain in Google Cloud for safety.
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

// Optional: restrict admin access by email. Leave empty to allow any Google account to access /admin.
export const adminAllowlist = [
  // "you@domain.com"
];
