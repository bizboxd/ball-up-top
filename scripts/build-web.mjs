// Copies the static site into www/ for the iPhone app (no bundler needed).
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
const out = "www";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ["index.html", "app.js", "store.js", "billing.js", "ads.js", "reserved.js", "config.js", "styles.css", "privacy.html", "terms.html", "support.html", "favicon.png", "apple-touch-icon.png", "logo.png"]) cpSync(f, `${out}/${f}`);
if (existsSync("assets")) cpSync("assets", `${out}/assets`, { recursive: true });
console.log("Built www/");
