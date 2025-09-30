import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

async function renderPost() {
  const container = document.getElementById("post-container");
  const slug = getParam("slug");
  if (!slug) { container.textContent = "Missing slug."; return; }
  try {
    const postsRef = collection(db, "posts");
    const q = query(postsRef, where("slug","==", slug), where("published","==", true), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) { container.textContent = "Post not found."; return; }
    const doc = snap.docs[0];
    const p = doc.data();
    document.title = (p.title || "Post") + " | Blog";
    container.innerHTML = "";
    const article = el(`
      <article class="blog-post">
        <h1>${p.title ?? "Untitled"}</h1>
        <p class="meta">${p.author ? p.author : ""}</p>
        <div class="content">${p.contentHtml ?? (p.content ?? "").replace(/\n/g,"<br>")}</div>
      </article>
    `);
    container.appendChild(article);
  } catch (e) {
    console.error(e);
    container.textContent = "Failed to load post.";
  }
}
document.addEventListener("DOMContentLoaded", renderPost);
