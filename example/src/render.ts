import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import renderCart from "@typek/render/cart.html";
import renderEmail from "@typek/render/email.html";
import renderProfile from "@typek/render/profile.html";
import renderStore from "@typek/render/store.html";

import { cartData, emailData, profileData, storeData } from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");

fs.mkdirSync(distDir, { recursive: true });

const files: Array<{ name: string; html: string }> = [
  { name: "store.html", html: renderStore(storeData) },
  { name: "cart.html", html: renderCart(cartData) },
  { name: "profile.html", html: renderProfile(profileData) },
  { name: "email.html", html: renderEmail(emailData) },
];

for (const file of files) {
  const outPath = path.join(distDir, file.name);
  fs.writeFileSync(outPath, file.html);
  console.log(`  ✓ ${file.name} (${file.html.length} bytes)`);
}

console.log(`\nDone! Open dist/ to view the rendered HTML files.`);
