ENVISION PATCH  -  what to do
=============================
Copy these files over the ones in D:\invision (same names), then deploy:

  cms.js, script.js
  about.html, contact.html, events.html, incubation.html,
  index.html, odyssey.html, tedx.html, yes.html
  (403/404/500.html and everything else stay as they are)

After deploying, hard-refresh the site (Ctrl+F5), because browsers cache
script.js and cms.js.

TEST THAT SAVING NOW STICKS
  1. Open  <your site>/index.html?cms=admin
  2. Sign in with email + password, then type the 6-digit code from the
     authenticator app when the code box appears.
  3. Change a headline, click "Publish Changes".
  4. Supabase dashboard > Table Editor > site_content: a row for index.html
     should now exist.
  5. Open the normal address (no ?cms) and refresh: the edit is still there.
     Open it in a private window: visitors see it too.

WHAT CHANGED
  HTML pages  - every editable element now has a permanent data-cms-id (and
                grids a data-cms-grid-id). Before, these numbers were handed
                out at runtime and shifted whenever the page changed, so
                saved edits could land on the wrong element. Content of the
                pages is otherwise unchanged.
  script.js   - new read-only loader at the end: fetches the published row
                for the current page and applies it (sanitised). Uses only the
                public key; writing stays blocked by your database rules.
  cms.js      - same row name for /about, /about.html and local files;
                unique ids for elements created in the editor; uploaded
                PNG/JPEG/GIF/WEBP images survive saving; saved image paths
                are stored as written (not as file:///D:/... paths);
                stored colours/styles/transforms/image links are validated;
                the publisher's user id is saved in updated_by.

KNOWN LIMITS (not fixed by this patch)
  - Hero photo/video settings and the Navigation Manager list are still
    saved only in the browser (localStorage), not in Supabase, so they do
    not reach visitors yet.
  - Large uploaded images are stored inside the database as text; keep
    them small (or host them and paste the https link instead).

tools/tag-ids.js  re-creates the permanent ids (run it only on HTML files
                  that do not have them yet). tools/test-loader.js is the
                  test used to check the loader.
