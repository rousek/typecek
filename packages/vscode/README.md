<p align="center">
  <img src="icons/tc_logo_128.png" alt="Typecek" width="100" />
</p>

<h1 align="center">Typecek for VS Code</h1>

VS Code extension for [Typecek](https://github.com/rousek/typecek) — a typed templating language for TypeScript. Provides real-time diagnostics, autocomplete, hover info, and navigation for `.tc` template files.

## Features

### Type-checking diagnostics

Errors appear inline as you type — misspelled properties, type mismatches, missing imports, and invalid tag usage are all caught instantly without running the compiler.

### Autocomplete

- **Properties** — suggests properties from the imported TypeScript type, scoped to the current context (`{{#with}}`, `{{#for}}`)
- **Block tags** — snippet completions for `{{#if}}...{{/if}}`, `{{#for}}...{{/for}}`, etc.
- **Import paths** — completes file paths in `{{#import ... from "..."}}` directives

### Hover information

- **Type info** — hover over any expression to see its resolved type (e.g. `user.name: string`, `items: Product[]`)
- **Tag help** — hover over block tags to see syntax documentation and examples

### Go to Definition

- **Ctrl+Click** on a property to jump to its TypeScript type definition
- **Ctrl+Click** on file paths in `{{#import}}`, `{{#layout}}`, and `{{> partial}}` to open the referenced file

### Syntax highlighting

Full TextMate grammar support for `.tc`, `.html.tc`, and `.ts.tc` files with embedded HTML and TypeScript highlighting.

### File icon

Custom diamond icon for `.tc` files in the explorer and tabs.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `typecek.typecheck.enabled` | `true` | Enable real-time type checking |
| `typecek.typecheck.debounce` | `200` | Delay (ms) before re-checking after edits |
| `typecek.completions.properties` | `true` | Property completions from imported types |
| `typecek.completions.snippets` | `false` | Snippet completions for block tags |
| `typecek.hover.typeInfo` | `true` | Show types on hover |
| `typecek.hover.tagHelp` | `true` | Show tag syntax help on hover |

## What is Typecek?

Typecek is a typed templating engine for TypeScript. Templates declare their data type via `{{#import}}` and the compiler validates every expression at build time. See the [project README](https://github.com/rousek/typecek) for full documentation.

```
npm install @typecek/cli @typecek/runtime
npx typecek init
npx typecek compile
```

## Links

- [GitHub](https://github.com/rousek/typecek)
- [Documentation](https://github.com/rousek/typecek/tree/main/docs)
- [Tag Reference](https://github.com/rousek/typecek/blob/main/docs/tags.md)
