export function help(): void {
  console.log(`
typek — typed templating for TypeScript

Usage: typek <command> (or typku <command>)

Commands:
  init       Set up tsconfig.json and .gitignore for Typek
  compile    Compile all .tk templates to .typek/ directory
  check      Type-check templates without generating output
  watch      Watch for changes and recompile automatically
  clean      Remove the .typek/ directory (alias: clear)
  list       Show all templates and their associated types
  help       Show this help message
`.trim());
}
