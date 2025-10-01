import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const norm = (s) => (s ?? "").toString().trim().toLowerCase();

async function fetchPostBySlug(slugRaw) {
  const slug = norm(slugRaw);
  const postsRef = collection(db, "posts");

  // 1) Exact match (fast, no composite index)
  try {
    const q1 = query(postsRef, where("slug", "==", slug), limit(1));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return { id: snap1.docs[0].id, ...snap1.docs[0].data() };
  } catch (e) {
    console.warn("Exact slug query failed:", e);
  }

  // 2) Fallback: scan and match case/space-insensitive (works around stray slugs)
  try {
    const all = await getDocs(postsRef);
    let found = null;
    all.forEach(d => {
      const p = d.data();
      if (norm(p.slug) === slug && !found) found = { id: d.id, ...p };
    });
    if (found) return found;
  } catch (e) {
    console.warn("Fallback scan failed:", e);
  }

  return null;
}

function renderPostInto(container, p) {
  const html = typeof p.contentHtml === "string"
    ? p.contentHtml
    : ((p.content ?? "").toString().replace(/\n/g, "<br>"));

  container.innerHTML = `
    <article class="blog-post">
      <h1>${p.title ? String(p.title) : "Untitled"}</h1>
      <p class="meta">${p.author ? String(p.author) : ""}</p>
      <div class="content">${html}</div>
    </article>
  `;
}

async function renderPost() {
  const container = $("post-container");
  if (!container) return;

  const slugParam = new URL(location.href).searchParams.get("slug");
  if (!slugParam) { container.textContent = "Missing slug."; return; }

  try {
    const p = await fetchPostBySlug(slugParam);
    if (!p || !p.published) { container.textContent = "Post not found."; return; }

    document.title = (p.title || "Post") + " | Blog";
    renderPostInto(container, p);
  } catch (e) {
    console.error(e);
    container.textContent = "Failed to load post.";
  }
}

document.addEventListener("DOMContentLoaded", renderPost);
