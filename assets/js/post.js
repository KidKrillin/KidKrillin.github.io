import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const qp = new URL(location.href).searchParams;
const byId = (id) => document.getElementById(id);

async function renderPost() {
  const container = byId("post-container");
  if (!container) return;

  const slug = (qp.get("slug") || "").trim().toLowerCase();
  if (!slug) { container.textContent = "Missing slug."; return; }

  try {
    // Exact match only (no composite index required)
    const q1 = query(collection(db, "posts"), where("slug", "==", slug), limit(1));
    const snap = await getDocs(q1);
    if (snap.empty) { container.textContent = "Post not found."; return; }

    const p = snap.docs[0].data();
    if (!p.published) { container.textContent = "Post not found."; return; }

    document.title = (p.title || "Post") + " | Blog";
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
  } catch (e) {
    console.error(e);
    container.textContent = "Failed to load post.";
  }
}
document.addEventListener("DOMContentLoaded", renderPost);
