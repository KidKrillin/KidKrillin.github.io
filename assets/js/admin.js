// assets/js/admin.js  (ES module)
// Prereq tag on /admin page: <script src="https://accounts.google.com/gsi/client" async defer></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig, adminAllowlist } from "./firebase-init.js";

// ---------- Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Config (Drive) ----------
const GOOGLE_CLIENT_ID = "265134911609-4euj5d1r7c7budo10invid8vb6eriko7.apps.googleusercontent.com";
const DRIVE_FOLDER_ID  = "1kLTX8xROslkv9sqLt6USR-_npG-nwud1";

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
const els = {
  // auth/ui
  loginBtn: $("signin-btn") || $("login-btn") || $("google-signin"),
  logoutBtn: $("logout-btn"),
  loginCard: $("login-card") || $("auth-card"),
  adminShell: $("admin-shell") || $("dashboard"),
  status: $("status"),

  // editor fields
  title: $("title"),
  slug: $("slug"),
  author: $("author"),
  content: $("content"),
  excerpt: $("excerpt"),
  published: $("published"),

  // actions
  saveBtn: $("save-draft"),
  publishBtn: $("publish-post"),
  deleteBtn: $("delete-post"),

  // drive upload
  gdriveInput: $("gdrive-images"),
  gdriveBtn: $("gdrive-upload-btn"),
  gdriveList: $("gdrive-uploaded"),

  // list (optional)
  postsList: $("posts-list"),
};

function setStatus(msg) {
  if (els.status) els.status.textContent = msg;
  console.log("[admin]", msg);
}

function slugify(s) {
  return (s || "").toString().trim().toLowerCase()
    .replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-+/g, "-");
}

function makeExcerpt(htmlOrText, maxLen = 180) {
  const tmp = document.createElement("div");
  tmp.innerHTML = (htmlOrText || "").toString();
  const txt = tmp.textContent || tmp.innerText || "";
  return txt.trim().slice(0, maxLen);
}

// ---------- Auth ----------
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

async function doSignIn() {
  const res = await signInWithPopup(auth, provider);
  const email = res.user?.email || "";
  if (!adminAllowlist.includes(email)) {
    alert("This account is not authorized.");
    await signOut(auth);
    throw new Error("Unauthorized email " + email);
  }
  return res.user;
}

async function doSignOut() {
  await signOut(auth);
}

onAuthStateChanged(auth, (user) => {
  const email = user?.email || "";
  const ok = user && adminAllowlist.includes(email);
  if (ok) {
    if (els.loginCard) els.loginCard.style.display = "none";
    if (els.adminShell) els.adminShell.style.display = "";
    setStatus("Signed in as " + email);
    loadPublishedPostsList().catch(console.warn);
  } else {
    if (els.adminShell) els.adminShell.style.display = "none";
    if (els.loginCard) els.loginCard.style.display = "";
    setStatus("Please sign in with an authorized account.");
  }
});

els.loginBtn?.addEventListener("click", async () => {
  try { await doSignIn(); } catch (e) { console.error(e); alert(e.message || "Sign-in failed"); }
});
els.logoutBtn?.addEventListener("click", async () => {
  try { await doSignOut(); } catch (e) { console.error(e); }
});

// Keep slug in sync with title by default
els.title?.addEventListener("input", () => {
  if (!els.slug?.dataset?.touched) els.slug.value = slugify(els.title.value);
});
els.slug?.addEventListener("input", () => { if (els.slug) els.slug.dataset.touched = "1"; });

// ---------- Save / Publish ----------
async function savePost(publish = false) {
  const email = auth.currentUser?.email || "";
  if (!adminAllowlist.includes(email)) { alert("Not authorized."); return; }

  const slug = slugify(els.slug?.value || els.title?.value || "");
  if (!slug) { alert("Enter a title/slug first."); return; }

  const postDoc = doc(db, "posts", slug); // upsert by slug; no read required

  const now = serverTimestamp();
  const post = {
    slug,
    title: (els.title?.value || "").toString(),
    author: (els.author?.value || email || "").toString(),
    contentHtml: (els.content?.value || "").toString(),
    excerpt: (els.excerpt?.value || makeExcerpt(els.content?.value)).toString(),
    updatedAt: now,
  };

  if (publish) {
    post.published = true;
    post.publishedAt = now;
    // set createdAt when publishing (first publish defines order)
    post.createdAt = now;
  } else {
    post.published = false;
  }

  await setDoc(postDoc, post, { merge: true });
  alert(publish ? "Post published." : "Draft saved.");
  loadPublishedPostsList().catch(console.warn);
}

els.saveBtn?.addEventListener("click", () => savePost(false).catch(e => { console.error(e); alert("Save failed: " + e.message); }));
els.publishBtn?.addEventListener("click", () => savePost(true).catch(e => { console.error(e); alert("Publish failed: " + e.message); }));

