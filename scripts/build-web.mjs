// Copies the static site into www/ for the iPhone app (no bundler needed).
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const out = "www";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ["index.html", "app.js", "store.js", "billing.js", "ads.js", "native.js", "native-extras.js", "places.js", "reserved.js", "config.js", "styles.css", "privacy.html", "terms.html", "support.html", "favicon.png", "apple-touch-icon.png", "logo.png"]) cpSync(f, `${out}/${f}`);
if (existsSync("assets")) cpSync("assets", `${out}/assets`, { recursive: true });

// The iPhone app ships its libraries inside the app instead of downloading them at launch.
// capacitor.js provides Capacitor.registerPlugin (the native bridge alone doesn't).
const vendor = [
  ["node_modules/@capacitor/core/dist/capacitor.js", "capacitor.js"],
  ["node_modules/@supabase/supabase-js/dist/umd/supabase.js", "supabase.js"],
];
let tags = "";
mkdirSync(`${out}/vendor`, { recursive: true });
for (const [src, name] of vendor) {
  if (!existsSync(src)) { console.warn(`Missing ${src}`); continue; }
  cpSync(src, `${out}/vendor/${name}`);
  tags += `<script src="vendor/${name}"></script>\n  `;
  console.log(`Bundled ${name}`);
}
const html = readFileSync(`${out}/index.html`, "utf8").replace('<script src="config.js"></script>', `${tags}<script src="config.js"></script>`);
writeFileSync(`${out}/index.html`, html);
console.log("Built www/");
