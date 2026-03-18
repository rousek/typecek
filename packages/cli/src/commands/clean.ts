import fs from "fs";
import path from "path";
import { findTsconfigRoot } from "./compile.js";

export function clean(): void {
  const projectRoot = findTsconfigRoot();
  const typekDir = path.join(projectRoot, ".typek");

  if (fs.existsSync(typekDir)) {
    fs.rmSync(typekDir, { recursive: true, force: true });
    console.log("Removed .typek/ directory.");
  } else {
    console.log("Nothing to clean — .typek/ does not exist.");
  }
}
