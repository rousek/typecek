import * as vscode from "vscode";
import {
  parse,
  typecheck,
  resolveType,
  typeAtPosition,
  formatTypeDefinition,
  formatType,
  TypeKind,
  type Type,
} from "@typek/core";
import path from "path";

const TYPEK_LANGUAGES = ["typek", "typek-html", "typek-ts"];
const TYPEK_SELECTORS: vscode.DocumentSelector = TYPEK_LANGUAGES.map((lang) => ({ language: lang }));

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

  // Hover provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(TYPEK_SELECTORS, {
      provideHover(document, position) {
        return getHover(document, position);
      },
    }),
  );
}

function isTypekDocument(document: vscode.TextDocument): boolean {
  return TYPEK_LANGUAGES.includes(document.languageId);
}

function resolveDataType(document: vscode.TextDocument): { ast: ReturnType<typeof parse>; dataType: Type } | undefined {
  try {
    const ast = parse(document.getText());
    const { typeName, from } = ast.typeDirective;
    const templateDir = path.dirname(document.uri.fsPath);
    const typeFilePath = path.resolve(templateDir, from.endsWith(".ts") ? from : from + ".ts");
    const dataType = resolveType(typeFilePath, typeName);
    return { ast, dataType };
  } catch {
    return undefined;
  }
}

function getHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
  if (!isTypekDocument(document)) return undefined;

  const resolved = resolveDataType(document);
  if (!resolved) return undefined;

  const result = typeAtPosition(resolved.ast, resolved.dataType, position.line, position.character);
  if (!result) return undefined;

  const code = formatTypeDefinition(result.type, result.name);
  const markdown = new vscode.MarkdownString();
  markdown.appendCodeblock(code, "typescript");

  const range = new vscode.Range(result.line, result.column, result.line, result.column + result.length);
  return new vscode.Hover(markdown, range);
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
