
CEANA Group Blog + Admin (Firebase + Google Drive Images)
=========================================================

Overview
--------
- Static site stays on GitHub Pages / your Squarespace-mapped domain.
- Blog content is stored in Firebase Firestore (reads live from the browser).
- Admin dashboard at /admin uses Google Sign-In for auth.
- Images can be uploaded directly to a Google Drive folder from the admin.
- No server needed. Posts and images appear instantly without redeploys.

New files
---------
- blog.html  → blog list
- post.html  → single post view (via ?slug=my-post)
- admin/index.html  → admin dashboard (Google Sign-In, blog CRUD, Drive uploads)
- assets/js/firebase-init.js  → paste your Firebase config + admin allowlist
- assets/js/blog-public.js, assets/js/post.js, assets/js/admin.js

Part 1: Firebase setup
----------------------
1) Open https://console.firebase.google.com and **Add project** (e.g., "ceanagroup").
2) When created, click the **Web** icon to add an app (nickname: "web"). Do *not* enable Firebase Hosting.
3) Copy the Web app config (apiKey, authDomain, projectId, appId, etc.).
4) In **Build → Authentication**: click **Get started**, then **Sign-in method → Google** → Enable. Save.
5) In **Authentication → Settings → Authorized domains**: add `ceanagroup.com` and your GitHub Pages host if you test there.
6) In **Build → Firestore Database**: **Create database**, choose **Production mode**, and a region near you.

Part 2: Paste config & allowlist
--------------------------------
1) Open `assets/js/firebase-init.js` and replace placeholder values in `firebaseConfig` with your config.
2) Add the admin emails to `adminAllowlist` (e.g., "you@domain.com"). If empty, any Google account can access /admin.

Part 3: Firestore security rules
--------------------------------
In Firebase → Firestore Database → **Rules**, publish:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if resource.data.published == true || request.auth != null;
      allow write: if request.auth != null;
    }
    match /submissions/{sid} {
      allow read, write: if request.auth != null;
    }
  }
}
```
This allows public reads of published posts, authenticated reads/writes for admins.

Part 4: Google Drive uploads (free, no server)
----------------------------------------------
1) Open https://console.cloud.google.com (same Google account).
2) Top bar: select your project (or **New Project** named "Ceana Admin").
3) **APIs & Services → Library**: enable **Google Drive API**.
4) **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Add your admin emails as **Test users**
   - Scopes: add `https://www.googleapis.com/auth/drive.file`
   - Save
5) **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins**: `https://ceanagroup.com` and (if testing) `https://<yourusername>.github.io`
   - Create and copy the **Client ID** (ends with `.apps.googleusercontent.com`).
6) In Google Drive:
   - Create a folder, e.g., **Blog Images**
   - Copy the **folder ID** from the URL (after `/folders/`)
   - Share the folder with your admin emails as **Editor**, or use a Shared Drive.
7) In `assets/js/admin.js` set:
   - `const GOOGLE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com"`
   - `const DRIVE_FOLDER_ID  = "YOUR_DRIVE_FOLDER_ID"`

How uploads work:
- Admin picks files → OAuth consent appears once → files upload into the folder → permission set to "Anyone with link: Reader" → `<img>` tags are inserted into the post content using a `uc?export=view&id=...` URL.

Part 5: Deploy
--------------
- Commit and push to your GitHub repo/branch.
- Ensure GitHub Pages serves the branch/folder you expect (Repository → Settings → Pages).
- If Squarespace maps your domain to GitHub Pages, no change needed.
- Visit:
  - `/admin/` to manage posts and images
  - `/blog.html` to view posts
  - `/post.html?slug=your-slug` for a single post

Part 6: First-time checks
-------------------------
- If `/blog.html` says **Failed to load posts**:
  - Click the "Create index" link shown in DevTools (composite index for `published + createdAt`).
- If `/admin` shows **Loading...**:
  - Ensure the Firestore **Rules** above are published.
  - Ensure your domain is listed in **Auth → Authorized domains**.
- If Drive upload fails:
  - Confirm Drive API is enabled and OAuth client origins include your domain.
  - Ensure you pasted `GOOGLE_CLIENT_ID` and `DRIVE_FOLDER_ID`.

Optional: contact form to Firestore
-----------------------------------
If you move off Formoid, change your contact form to write into the `submissions` collection (example code can be added later). Then `/admin` will display form entries.

Styling
-------
Pages include Mobirise `mbr-additional.css` and light utility CSS. You can skin them further to match your sections and hero blocks.

