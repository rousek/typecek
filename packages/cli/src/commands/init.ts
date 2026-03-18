import fs from "fs";
import path from "path";

export function init(): void {
  const cwd = process.cwd();
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  const gitignorePath = path.join(cwd, ".gitignore");

  // Update tsconfig.json
  if (!fs.existsSync(tsconfigPath)) {
    console.error("tsconfig.json not found in current directory.");
    process.exitCode = 1;
    return;
  }

  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
  const compilerOptions = tsconfig.compilerOptions ?? {};
  const rootDirs: string[] = compilerOptions.rootDirs ?? [];

  let tsconfigChanged = false;

  if (!rootDirs.includes("./.typek")) {
    rootDirs.push("./.typek");
    compilerOptions.rootDirs = rootDirs;
    tsconfig.compilerOptions = compilerOptions;
    tsconfigChanged = true;
  }

  // Ensure rootDirs has the source dir too
  const rootDir = compilerOptions.rootDir ?? "./src";
  if (!rootDirs.includes(rootDir) && !rootDirs.includes(rootDir.replace(/^\.\//, ""))) {
    rootDirs.unshift(rootDir);
    tsconfigChanged = true;
  }

  if (tsconfigChanged) {
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n");
    console.log("Updated tsconfig.json with rootDirs.");
  } else {
    console.log("tsconfig.json already configured.");
  }

  // Update .gitignore
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".typek")) {
      fs.appendFileSync(gitignorePath, "\n# Typek compiled output\n.typek/\n");
      console.log("Added .typek/ to .gitignore.");
    } else {
      console.log(".gitignore already includes .typek/.");
    }
  } else {
    fs.writeFileSync(gitignorePath, "# Typek compiled output\n.typek/\n");
    console.log("Created .gitignore with .typek/.");
  }

  // Create .typek directory
  const typekDir = path.join(cwd, ".typek");
  if (!fs.existsSync(typekDir)) {
    fs.mkdirSync(typekDir, { recursive: true });
  }

  console.log("Typek initialized.");
}
