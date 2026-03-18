import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  // Syntax highlighting is handled declaratively via grammars in package.json.
  // This activation function is reserved for future features like:
  // - Diagnostics (type checking)
  // - Autocomplete
  // - Go to definition
}

export function deactivate(): void {}
