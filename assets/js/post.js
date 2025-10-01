import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getParam = (name) => new URL(location.href).searchParams.get(name);
const norm = (s) => (s ?? "").toString().trim().toLowerCase();

async function renderPost() {
  const container = document.getElementById("post-container");
  if (!container) return;

  const slug = norm(getParam("slug"));
  if (!slug) { container.textContent = "Missing slug."; return; }

  try {
    // Must include published == true to satisfy your Firestore rules
    const q1 = query(
      collection(db, "posts"),
      where("slug", "==", slug),
      where("published", "==", true),
      limit(1)
    );
    const snap = await getDocs(q1);
    if (snap.empty) { container.textContent = "Post not found."; return; }

    const p = snap.docs[0].data();

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
