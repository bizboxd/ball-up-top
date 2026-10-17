// Copies the static site into www/ for the iPhone app (no bundler needed).
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const out = "www";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ["index.html", "app.js", "store.js", "billing.js", "ads.js", "reserved.js", "config.js", "styles.css", "privacy.html", "terms.html", "support.html", "favicon.png", "apple-touch-icon.png", "logo.png"]) cpSync(f, `${out}/${f}`);
if (existsSync("assets")) cpSync("assets", `${out}/assets`, { recursive: true });

// The iPhone app ships the database library inside the app instead of downloading it at launch.
const sb = "node_modules/@supabase/supabase-js/dist/umd/supabase.js";
if (existsSync(sb)) {
  mkdirSync(`${out}/vendor`, { recursive: true });
  cpSync(sb, `${out}/vendor/supabase.js`);
  const html = readFileSync(`${out}/index.html`, "utf8").replace('<script src="config.js"></script>', '<script src="vendor/supabase.js"></script>\n  <script src="config.js"></script>');
  writeFileSync(`${out}/index.html`, html);
  console.log("Bundled supabase-js");
} else {
  console.warn("supabase-js not installed; the app will load it from the CDN");
}
console.log("Built www/");
