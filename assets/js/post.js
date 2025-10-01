import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-init.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getParam = (name) => new URL(location.href).searchParams.get(name) || "";

function normalizeDriveLinks(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/https?:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view[^\s"'<>]*/g,
             "https://drive.google.com/uc?export=view&id=$1")
    .replace(/https?:\/\/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/g,
             "https://drive.google.com/uc?export=view&id=$1")
    .replace(/https?:\/\/drive\.usercontent\.google\.com\/download\?id=([A-Za-z0-9_-]+)[^"'<>]*/g,
             "https://drive.google.com/uc?export=view&id=$1")
    .replace(/https?:\/\/drive\.google\.com\/uc\?id=([A-Za-z0-9_-]+)&export=download/g,
             "https://drive.google.com/uc?export=view&id=$1");
}

async function renderPost() {
  const container = document.getElementById("post-container");
  if (!container) return;

  const slug = getParam("slug").trim().toLowerCase();
  if (!slug) { container.textContent = "Missing slug."; return; }

  try {
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

    const rawHtml = typeof p.contentHtml === "string"
      ? p.contentHtml
      : ((p.content ?? "").toString().replace(/\n/g, "<br>"));

    const html = normalizeDriveLinks(rawHtml);

    container.innerHTML = `
      <article class="blog-post">
        <h1>${p.title ? String(p.title) : "Untitled"}</h1>
        <p class="meta">${p.author ? String(p.author) : ""}</p>
        <div class="content">${html}</div>
      </article>
    `;

    container.querySelectorAll(".content img").forEach(img => {
      img.loading = "lazy";
      img.decoding = "async";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
    });
  } catch (e) {
    console.error(e);
    container.textContent = "Failed to load post.";
  }
}

document.addEventListener("DOMContentLoaded", renderPost);
