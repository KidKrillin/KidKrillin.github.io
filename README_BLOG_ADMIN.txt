
CEANA Group Blog and Admin Layer
================================

What was added
--------------
1. /blog.html lists published posts stored in Firebase Firestore.
2. /post.html renders a single post by slug parameter.
3. /admin/ is a protected dashboard with Google Sign In. It lets authorized users create, edit, publish, and delete posts. It can also show form submissions if you migrate your forms to Firestore.
4. assets/js/firebase-init.js holds your Firebase config and an optional admin allowlist.
5. assets/js/blog-public.js, assets/js/post.js, assets/js/admin.js implement the blog and admin logic.

Quick start
-----------
1) Create a Firebase project at https://console.firebase.google.com
2) Enable Authentication with Google provider.
3) Create a Firestore database in production mode.
4) Get your Web App config and paste into assets/js/firebase-init.js
5) Optionally fill adminAllowlist with allowed emails. If left empty, any Google signed-in account can access the admin.

Firestore collections
---------------------
- posts: { title, slug, author, excerpt, content, published, createdAt, updatedAt }
- submissions (optional): { name, email, message, createdAt }

Security rules (starter)
------------------------
Update Firestore rules as needed. Example starter that only allows authenticated users to write and everyone to read published posts:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if resource.data.published == true;
      allow write: if request.auth != null;
      // allow read unpublished to admins only if you add custom claims or check allowlist via Cloud Functions
    }
    match /submissions/{sid} {
      allow read, write: if request.auth != null;
    }
  }
}

Form submissions
----------------
Your current forms post to Formoid. If you want submissions to appear in the Admin page:
- Replace the form submit handler to write to Firestore "submissions"
- Or move to a Firebase Cloud Function or a simple inline script that captures inputs and calls Firestore
A simple example is included in admin to read the "submissions" collection.

Deploy
------
- Commit these files and push to your GitHub Pages branch.
- Ensure your site serves ES modules. The Firebase SDK is loaded via ESM from gstatic which works on static hosting.

URLs
----
- Blog list: /blog.html
- Single post: /post.html?slug=my-post
- Admin dashboard: /admin/

Notes
-----
- For a richer editor, you can drop a small WYSIWYG like Quill or TinyMCE in /admin and store HTML in contentHtml.
- The navbar "Blog" link was auto-injected into index.html when possible.
- Keep apiKey restrictions in Google Cloud to your domain.
- You can optionally create a Cloud Function to enforce email allowlist server-side and to manage drafts.
