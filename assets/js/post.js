function normalizeDriveLinks(html) {
  return html
    // file/d/{id}/view → uc?export=view
    .replace(/https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view[^"' ]*/g,
             'https://drive.google.com/uc?export=view&id=$1')
    // open?id={id} → uc?export=view
    .replace(/https:\/\/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/g,
             'https://drive.google.com/uc?export=view&id=$1')
    // usercontent download url → uc?export=view
    .replace(/https:\/\/drive\.usercontent\.google\.com\/download\?id=([A-Za-z0-9_-]+)[^"' ]*/g,
             'https://drive.google.com/uc?export=view&id=$1')
    // uc?export=download → uc?export=view
    .replace(/https:\/\/drive\.google\.com\/uc\?id=([A-Za-z0-9_-]+)&export=download/g,
             'https://drive.google.com/uc?export=view&id=$1');
}

function extractDriveId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('googleusercontent') || u.hostname.includes('drive.google.com')) {
      if (u.pathname.startsWith('/file/d/')) return u.pathname.split('/')[3];
      if (u.searchParams.get('id')) return u.searchParams.get('id');
    }
  } catch(_) {}
  return null;
}

async function renderPost() {
  const container = document.getElementById("post-container");
  if (!container) return;

  const slug = (new URL(location.href).searchParams.get("slug") || "").trim().toLowerCase();
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

    // Make images responsive + add fallback if a link still fails
    container.querySelectorAll(".content img").forEach(img => {
      img.loading = "lazy";
      img.decoding = "async";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.addEventListener("error", () => {
        const id = extractDriveId(img.src);
        if (!id) return;
        // 1st fallback: try download endpoint
        img.src = `https://drive.google.com/uc?export=download&id=${id}`;
        // 2nd fallback (optional): Drive API direct content
        setTimeout(() => {
          if (!img.complete || img.naturalWidth) return; // already ok
          const key = firebaseConfig.apiKey; // works if your API key allows Drive API
          img.src = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(key)}`;
        }, 250);
      }, { once: true });
    });
  } catch (e) {
    console.error(e);
    container.textContent = "Failed to load post.";
  }
}
document.addEventListener("DOMContentLoaded", renderPost);