// Optional: load a published post into the editor by slug (click from list)
async function loadPostIntoEditor(slug) {
  try {
    const d = await getDoc(doc(db, "posts", slug));
    if (!d.exists()) { alert("Post not found."); return; }
    const p = d.data();
    els.title && (els.title.value = p.title || "");
    els.slug && (els.slug.value = p.slug || slug);
    els.author && (els.author.value = p.author || "");
    els.content && (els.content.value = p.contentHtml || p.content || "");
    els.excerpt && (els.excerpt.value = p.excerpt || "");
    if (els.published) els.published.checked = !!p.published;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    console.error(e);
    alert("Could not load post (note: drafts aren’t readable under current rules).");
  }
}

async function loadPublishedPostsList() {
  if (!els.postsList) return;
  els.postsList.innerHTML = "Loading...";
  try {
    const qRef = query(collection(db, "posts"), where("published", "==", true), limit(200));
    const snap = await getDocs(qRef);
    if (snap.empty) { els.postsList.textContent = "No published posts yet."; return; }
    const items = [];
    snap.forEach(d => { const p = d.data(); if (p?.slug) items.push(p); });
    items.sort((a,b) => {
      const ta = (a.createdAt?.seconds || a.createdAt?._seconds || 0);
      const tb = (b.createdAt?.seconds || b.createdAt?._seconds || 0);
      return tb - ta;
    });
    els.postsList.innerHTML = "";
    items.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="#" data-slug="${p.slug}">${p.title || p.slug}</a>`;
      li.querySelector("a").addEventListener("click", (e) => {
        e.preventDefault();
        loadPostIntoEditor(p.slug);
      });
      els.postsList.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    els.postsList.textContent = "Failed to load posts list.";
  }
}

// ---------- Google Drive upload (token flow, CDN URLs) ----------
let driveAccessToken = null;
let driveTokenClient = null;

function driveCdnUrl(id, w = 1600) {
  // Reliable image CDN URL for public Drive files
  return `https://lh3.googleusercontent.com/d/${id}=w${w}`;
}

function ensureGsiLoaded() {
  return !!(window.google && google.accounts && google.accounts.oauth2);
}

window.addEventListener("load", () => {
  if (!ensureGsiLoaded()) {
    console.warn("Google Identity script not loaded; Drive upload disabled.");
    els.gdriveBtn && (els.gdriveBtn.disabled = true);
    return;
  }
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: (r) => { driveAccessToken = r.access_token; }
  });
});

function getDriveTokenInteractive() {
  return new Promise((resolve, reject) => {
    if (driveAccessToken) return resolve(driveAccessToken);
    if (!driveTokenClient) return reject(new Error("Drive token client not ready"));
    driveTokenClient.callback = (r) => {
      if (r && r.access_token) { driveAccessToken = r.access_token; resolve(driveAccessToken); }
      else reject(new Error("No Drive access token"));
    };
    // must be in a user gesture (click)
    driveTokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function uploadToDriveFormData(file, folderId) {
  const metadata = { name: file.name, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,thumbnailLink", {
    method: "POST",
    headers: { "Authorization": "Bearer " + driveAccessToken },
    body: form
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive upload failed ${res.status}: ${JSON.stringify(data)}`);
  return data; // {id, ...}
}

async function makePublic(fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + driveAccessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });
  if (!r.ok) throw new Error(`Permission failed ${r.status}: ${await r.text()}`);
}

els.gdriveBtn?.addEventListener("click", async () => {
  try {
    if (!els.gdriveInput?.files || els.gdriveInput.files.length === 0) { alert("Choose one or more images first."); return; }
    await getDriveTokenInteractive();

    const base = els.slug?.value || els.title?.value || `post-${Date.now()}`;
    const slug = slugify(base);

    for (const f of els.gdriveInput.files) {
      const renamed = new File([f], `${slug}-${f.name}`, { type: f.type });
      const up = await uploadToDriveFormData(renamed, DRIVE_FOLDER_ID);
      await makePublic(up.id);

      const url = driveCdnUrl(up.id, 1600); // Insert CDN image URL
      if (els.content) els.content.value += `\n<p><img src="${url}" alt=""></p>\n`;

      // Show link in UI
      if (els.gdriveList) {
        const a = document.createElement("a");
        a.href = url; a.textContent = renamed.name; a.target = "_blank";
        els.gdriveList.appendChild(a);
        els.gdriveList.appendChild(document.createElement("br"));
      }
    }
    alert("Images uploaded and inserted into your post.");
  } catch (e) {
    console.error(e);
    alert(e.message || "Upload failed. Open DevTools for details.");
  }
});

// ---------- Optional: delete by slug (published/draft) ----------
els.deleteBtn?.addEventListener("click", async () => {
  const slug = slugify(els.slug?.value || "");
  if (!slug) { alert("Enter a slug first."); return; }
  // You can implement delete with deleteDoc if you add a rule to allow deletes for admins.
  alert("Delete not implemented. Ask me to add it if you want this feature.");
});

// ---------- End ----------
