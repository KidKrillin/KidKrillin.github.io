// assets/js/admin.js — rollback + click-to-edit for published posts
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig, adminAllowlist } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const els = {
  loginBtn: $("signin-btn"),
  logoutBtn: $("logout-btn"),
  loginCard: $("login-card"),
  adminShell: $("admin-shell"),
  status: $("status"),
  title: $("title"),
  slug: $("slug"),
  author: $("author"),
  content: $("content"),
  excerpt: $("excerpt"),
  saveBtn: $("save-draft"),
  publishBtn: $("publish-post"),
  postsList: $("posts-list"),
};

function say(msg){ if (els.status) els.status.textContent = msg; console.log("[admin]", msg); }
function slugify(s){ return (s||"").toLowerCase().trim().replace(/\s+/g,"-").replace(/[^\w\-]+/g,"").replace(/\-+/g,"-"); }
function excerptFrom(html, n=180){ const d=document.createElement("div"); d.innerHTML=(html||""); return (d.textContent||"").trim().slice(0,n); }

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

async function doSignIn(){
  const res = await signInWithPopup(auth, provider);
  const email = res.user?.email || "";
  if (!adminAllowlist.includes(email)) {
    await signOut(auth);
    throw new Error("This account is not authorized.");
  }
}

async function doSignOut(){ await signOut(auth); }

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
  try { await doSignIn(); } catch(e){ alert(e.message || "Sign-in failed"); }
});
els.logoutBtn?.addEventListener("click", () => doSignOut());

els.title?.addEventListener("input", () => {
  if (!els.slug.dataset.touched) els.slug.value = slugify(els.title.value);
});
els.slug?.addEventListener("input", () => { els.slug.dataset.touched = "1"; });

function fillEditor(p, slug){
  els.title && (els.title.value = p.title || "");
  els.slug && (els.slug.value = p.slug || slug || "");
  els.author && (els.author.value = p.author || "");
  els.content && (els.content.value = p.contentHtml || p.content || "");
  els.excerpt && (els.excerpt.value = p.excerpt || excerptFrom(p.contentHtml || p.content || ""));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadPostIntoEditor(slug){
  try {
    const ref = doc(db, "posts", slug);
    const d = await getDoc(ref);                 // published posts are readable under your rules
    if (!d.exists()) { alert("Post not found."); return; }
    fillEditor(d.data(), slug);
  } catch (e) {
    console.error(e);
    alert("Could not load post.");
  }
}

async function savePost(publish=false){
  const user = auth.currentUser;
  if (!user) return alert("Sign in first.");
  if (!adminAllowlist.includes(user.email || "")) return alert("Not authorized.");

  const slug = slugify(els.slug.value || els.title.value || "");
  if (!slug) return alert("Enter a title/slug.");

  const ref = doc(db, "posts", slug);
  const existing = await getDoc(ref);

  const base = {
    slug,
    title: els.title.value || "",
    author: els.author.value || (user.email || ""),
    contentHtml: els.content.value || "",
    excerpt: els.excerpt.value || excerptFrom(els.content.value),
    updatedAt: serverTimestamp(),
  };

  if (publish) {
    base.published = true;
    base.publishedAt = serverTimestamp();
    if (!existing.exists()) base.createdAt = serverTimestamp();
  } else {
    base.published = false;
  }

  await setDoc(ref, base, { merge: true });
  alert(publish ? "Post published." : "Draft saved.");
  loadPublishedPostsList().catch(console.error);
}

els.saveBtn?.addEventListener("click", () => savePost(false));
els.publishBtn?.addEventListener("click", () => savePost(true));

async function loadPublishedPostsList(){
  if (!els.postsList) return;
  els.postsList.innerHTML = "Loading...";
  try {
    const qRef = query(collection(db, "posts"), where("published","==", true), limit(200));
    const snap = await getDocs(qRef);
    if (snap.empty) { els.postsList.textContent = "No published posts yet."; return; }
    const items = snap.docs.map(d => d.data());
    items.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    els.postsList.innerHTML = "";
    items.forEach(p => {
      if (!p.slug) return;
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
