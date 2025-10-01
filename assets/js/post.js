function extractDriveId(u) {
  try {
    const url = new URL(u);
    if (url.hostname.includes('googleusercontent') && url.pathname.startsWith('/download')) {
      return url.searchParams.get('id');
    }
    if (url.hostname === 'drive.google.com') {
      if (url.pathname.startsWith('/file/d/')) return url.pathname.split('/')[3];
      if (url.searchParams.get('id')) return url.searchParams.get('id');
    }
  } catch(_) {}
  return null;
}
function toDriveCdn(html) {
  if (typeof html !== 'string') return '';
  return html
    // file/d/{id}/view
    .replace(/https?:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view[^\s"'<>]*/g,
             (_,id) => `https://lh3.googleusercontent.com/d/${id}=w1600`)
    // open?id={id}  OR  uc?export=view&id={id}
    .replace(/https?:\/\/drive\.google(?:usercontent)?\.com\/(?:open\?id=|uc\?[^"'<>]*id=)([A-Za-z0-9_-]+)/g,
             (_,id) => `https://lh3.googleusercontent.com/d/${id}=w1600`)
    // drive.usercontent.google.com/download?id={id}&...
    .replace(/https?:\/\/drive\.usercontent\.google\.com\/download\?id=([A-Za-z0-9_-]+)[^"'<>]*/g,
             (_,id) => `https://lh3.googleusercontent.com/d/${id}=w1600`);
}

// …after you build `html` and before injecting:
const normalized = toDriveCdn(raw);

// inject
container.innerHTML = `
  <article class="blog-post">
    <h1>${p.title ? String(p.title) : "Untitled"}</h1>
    <p class="meta">${p.author ? String(p.author) : ""}</p>
    <div class="content">${normalized}</div>
  </article>
`;

// make imgs responsive + add fallback
container.querySelectorAll('.content img').forEach(img => {
  img.loading = 'lazy'; img.decoding = 'async';
  img.style.maxWidth = '100%'; img.style.height = 'auto';
  const id = extractDriveId(img.src);
  if (!id) return;
  img.addEventListener('error', () => {
    // fallback to classic view URL if CDN variant fails
    img.src = `https://drive.google.com/uc?export=view&id=${id}`;
  }, { once:true });
});
