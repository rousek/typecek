import {
  parse,
  NodeType,
  type ASTNode,
  type ExprNode,
  type ForBlockNode,
} from "@typek/core";

export interface CompileOptions {
  template: string;
  filename: string;
}

export interface CompileResult {
  code: string;
}

function getEscapeMode(filename: string): "html" | "none" {
  if (filename.endsWith(".html.tk")) return "html";
  return "none";
}

export function compile(options: CompileOptions): CompileResult {
  const ast = parse(options.template);
  const escapeMode = getEscapeMode(options.filename);
  const { typeName, from } = ast.typeDirective;

  let loopCounter = 0;
  // Stack to track loop variable names for nested loops
  const loopVarStack: Array<{ variable: string; arrVar: string; indexVar: string }> = [];

  function isLoopVariable(name: string): boolean {
    return loopVarStack.some((l) => l.variable === name);
  }

  function getLoopContext(): { arrVar: string; indexVar: string } | undefined {
    return loopVarStack[loopVarStack.length - 1];
  }

  function compileExpr(node: ExprNode): string {
    switch (node.type) {
      case NodeType.Identifier:
        if (isLoopVariable(node.name)) return node.name;
        return `data.${node.name}`;
      case NodeType.PropertyAccess:
        return `${compileExpr(node.object)}.${node.property}`;
      case NodeType.BinaryExpression:
        return `(${compileExpr(node.left)} ${node.operator} ${compileExpr(node.right)})`;
      case NodeType.UnaryExpression:
        return `(!${compileExpr(node.operand)})`;
      case NodeType.StringLiteral:
        return JSON.stringify(node.value);
      case NodeType.NumberLiteral:
        return String(node.value);
      default:
        throw new Error(`Unknown expression node type: ${(node as ExprNode).type}`);
    }
  }

  function compileNode(node: ASTNode): string {
    switch (node.type) {
      case NodeType.Text:
        return `__out += ${JSON.stringify(node.value)};\n`;

      case NodeType.Expression: {
        const expr = compileExpr(node.expression);
        if (escapeMode === "html") {
          return `__out += __escapeHtml(String(${expr}));\n`;
        }
        return `__out += String(${expr});\n`;
      }

      case NodeType.RawExpression:
        return `__out += String(${compileExpr(node.expression)});\n`;

      case NodeType.IfBlock:
        return compileIfBlock(node);

      case NodeType.ForBlock:
        return compileForBlock(node);

      case NodeType.SwitchBlock:
        return compileSwitchBlock(node);

      case NodeType.Comment:
        return "";

      case NodeType.Partial:
        return compilePartial(node);

      case NodeType.MetaVariable:
        return compileMetaVariable(node);

      default:
        return "";
    }
  }

  function compileBody(nodes: ASTNode[]): string {
    return nodes.map(compileNode).join("");
  }

  function compileIfBlock(node: ASTNode): string {
    if (node.type !== NodeType.IfBlock) return "";
    let code = `if (${compileExpr(node.condition)}) {\n`;
    code += compileBody(node.consequent);
    code += `}`;

    if (node.alternate) {
      if (Array.isArray(node.alternate)) {
        code += ` else {\n${compileBody(node.alternate)}}`;
      } else {
        // else if (nested IfBlock)
        code += ` else ${compileIfBlock(node.alternate)}`;
      }
    }

    code += "\n";
    return code;
  }

  function compileForBlock(node: ForBlockNode): string {
    const n = loopCounter++;
    const arrVar = `__arr_${n}`;
    const indexVar = `__i_${n}`;

    loopVarStack.push({ variable: node.variable, arrVar, indexVar });

    let code = `const ${arrVar} = ${compileExpr(node.iterable)};\n`;

    if (node.emptyBlock) {
      code += `if (${arrVar}.length > 0) {\n`;
    }

    code += `for (let ${indexVar} = 0; ${indexVar} < ${arrVar}.length; ${indexVar}++) {\n`;
    code += `const ${node.variable} = ${arrVar}[${indexVar}];\n`;
    code += compileBody(node.body);
    code += `}\n`;

    if (node.emptyBlock) {
      code += `} else {\n`;
      code += compileBody(node.emptyBlock);
      code += `}\n`;
    }

    loopVarStack.pop();
    return code;
  }

  function compileSwitchBlock(node: ASTNode): string {
    if (node.type !== NodeType.SwitchBlock) return "";
    let code = `switch (${compileExpr(node.expression)}) {\n`;

    for (const c of node.cases) {
      code += `case ${JSON.stringify(c.value)}: {\n`;
      code += compileBody(c.body);
      code += `break;\n}\n`;
    }

    if (node.defaultCase) {
      code += `default: {\n`;
      code += compileBody(node.defaultCase);
      code += `break;\n}\n`;
    }

    code += `}\n`;
    return code;
  }

  function compilePartial(node: ASTNode): string {
    if (node.type !== NodeType.Partial) return "";
    const propsEntries = Object.entries(node.props)
      .map(([key, value]) => `${key}: ${compileExpr(value)}`)
      .join(", ");

    return `__out += ${node.name}.render({ ${propsEntries} });\n`;
  }

  function compileMetaVariable(node: ASTNode): string {
    if (node.type !== NodeType.MetaVariable) return "";
    const ctx = getLoopContext();
    if (!ctx) return "";

    switch (node.name) {
      case "@index":
        return `__out += String(${ctx.indexVar});\n`;
      case "@first":
        return `__out += String(${ctx.indexVar} === 0);\n`;
      case "@last":
        return `__out += String(${ctx.indexVar} === ${ctx.arrVar}.length - 1);\n`;
      case "@length":
        return `__out += String(${ctx.arrVar}.length);\n`;
      default:
        return "";
    }
  }

  // Build the output module
  let code = `// Auto-generated by Typek — do not edit\n`;
  code += `import type { ${typeName} } from "${from}";\n`;

  if (escapeMode === "html") {
    code += `import { escapeHtml as __escapeHtml } from "@typek/runtime";\n`;
  }

  code += `\n`;
  code += `export function render(data: ${typeName}): string {\n`;
  code += `let __out = "";\n`;
  code += compileBody(ast.body);
  code += `return __out;\n`;
  code += `}\n`;

  return { code };
}
