import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

async function renderBlogList() {
  const listContainer = document.getElementById("blog-list");
  if (!listContainer) return;
  listContainer.textContent = "Loading posts...";
  try {
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      listContainer.textContent = "No posts yet.";
      return;
    }
    listContainer.innerHTML = "";
    snap.forEach(doc => {
      const p = doc.data();
      const created = p.createdAt?.toDate ? p.createdAt.toDate() : null;
      const dateStr = created ? created.toLocaleDateString() : "";
      const card = el(`
        <article class="blog-card">
          <h3><a href="post.html?slug=${encodeURIComponent(p.slug)}">${p.title ?? "Untitled"}</a></h3>
          <p class="meta">${dateStr} ${p.author ? " · "+p.author : ""}</p>
          <p>${(p.excerpt ?? "").toString()}</p>
          <p><a href="post.html?slug=${encodeURIComponent(p.slug)}">Read more</a></p>
        </article>
      `);
      listContainer.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    listContainer.innerHTML = `Failed to load posts. Check Firebase index and rules. Open DevTools for details.`;
  }
}
document.addEventListener("DOMContentLoaded", renderBlogList);
