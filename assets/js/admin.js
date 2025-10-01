import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig, adminAllowlist } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const els = {
  signedOut: document.getElementById("signed-out"),
  signedIn: document.getElementById("signed-in"),
  userEmail: document.getElementById("user-email"),
  loginBtn: document.getElementById("login-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  postsTbody: document.getElementById("posts-tbody"),
  postForm: document.getElementById("post-form"),
  formMode: document.getElementById("form-mode"),
  title: document.getElementById("title"),
  slug: document.getElementById("slug"),
  author: document.getElementById("author"),
  excerpt: document.getElementById("excerpt"),
  content: document.getElementById("content"),
  published: document.getElementById("published"),
  postId: document.getElementById("post-id"),
  submissionsTbody: document.getElementById("submissions-tbody"),
};

function isAllowed(email) {
  if (!adminAllowlist || adminAllowlist.length === 0) return true;
  return adminAllowlist.map(x => x.toLowerCase().trim()).includes((email||"").toLowerCase().trim());
}

function slugify(text) {
  return (text||"").toString().toLowerCase()
    .replace(/\s+/g, "-").replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
}

async function loadPosts() {
  try {
    const qy = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(qy);
    els.postsTbody.innerHTML = "";
    snap.forEach(d => {
      const p = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.title || ""}</td>
        <td>${p.slug || ""}</td>
        <td>${p.published ? "Yes" : "No"}</td>
        <td>
          <button data-id="${d.id}" class="edit-btn">Edit</button>
          <button data-id="${d.id}" class="delete-btn">Delete</button>
        </td>
      `;
      els.postsTbody.appendChild(tr);
    });
    document.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", async e => {
      const id = e.target.getAttribute("data-id");
      let docData = null;
      const all = await getDocs(collection(db, "posts"));
      all.forEach(dd => { if (dd.id === id) docData = {id: dd.id, ...dd.data()}; });
      if (!docData) return;
      els.formMode.textContent = "Edit post";
      els.postId.value = id;
      els.title.value = docData.title || "";
      els.slug.value = docData.slug || "";
      els.author.value = docData.author || "";
      els.excerpt.value = docData.excerpt || "";
      els.content.value = docData.content || "";
      els.published.checked = !!docData.published;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }));
    document.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", async e => {
      const id = e.target.getAttribute("data-id");
      if (!confirm("Delete this post")) return;
      await deleteDoc(doc(db, "posts", id));
      await loadPosts();
    }));
  } catch (e) {
    console.error(e);
    els.postsTbody.innerHTML = `<tr><td colspan="4">Error loading posts: ${e.message}</td></tr>`;
  }
}

async function loadSubmissions() {
  try {
    const snap = await getDocs(query(collection(db, "submissions"), orderBy("createdAt", "desc")));
    els.submissionsTbody.innerHTML = "";
    if (snap.empty) {
      els.submissionsTbody.innerHTML = "<tr><td colspan='4'>No submissions captured here yet.</td></tr>";
      return;
    }
    snap.forEach(d => {
      const s = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.name || ""}</td>
        <td>${s.email || ""}</td>
        <td>${s.message || ""}</td>
        <td>${s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : ""}</td>
      `;
      els.submissionsTbody.appendChild(tr);
    });
  } catch(e) {
    console.warn("Submissions unavailable", e);
    els.submissionsTbody.innerHTML = "<tr><td colspan='4'>Submissions not configured.</td></tr>";
  }
}

els.loginBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
});
els.logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

import.meta && onAuthStateChanged(auth, async user => {
  if (!user) {
    els.signedOut.style.display = "block";
    els.signedIn.style.display = "none";
    return;
  }
  if (!isAllowed(user.email)) {
    alert("Your account is not authorized.");
    await signOut(auth);
    return;
  }
  els.userEmail.textContent = user.email || "";
  els.signedOut.style.display = "none";
  els.signedIn.style.display = "block";
  await loadPosts();
  await loadSubmissions();
});

els.title?.addEventListener("input", () => {
  if (!els.slug.value) els.slug.value = slugify(els.title.value);
});

els.postForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    title: els.title.value.trim(),
    slug: (els.slug.value.trim() || slugify(els.title.value) || "").substring(0,120),
    author: els.author.value.trim(),
    excerpt: els.excerpt.value.trim(),
    content: els.content.value,
    published: els.published.checked,
    updatedAt: serverTimestamp()
  };
  const id = els.postId.value.trim();
  if (id) {
    await updateDoc(doc(db, "posts", id), payload);
  } else {
    await addDoc(collection(db, "posts"), { ...payload, createdAt: serverTimestamp() });
  }
  els.formMode.textContent = "New post";
  els.postId.value = "";
  els.postForm.reset();
  await loadPosts();
});

// ===== Google Drive upload (free) =====
// --- Google Drive auth + upload ---
const GOOGLE_CLIENT_ID = "265134911609-4euj5d1r7c7budo10invid8vb6eriko7.apps.googleusercontent.com";
const DRIVE_FOLDER_ID  = "1kLTX8xROslkv9sqLt6USR-_npG-nwud1";

let driveAccessToken = null;
let driveTokenClient = null;

window.addEventListener("load", () => {
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: (resp) => { driveAccessToken = resp.access_token; }
  });
});

function getDriveTokenInteractive() {
  return new Promise((resolve, reject) => {
    if (driveAccessToken) return resolve(driveAccessToken);
    driveTokenClient.callback = (resp) => {
      if (resp && resp.access_token) { driveAccessToken = resp.access_token; resolve(driveAccessToken); }
      else reject(new Error("No Drive access token"));
    };
    // Must be called inside a user gesture
    driveTokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function uploadToDriveFormData(file, folderId) {
  const metadata = { name: file.name, parents: [folderId] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
    method: "POST",
    headers: { "Authorization": "Bearer " + driveAccessToken },
    body: form
  });
  if (!res.ok) throw new Error(`Drive upload failed ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

async function makePublic(fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + driveAccessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });
  if (!r.ok) throw new Error(`Permission failed ${r.status}: ${await r.text()}`);
}

const gdriveInput = document.getElementById("gdrive-images");
const gdriveBtn = document.getElementById("gdrive-upload-btn");
const gdriveList = document.getElementById("gdrive-uploaded");

gdriveBtn?.addEventListener("click", async () => {
  try {
    if (!gdriveInput?.files || gdriveInput.files.length === 0) { alert("Choose one or more images first."); return; }
    await getDriveTokenInteractive();                     // guaranteed user gesture
    const slug = (document.getElementById("slug")?.value || document.getElementById("title")?.value || `post-${Date.now()}`)
                  .toString().toLowerCase().replace(/\s+/g,"-").replace(/[^\w\-]+/g,"");
    for (const f of gdriveInput.files) {
      const renamed = new File([f], `${slug}-${f.name}`, { type: f.type });
      const id = await uploadToDriveFormData(renamed, DRIVE_FOLDER_ID);
      await makePublic(id);
      const url = `https://drive.google.com/uc?export=view&id=${id}`;
      document.getElementById("content").value += `\n<p><img src="${url}" alt=""></p>\n`;
      const a = document.createElement("a"); a.href = url; a.textContent = renamed.name; a.target = "_blank";
      gdriveList.appendChild(a); gdriveList.appendChild(document.createElement("br"));
    }
    alert("Images uploaded and inserted.");
  } catch (e) {
    console.error(e);
    alert(e.message || "Upload failed. See console for details.");
  }
});
// --- end Drive section ---
