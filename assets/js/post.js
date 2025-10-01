import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

async function renderPost() {
  const container = document.getElementById("post-container");
  if (!container) return;
  const slug = getParam("slug");
  if (!slug) { container.textContent = "Missing slug."; return; }
  try {
    // Fetch by slug only (no composite index needed)
    const postsRef = collection(db, "posts");
    const q = query(postsRef, where("slug", "==", slug), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) { container.textContent = "Post not found."; return; }

    const doc = snap.docs[0];
    const p = doc.data();

    // Hide unpublished posts from public
    if (!p.published) { container.textContent = "Post not found."; return; }

    document.title = (p.title || "Post") + " | Blog";
    const pHtml = typeof p.contentHtml === "string"
      ? p.contentHtml
      : ((p.content || "").toString().replace(/\n/g, "<br>"));

    container.innerHTML = "";
    const article = el(`
      <article class="blog-post">
        <h1>${p.title ? String(p.title) : "Untitled"}</h1>
        <p class="meta">${p.author ? String(p.author) : ""}</p>
        <div class="content">${pHtml}</div>
      </article>
    `);
    container.appendChild(article);
  } catch (e) {
    console.error(e);
    container.textContent = "Failed to load post.";
  }
}

document.addEventListener("DOMContentLoaded", renderPost);
