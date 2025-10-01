import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function toDate(v) {
  try {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();          // Firestore Timestamp
    if (typeof v === "object" && "seconds" in v) return new Date(v.seconds * 1000); // {seconds, nanos}
    if (typeof v === "number") return new Date(v);                  // ms
    if (typeof v === "string") return new Date(v);                  // ISO
  } catch (_) {}
  return null;
}

async function renderBlogList() {
  const listContainer = document.getElementById("blog-list");
  if (!listContainer) return;
  listContainer.textContent = "Loading posts...";

  try {
    // Read only published posts (no composite index required), sort client-side
    const qRef = query(collection(db, "posts"), where("published", "==", true), limit(200));
    const snap = await getDocs(qRef);
    if (snap.empty) { listContainer.textContent = "No posts yet."; return; }

    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    posts.sort((a, b) => {
      const da = toDate(a.createdAt)?.getTime() || 0;
      const db_ = toDate(b.createdAt)?.getTime() || 0;
      return db_ - da;
    });

    listContainer.innerHTML = "";
    posts.forEach(p => {
      if (!p.slug) return; // must have slug to link to post page
      const created = toDate(p.createdAt);
      const dateStr = created ? created.toLocaleDateString() : "";
      const card = el(`
        <article class="blog-card">
          <h3><a href="post.html?slug=${encodeURIComponent(String(p.slug))}">${(p.title ?? "Untitled")}</a></h3>
          <p class="meta">${dateStr}${p.author ? " · " + String(p.author) : ""}</p>
          <p>${(p.excerpt ?? "").toString()}</p>
          <p><a href="post.html?slug=${encodeURIComponent(String(p.slug))}">Read more</a></p>
        </article>
      `);
      listContainer.appendChild(card);
    });

    if (!listContainer.children.length) listContainer.textContent = "No published posts yet.";
  } catch (e) {
    console.error(e);
    listContainer.innerHTML = `Failed to load posts. Check Firebase rules.`;
  }
}

document.addEventListener("DOMContentLoaded", renderBlogList);
