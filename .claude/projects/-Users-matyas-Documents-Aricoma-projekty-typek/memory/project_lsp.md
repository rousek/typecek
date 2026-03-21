---
name: LSP embedded language server
description: Building full LSP server with embedded language support (HTML, TS, XML) for .tc files, plus changelog items for next release
type: project
---

Building a full Language Server Protocol (LSP) server for the Typecek VS Code extension that delegates to embedded language services (HTML, TS, etc.) for regions outside `{{ }}` expressions.

**Why:** Users need HTML/TS completions, hover, formatting, etc. inside `.tc` template files, not just Typecek-specific features.

**How to apply:** The extension architecture is changing from a direct VS Code API extension to an LSP-based server. This affects all language features (completions, hover, diagnostics, go-to-definition).

## Changelog items for next release

- Loop variable autocomplete inside `{{#for}}` blocks
- Type narrowing in autocomplete (e.g. union discrimination inside `{{#if}}`)
- Dot-completion for nested properties on loop variables
- Completion caching — completions work while typing incomplete expressions
- Trusted publishing for npm (OIDC, no tokens needed)
- VS Code extension published to Marketplace
- Embedded language support (HTML/TS) via LSP (in progress)
