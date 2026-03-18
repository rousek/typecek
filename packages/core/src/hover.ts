import {
  NodeType,
  type ASTNode,
  type ExprNode,
  type TemplateAST,
} from "./parser.js";
import { TypeKind, type Type } from "./types.js";

export interface HoverResult {
  type: Type;
  /** Display name of the expression being hovered (e.g. "user", "user.name") */
  name: string;
  line: number;
  column: number;
  length: number;
}

function formatExpr(node: ExprNode): string {
  switch (node.type) {
    case NodeType.Identifier:
      return node.name;
    case NodeType.PropertyAccess:
      return `${formatExpr(node.object)}.${node.property}`;
    case NodeType.BinaryExpression:
      return `${formatExpr(node.left)} ${node.operator} ${formatExpr(node.right)}`;
    case NodeType.UnaryExpression:
      return `!${formatExpr(node.operand)}`;
    case NodeType.StringLiteral:
      return JSON.stringify(node.value);
    case NodeType.NumberLiteral:
      return String(node.value);
  }
}

function resolveProperty(type: Type, name: string): Type | undefined {
  if (type.kind === TypeKind.Any) return { kind: TypeKind.Any };
  if (type.kind === TypeKind.Object) return type.properties.get(name);
  if (type.kind === TypeKind.Union) {
    for (const t of type.types) {
      if (t.kind === TypeKind.Null || t.kind === TypeKind.Undefined) continue;
      const resolved = resolveProperty(t, name);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

function nodeContains(node: { line: number; column: number }, exprText: string, line: number, column: number): boolean {
  if (node.line !== line) return false;
  return column >= node.column && column < node.column + exprText.length;
}

/**
 * Given an AST, the resolved data type, and a cursor position,
 * returns the type of the expression under the cursor (if any).
 */
export function typeAtPosition(
  ast: TemplateAST,
  dataType: Type,
  line: number,
  column: number,
): HoverResult | undefined {
  const loopVarStack: Array<{ variable: string; type: Type }> = [];

  function resolveExprType(node: ExprNode): Type {
    switch (node.type) {
      case NodeType.Identifier: {
        for (let i = loopVarStack.length - 1; i >= 0; i--) {
          if (loopVarStack[i].variable === node.name) return loopVarStack[i].type;
        }
        return resolveProperty(dataType, node.name) ?? { kind: TypeKind.Any };
      }
      case NodeType.PropertyAccess: {
        const objectType = resolveExprType(node.object);
        return resolveProperty(objectType, node.property) ?? { kind: TypeKind.Any };
      }
      case NodeType.StringLiteral:
        return { kind: TypeKind.String };
      case NodeType.NumberLiteral:
        return { kind: TypeKind.Number };
      case NodeType.BinaryExpression: {
        resolveExprType(node.left);
        resolveExprType(node.right);
        if (["-", "*", "/"].includes(node.operator)) return { kind: TypeKind.Number };
        if (node.operator === "+") return { kind: TypeKind.Any };
        return { kind: TypeKind.Boolean };
      }
      case NodeType.UnaryExpression:
        resolveExprType(node.operand);
        return { kind: TypeKind.Boolean };
    }
  }

  // Find the most specific (deepest) expression node at the position.
  // We check sub-expressions first so we get e.g. "user" rather than "user.name"
  // when hovering the "user" part, but "user.name" when hovering "name".
  function findInExpr(node: ExprNode): HoverResult | undefined {
    // Check children first for more specific matches
    if (node.type === NodeType.PropertyAccess) {
      // Check if hovering the property name specifically
      const objText = formatExpr(node.object);
      const propStart = node.column + objText.length + 1; // +1 for the dot
      if (line === node.line && column >= propStart && column < propStart + node.property.length) {
        // Hovering the property — return the full chain's type
        const type = resolveExprType(node);
        const text = formatExpr(node);
        return { type, name: text, line: node.line, column: node.column, length: text.length };
      }
      // Check if hovering the object part
      const objResult = findInExpr(node.object);
      if (objResult) return objResult;
    }

    if (node.type === NodeType.BinaryExpression) {
      const leftResult = findInExpr(node.left);
      if (leftResult) return leftResult;
      const rightResult = findInExpr(node.right);
      if (rightResult) return rightResult;
    }

    if (node.type === NodeType.UnaryExpression) {
      const operandResult = findInExpr(node.operand);
      if (operandResult) return operandResult;
    }

    // Check the node itself
    const text = formatExpr(node);
    if (nodeContains(node, text, line, column)) {
      const type = resolveExprType(node);
      return { type, name: text, line: node.line, column: node.column, length: text.length };
    }

    return undefined;
  }

  function findInNode(node: ASTNode): HoverResult | undefined {
    switch (node.type) {
      case NodeType.Expression:
        return findInExpr(node.expression);
      case NodeType.RawExpression:
        return findInExpr(node.expression);
      case NodeType.IfBlock: {
        const condResult = findInExpr(node.condition);
        if (condResult) return condResult;
        for (const child of node.consequent) {
          const r = findInNode(child);
          if (r) return r;
        }
        if (node.alternate) {
          if (Array.isArray(node.alternate)) {
            for (const child of node.alternate) {
              const r = findInNode(child);
              if (r) return r;
            }
          } else {
            const r = findInNode(node.alternate);
            if (r) return r;
          }
        }
        return undefined;
      }
      case NodeType.ForBlock: {
        const iterResult = findInExpr(node.iterable);
        if (iterResult) return iterResult;

        const iterableType = resolveExprType(node.iterable);
        const elementType = iterableType.kind === TypeKind.Array ? iterableType.elementType : { kind: TypeKind.Any as const };
        loopVarStack.push({ variable: node.variable, type: elementType });

        for (const child of node.body) {
          const r = findInNode(child);
          if (r) { loopVarStack.pop(); return r; }
        }
        if (node.emptyBlock) {
          for (const child of node.emptyBlock) {
            const r = findInNode(child);
            if (r) { loopVarStack.pop(); return r; }
          }
        }
        loopVarStack.pop();
        return undefined;
      }
      case NodeType.SwitchBlock: {
        const exprResult = findInExpr(node.expression);
        if (exprResult) return exprResult;
        for (const c of node.cases) {
          for (const child of c.body) {
            const r = findInNode(child);
            if (r) return r;
          }
        }
        if (node.defaultCase) {
          for (const child of node.defaultCase) {
            const r = findInNode(child);
            if (r) return r;
          }
        }
        return undefined;
      }
      case NodeType.Partial: {
        for (const expr of Object.values(node.props)) {
          const r = findInExpr(expr);
          if (r) return r;
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }

  // Check if hovering the type name in the directive
  const dir = ast.typeDirective;
  if (
    line === dir.typeNameLine &&
    column >= dir.typeNameColumn &&
    column < dir.typeNameColumn + dir.typeName.length
  ) {
    return {
      type: dataType,
      name: dir.typeName,
      line: dir.typeNameLine,
      column: dir.typeNameColumn,
      length: dir.typeName.length,
    };
  }

  for (const node of ast.body) {
    const result = findInNode(node);
    if (result) return result;
  }

  return undefined;
}
