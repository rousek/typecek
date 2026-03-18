import * as vscode from "vscode";
import { parse, typecheck, resolveType } from "@typek/core";
import path from "path";

const TYPEK_LANGUAGES = ["typek", "typek-html", "typek-ts"];

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection("typek");
  context.subscriptions.push(diagnosticCollection);

  // Check active editor on activation
  if (vscode.window.activeTextEditor) {
    checkDocument(vscode.window.activeTextEditor.document);
  }

  // Check on file open
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) checkDocument(editor.document);
    }),
  );

  // Check on file save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      checkDocument(document);
    }),
  );

  // Check on content change (with debounce)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkDocument(event.document);
      }, 500);
    }),
  );

  // Clear diagnostics when file is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnosticCollection.delete(document.uri);
    }),
  );
}

function isTypekDocument(document: vscode.TextDocument): boolean {
  return TYPEK_LANGUAGES.includes(document.languageId);
}

function checkDocument(document: vscode.TextDocument): void {
  if (!isTypekDocument(document)) return;

  const template = document.getText();
  const diagnostics: vscode.Diagnostic[] = [];

  try {
    const ast = parse(template);
    const { typeName, from } = ast.typeDirective;

    // Resolve the type file path relative to the template
    const templateDir = path.dirname(document.uri.fsPath);
    const typeFilePath = path.resolve(templateDir, from.endsWith(".ts") ? from : from + ".ts");

    try {
      const dataType = resolveType(typeFilePath, typeName);
      const checkerDiags = typecheck(ast, dataType);

      for (const diag of checkerDiags) {
        const range = new vscode.Range(diag.line, diag.column, diag.line, diag.column + diag.length);
        const severity = diag.severity === "error"
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;

        const vsDiag = new vscode.Diagnostic(range, diag.message, severity);
        vsDiag.source = "typek";
        diagnostics.push(vsDiag);
      }
    } catch (err) {
      // Type resolution failed (e.g., file not found, type not found)
      const message = err instanceof Error ? err.message : String(err);
      const range = new vscode.Range(0, 0, 0, template.indexOf("\n") || template.length);
      const vsDiag = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
      vsDiag.source = "typek";
      diagnostics.push(vsDiag);
    }
  } catch (err) {
    // Parse error
    const message = err instanceof Error ? err.message : String(err);
    const range = new vscode.Range(0, 0, 0, 1);
    const vsDiag = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    vsDiag.source = "typek";
    diagnostics.push(vsDiag);
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate(): void {}
