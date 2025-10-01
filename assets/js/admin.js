// assets/js/admin.js — stable with Drive upload + click-to-edit
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig, adminAllowlist } from "./firebase-init.js";

// ----- Firebase -----
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ----- Google Drive (use the client ID and folder you gave me) -----
const GOOGLE_CLIENT_ID = "265134911609-4euj5d1r7c7budo10invid8vb6eriko7.apps.googleusercontent.com";
const DRIVE_FOLDER_ID  = "1kLTX8xROslkv9sqLt6USR-_npG-nwud1";

// ----- DOM -----
const $ = (id) => document.getElementById(id);
const els = {
  // auth/ui
  loginBtn: $("signin-btn"),
  logoutBtn: $("logout-btn"),
  loginCard: $("login-card"),
  adminShell: $("admin-shell"),
  status: $("status"),

  // editor
  title: $("title"),
  slug: $("slug"),
  author: $("author"),
  content: $("content"),
  excerpt: $("excerpt"),
  saveBtn: $("save-draft"),
  publishBtn: $("publish-post"),

  // list
  postsList: $("posts-list"),

  // drive
  gdriveInput: $("gdrive-images"),
  gdriveBtn: $("gdrive-upload-btn"),
  gdriveList: $("gdrive-uploaded"),
};

const say = (m) => { if (els.status) els.status.textContent = m; console.log("[admin]", m); };
const slugify = (s) => (s||"").toLowerCase().trim().replace(/\s+/g,"-").replace(/[^\w\-]+/g,"").replace(/\-+/g,"-");
const excerptFrom = (html, n=180) => { const d=document.createElement("div"); d.innerHTML=html||""; return (d.textContent||"").trim().slice(0,n); };

// ----- Auth -----
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

async function doSignIn() {
  const res = await signInWithPopup(auth, provider);
  const email = res.user?.email || "";
  if (!adminAllowlist.includes(email)) {
    await signOut(auth);
    throw new Error("This account is not authorized.");
  }
}

onAuthStateChanged(auth, (user) => {
  const email = user?.email || "";
  const ok = !!user && adminAllowlist.includes(email);
  if (ok) {
    els.loginCard.style.display = "none";
    els.adminShell.style.display = "";
    els.logoutBtn.style.display = "";
    say("Signed in as " + email);
    loadPublishedPostsList().catch(console.error);
  } else {
    els.adminShell.style.display = "none";
    els.loginCard.style.display = "";
    els.logoutBtn.style.display = "none";
    say("Please sign in with an authorized account.");
  }
});

els.loginBtn?.addEventListener("click", async () => {
  try { await doSignIn(); } catch (e) { alert(e.message || "Sign-in failed"); }
});
els.logoutBtn?.addEventListener("click", async () => { try { await signOut(auth); } catch(e){ console.error(e); } });

// keep slug synced from title unless manually edited
els.title?.addEventListener("input", () => {
  if (!els.slug?.dataset?.touched) els.slug.value = slugify(els.title.value);
});
els.slug?.addEventListener("input", () => { if (els.slug) els.slug.dataset.touched = "1"; });

// ----- Editor helpers -----
function fillEditor(p, fallbackSlug="") {
  els.title && (els.title.value = p.title || "");
  els.slug && (els.slug.value = p.slug || fallbackSlug || "");
  els.author && (els.author.value = p.author || "");
  els.content && (els.content.value = p.contentHtml || p.content || "");
  els.excerpt && (els.excerpt.value = p.excerpt || excerptFrom(p.contentHtml || p.content || ""));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadPostIntoEditor(slug) {
  try {
    const ref = doc(db, "posts", slug);
    const d = await getDoc(ref); // allowed for published posts under your rules
    if (!d.exists()) { alert("Post not found."); return; }
    fillEditor(d.data(), slug);
  } catch (e) {
    console.error(e);
    alert("Could not load post.");
  }
}

// ----- Save / Publish -----
async function savePost(publish=false) {
  const user = auth.currentUser;
  if (!user) return alert("Sign in first.");
  if (!adminAllowlist.includes(user.email || "")) return alert("Not authorized.");

  const slug = slugify(els.slug?.value || els.title?.value || "");
  if (!slug) return alert("Enter a title/slug.");

  const ref = doc(db, "posts", slug);
  const exists = (await getDoc(ref)).exists();

  const base = {
    slug,
    title: els.title?.value || "",
    author: els.author?.value || (user.email || ""),
    contentHtml: els.content?.value || "",
    excerpt: els.excerpt?.value || excerptFrom(els.content?.value || ""),
    updatedAt: serverTimestamp(),
  };

  if (publish) {
    base.published = true;
    base.publishedAt = serverTimestamp();
    if (!exists) base.createdAt = serverTimestamp();
  } else {
    base.published = false;
  }

  await setDoc(ref, base, { merge: true });
  alert(publish ? "Post updated & published." : "Draft saved.");
  loadPublishedPostsList().catch(console.error);
}

els.saveBtn?.addEventListener("click", () => savePost(false));
els.publishBtn?.addEventListener("click", () => savePost(true));

// ----- List & click-to-edit (published only) -----
async function loadPublishedPostsList() {
  if (!els.postsList) return;
  els.postsList.innerHTML = "Loading...";
  try {
    const qRef = query(collection(db, "posts"), where("published","==", true), limit(200));
    const snap = await getDocs(qRef);
    if (snap.empty) { els.postsList.textContent = "No published posts yet."; return; }
    const items = snap.docs.map(d => d.data());
    items.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    els.postsList.innerHTML = "";
    items.forEach(p => {
      if (!p.slug) return;
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="#" data-slug="${p.slug}">${p.title || p.slug}</a>
        &nbsp;·&nbsp;<a href="../post.html?slug=${encodeURIComponent(p.slug)}" target="_blank">View</a>
      `;
      li.querySelector('a[data-slug]')?.addEventListener("click", (e) => {
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

// ====== Google Drive upload (token flow, inserts uc?export=view) ======
let driveAccessToken = null;
let driveTokenClient = null;

function ensureGsiLoaded() {
  return !!(window.google && google.accounts && google.accounts.oauth2);
}

window.addEventListener("load", () => {
  if (!ensureGsiLoaded()) {
    console.warn("Google Identity script not loaded; Drive upload disabled.");
    if (els.gdriveBtn) els.gdriveBtn.disabled = true;
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
    // must run inside user click
    driveTokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function uploadToDriveFormData(file, folderId) {
  const metadata = { name: file.name, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,thumbnailLink",
    { method: "POST", headers: { "Authorization": "Bearer " + driveAccessToken }, body: form }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive upload failed ${res.status}: ${JSON.stringify(data)}`);
  return data; // { id, name, ... }
}

async function makePublic(fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + driveAccessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });
  if (!r.ok) throw new Error(`Permission failed ${r.status}: ${await r.text()}`);
}

function driveViewUrl(id) {
  return `https://drive.google.com/uc?export=view&id=${id}`;
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

      const url = driveViewUrl(up.id);
      if (els.content) els.content.value += `\n<p><img src="${url}" alt=""></p>\n`;

      if (els.gdriveList) {
        const a = document.createElement("a");
        a.href = url; a.textContent = renamed.name; a.target = "_blank";
        els.gdriveList.appendChild(a);
        els.gdriveList.appendChild(document.createElement("br"));
      }
    }
    alert("Images uploaded and inserted.");
  } catch (e) {
    console.error(e);
    alert(e.message || "Upload failed. Open DevTools for details.");
  }
});
