import { tokenize, TokenType, type Token } from "./lexer.js";

export enum NodeType {
  Text,
  Expression,
  RawExpression,
  Identifier,
  PropertyAccess,
  BinaryExpression,
  UnaryExpression,
  StringLiteral,
  NumberLiteral,
  IfBlock,
  ForBlock,
  SwitchBlock,
  Comment,
  Partial,
  MetaVariable,
}

export interface TextNode {
  type: NodeType.Text;
  value: string;
}

export interface ExpressionNode {
  type: NodeType.Expression;
  expression: ExprNode;
  stripLeading: boolean;
  stripTrailing: boolean;
}

export interface RawExpressionNode {
  type: NodeType.RawExpression;
  expression: ExprNode;
}

export interface IdentifierNode {
  type: NodeType.Identifier;
  name: string;
}

export interface PropertyAccessNode {
  type: NodeType.PropertyAccess;
  object: ExprNode;
  property: string;
}

export interface BinaryExpressionNode {
  type: NodeType.BinaryExpression;
  operator: string;
  left: ExprNode;
  right: ExprNode;
}

export interface UnaryExpressionNode {
  type: NodeType.UnaryExpression;
  operator: string;
  operand: ExprNode;
}

export interface StringLiteralNode {
  type: NodeType.StringLiteral;
  value: string;
}

export interface NumberLiteralNode {
  type: NodeType.NumberLiteral;
  value: number;
}

export interface IfBlockNode {
  type: NodeType.IfBlock;
  condition: ExprNode;
  consequent: ASTNode[];
  alternate: ASTNode[] | IfBlockNode | null;
  stripLeading: boolean;
  stripTrailing: boolean;
}

export interface ForBlockNode {
  type: NodeType.ForBlock;
  variable: string;
  iterable: ExprNode;
  body: ASTNode[];
  emptyBlock: ASTNode[] | null;
}

export interface SwitchBlockNode {
  type: NodeType.SwitchBlock;
  expression: ExprNode;
  cases: Array<{ value: string; body: ASTNode[] }>;
  defaultCase: ASTNode[] | null;
}

export interface CommentNode {
  type: NodeType.Comment;
  value: string;
}

export interface PartialNode {
  type: NodeType.Partial;
  name: string;
  props: Record<string, ExprNode>;
}

export interface MetaVariableNode {
  type: NodeType.MetaVariable;
  name: string;
}

export type ExprNode =
  | IdentifierNode
  | PropertyAccessNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | StringLiteralNode
  | NumberLiteralNode;

export type ASTNode =
  | TextNode
  | ExpressionNode
  | RawExpressionNode
  | IfBlockNode
  | ForBlockNode
  | SwitchBlockNode
  | CommentNode
  | PartialNode
  | MetaVariableNode;

export interface TemplateAST {
  typeDirective: { typeName: string; from: string };
  body: ASTNode[];
}

const PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  ">": 4,
  "<=": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
};

const OPERATOR_TOKEN_TO_STRING: Partial<Record<TokenType, string>> = {
  [TokenType.Or]: "||",
  [TokenType.And]: "&&",
  [TokenType.Equal]: "==",
  [TokenType.NotEqual]: "!=",
  [TokenType.LessThan]: "<",
  [TokenType.GreaterThan]: ">",
  [TokenType.LessThanOrEqual]: "<=",
  [TokenType.GreaterThanOrEqual]: ">=",
  [TokenType.Plus]: "+",
  [TokenType.Minus]: "-",
  [TokenType.Star]: "*",
  [TokenType.Slash]: "/",
};

function isOperatorToken(t: Token): boolean {
  return t.type in OPERATOR_TOKEN_TO_STRING;
}

export function parse(template: string): TemplateAST {
  const tokens = tokenize(template);
  let pos = 0;
  let insideForBlock = false;

  function current(): Token | undefined {
    return tokens[pos];
  }

  function expect(type: TokenType): Token {
    const t = tokens[pos];
    if (!t || t.type !== type) {
      throw new Error(`Expected token type ${type}, got ${t?.type} (${t?.value}) at position ${pos}`);
    }
    pos++;
    return t;
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function peekType(): TokenType | undefined {
    return tokens[pos]?.type;
  }

  // Parse type directive from the beginning of the tokens
  function parseTypeDirective(): { typeName: string; from: string } {
    // First tokens must be: OpenComment, TypeDirective, Identifier, From, StringLiteral, CloseComment
    if (peekType() !== TokenType.OpenComment) {
      throw new Error("Template must start with a type directive: {{! @type TypeName from \"path\" }}");
    }
    pos++; // OpenComment

    if (peekType() !== TokenType.TypeDirective) {
      throw new Error("Template must start with a type directive: {{! @type TypeName from \"path\" }}");
    }
    pos++; // @type

    const typeNameToken = expect(TokenType.Identifier);
    expect(TokenType.From);
    const fromToken = expect(TokenType.StringLiteral);
    expect(TokenType.CloseComment);

    return { typeName: typeNameToken.value, from: fromToken.value };
  }

  // Check for duplicate type directives
  function checkNoDuplicateDirective() {
    // Scan remaining tokens for another @type directive
    for (let i = pos; i < tokens.length; i++) {
      if (tokens[i].type === TokenType.TypeDirective) {
        throw new Error("Only one type directive is allowed per template");
      }
    }
  }

  // Parse expression with precedence climbing
  function parseExpression(minPrec = 0): ExprNode {
    let left = parseUnary();

    while (pos < tokens.length) {
      const t = current();
      if (!t || !isOperatorToken(t)) break;

      const op = OPERATOR_TOKEN_TO_STRING[t.type]!;
      const prec = PRECEDENCE[op];
      if (prec === undefined || prec < minPrec) break;

      pos++; // consume operator
      const right = parseExpression(prec + 1);
      left = {
        type: NodeType.BinaryExpression,
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  function parseUnary(): ExprNode {
    if (peekType() === TokenType.Not) {
      pos++;
      const operand = parseUnary();
      return { type: NodeType.UnaryExpression, operator: "!", operand };
    }
    return parsePrimary();
  }

  function parsePrimary(): ExprNode {
    const t = current();
    if (!t) throw new Error("Unexpected end of tokens in expression");

    if (t.type === TokenType.OpenParen) {
      pos++; // skip (
      const expr = parseExpression(0);
      expect(TokenType.CloseParen);
      return expr;
    }

    if (t.type === TokenType.NumberLiteral) {
      pos++;
      return { type: NodeType.NumberLiteral, value: parseFloat(t.value) };
    }

    if (t.type === TokenType.StringLiteral) {
      pos++;
      return { type: NodeType.StringLiteral, value: t.value };
    }

    if (t.type === TokenType.Identifier) {
      pos++;
      let node: ExprNode = { type: NodeType.Identifier, name: t.value };

      // Property access chain
      while (peekType() === TokenType.Dot) {
        pos++; // skip dot
        const prop = expect(TokenType.Identifier);
        node = { type: NodeType.PropertyAccess, object: node, property: prop.value };
      }

      return node;
    }

    throw new Error(`Unexpected token in expression: ${t.type} (${t.value})`);
  }

  // Collect expression tokens between current position and a close token
  function collectExpressionTokens(): ExprNode {
    return parseExpression(0);
  }

  function parseBody(stopConditions: Set<string>): ASTNode[] {
    const body: ASTNode[] = [];

    while (pos < tokens.length) {
      const t = current();
      if (!t) break;

      // Check stop conditions for block boundaries
      if (t.type === TokenType.OpenBlock) {
        const nextToken = tokens[pos + 1];
        if (nextToken && nextToken.type === TokenType.BlockName && stopConditions.has(nextToken.value)) {
          break;
        }
      }
      if (t.type === TokenType.CloseBlock) {
        break;
      }

      if (t.type === TokenType.Text) {
        body.push({ type: NodeType.Text, value: t.value });
        pos++;
      } else if (t.type === TokenType.OpenExpression) {
        pos++; // skip {{
        let stripLeading = false;
        let stripTrailing = false;

        if (peekType() === TokenType.WhitespaceStrip) {
          stripLeading = true;
          pos++;
        }

        // Check for meta-variable
        if (peekType() === TokenType.MetaVariable) {
          if (!insideForBlock) {
            throw new Error("Meta-variables (@index, @first, @last, @length) can only be used inside a for block");
          }
          const metaToken = advance();
          if (peekType() === TokenType.WhitespaceStrip) {
            stripTrailing = true;
            pos++;
          }
          expect(TokenType.CloseExpression);
          body.push({ type: NodeType.MetaVariable, name: metaToken.value });
          continue;
        }

        const expression = collectExpressionTokens();

        if (peekType() === TokenType.WhitespaceStrip) {
          stripTrailing = true;
          pos++;
        }

        expect(TokenType.CloseExpression);
        body.push({
          type: NodeType.Expression,
          expression,
          stripLeading,
          stripTrailing,
        });
      } else if (t.type === TokenType.OpenRawExpression) {
        pos++; // skip {{{
        const expression = collectExpressionTokens();
        expect(TokenType.CloseRawExpression);
        body.push({ type: NodeType.RawExpression, expression });
      } else if (t.type === TokenType.OpenComment) {
        pos++; // skip {{!
        // Collect comment text
        let commentText = "";
        while (pos < tokens.length && peekType() !== TokenType.CloseComment) {
          commentText += (commentText ? " " : "") + current()!.value;
          pos++;
        }
        if (peekType() === TokenType.CloseComment) pos++;
        body.push({ type: NodeType.Comment, value: commentText });
      } else if (t.type === TokenType.OpenPartial) {
        pos++; // skip {{>
        const nameToken = expect(TokenType.Identifier);
        const props: Record<string, ExprNode> = {};

        // Parse props: key=value pairs
        while (peekType() === TokenType.Identifier) {
          const keyToken = advance();
          if (peekType() === TokenType.Assign) {
            pos++; // skip =
            const value = collectExpressionTokens();
            props[keyToken.value] = value;
          }
        }

        expect(TokenType.CloseExpression);
        body.push({ type: NodeType.Partial, name: nameToken.value, props });
      } else if (t.type === TokenType.OpenBlock) {
        pos++; // skip {{# or {{~#
        const stripLeading = t.value === "{{~#";
        const blockNameToken = expect(TokenType.BlockName);

        switch (blockNameToken.value) {
          case "if":
            body.push(parseIfBlock(stripLeading));
            break;
          case "for":
            body.push(parseForBlock());
            break;
          case "switch":
            body.push(parseSwitchBlock());
            break;
          case "raw": {
            // Raw block content is already handled by lexer as Text tokens
            // Skip the close expression for the opening tag
            if (peekType() === TokenType.CloseExpression) pos++;
            // Content is already Text tokens — collect them until we hit {{/raw}}
            while (pos < tokens.length) {
              if (peekType() === TokenType.CloseBlock) {
                // This is {{/raw}} — consume it
                pos++; // skip {{/
                const closeName = expect(TokenType.BlockName); // "raw"
                expect(TokenType.CloseExpression);
                break;
              }
              if (peekType() === TokenType.Text) {
                body.push({ type: NodeType.Text, value: current()!.value });
                pos++;
              } else {
                pos++;
              }
            }
            break;
          }
          default:
            throw new Error(`Unexpected block: ${blockNameToken.value}`);
        }
      } else {
        // Skip unknown tokens
        pos++;
      }
    }

    return body;
  }

  function parseIfBlock(stripLeading: boolean): IfBlockNode {
    const condition = collectExpressionTokens();
    let stripTrailing = false;

    if (peekType() === TokenType.WhitespaceStrip) {
      pos++;
    }
    expect(TokenType.CloseExpression);

    const consequent = parseBody(new Set(["else"]));

    let alternate: ASTNode[] | IfBlockNode | null = null;

    // Check for else / else if
    if (peekType() === TokenType.OpenBlock) {
      const nextToken = tokens[pos + 1];
      if (nextToken && nextToken.type === TokenType.BlockName && nextToken.value === "else") {
        pos++; // skip {{#
        pos++; // skip "else" BlockName

        // Check for "else if"
        if (peekType() === TokenType.BlockName && current()!.value === "if") {
          pos++; // skip "if" BlockName
          alternate = parseIfBlock(false);
        } else {
          // Plain else
          if (peekType() === TokenType.CloseExpression) pos++;
          alternate = parseBody(new Set());
        }
      }
    }

    // Expect closing {{/if}} — but not if alternate is a nested IfBlock
    // (else if), because the nested parseIfBlock already consumed {{/if}}
    if (alternate && !Array.isArray(alternate) && alternate.type === NodeType.IfBlock) {
      // {{/if}} was already consumed by the nested else-if chain
    } else if (peekType() === TokenType.CloseBlock) {
      pos++; // skip {{/
      const closeBlockName = expect(TokenType.BlockName);
      if (closeBlockName.value !== "if") {
        throw new Error(`Expected /if but got /${closeBlockName.value}`);
      }
      if (peekType() === TokenType.WhitespaceStrip) {
        stripTrailing = true;
        pos++;
      }
      expect(TokenType.CloseExpression);
    } else {
      throw new Error("Unclosed if block");
    }

    return {
      type: NodeType.IfBlock,
      condition,
      consequent,
      alternate,
      stripLeading,
      stripTrailing,
    };
  }

  function parseForBlock(): ForBlockNode {
    const variableToken = expect(TokenType.Identifier);
    expect(TokenType.In);
    const iterable = collectExpressionTokens();
    expect(TokenType.CloseExpression);

    const prevInsideForBlock = insideForBlock;
    insideForBlock = true;

    const body = parseBody(new Set(["empty"]));

    let emptyBlock: ASTNode[] | null = null;

    // Check for {{#empty}}
    if (peekType() === TokenType.OpenBlock) {
      const nextToken = tokens[pos + 1];
      if (nextToken && nextToken.type === TokenType.BlockName && nextToken.value === "empty") {
        pos++; // skip {{#
        pos++; // skip "empty" BlockName
        if (peekType() === TokenType.CloseExpression) pos++;

        emptyBlock = parseBody(new Set());

        // Expect {{/empty}}
        if (peekType() === TokenType.CloseBlock) {
          pos++; // skip {{/
          const closeBlockName = expect(TokenType.BlockName);
          if (closeBlockName.value !== "empty") {
            throw new Error(`Expected /empty but got /${closeBlockName.value}`);
          }
          expect(TokenType.CloseExpression);
        }
      }
    }

    // Skip whitespace-only text before {{/for}}
    if (peekType() === TokenType.Text && current()!.value.trim() === "") {
      pos++;
    }

    // Expect {{/for}}
    if (peekType() === TokenType.CloseBlock) {
      pos++; // skip {{/
      const closeBlockName = expect(TokenType.BlockName);
      if (closeBlockName.value !== "for") {
        throw new Error(`Expected /for but got /${closeBlockName.value}`);
      }
      expect(TokenType.CloseExpression);
    } else {
      throw new Error("Unclosed for block");
    }

    insideForBlock = prevInsideForBlock;

    return {
      type: NodeType.ForBlock,
      variable: variableToken.value,
      iterable,
      body,
      emptyBlock,
    };
  }

  function parseSwitchBlock(): SwitchBlockNode {
    const expression = collectExpressionTokens();
    expect(TokenType.CloseExpression);

    const cases: Array<{ value: string; body: ASTNode[] }> = [];
    let defaultCase: ASTNode[] | null = null;

    while (pos < tokens.length) {
      // Check for closing {{/switch}}
      if (peekType() === TokenType.CloseBlock) {
        break;
      }

      if (peekType() === TokenType.OpenBlock) {
        const nextToken = tokens[pos + 1];
        if (nextToken && nextToken.type === TokenType.BlockName) {
          if (nextToken.value === "case") {
            pos++; // skip {{#
            pos++; // skip "case" BlockName
            const valueToken = expect(TokenType.StringLiteral);
            expect(TokenType.CloseExpression);

            const caseBody = parseBody(new Set(["case", "default"]));

            // Expect {{/case}}
            if (peekType() === TokenType.CloseBlock) {
              pos++; // skip {{/
              expect(TokenType.BlockName); // "case"
              expect(TokenType.CloseExpression);
            }

            cases.push({ value: valueToken.value, body: caseBody });
            continue;
          }

          if (nextToken.value === "default") {
            pos++; // skip {{#
            pos++; // skip "default" BlockName
            if (peekType() === TokenType.CloseExpression) pos++;

            defaultCase = parseBody(new Set(["case"]));

            // Expect {{/default}}
            if (peekType() === TokenType.CloseBlock) {
              pos++; // skip {{/
              expect(TokenType.BlockName); // "default"
              expect(TokenType.CloseExpression);
            }

            continue;
          }
        }
      }

      // Skip text/whitespace between cases
      if (peekType() === TokenType.Text) {
        pos++;
        continue;
      }

      break;
    }

    // Expect {{/switch}}
    if (peekType() === TokenType.CloseBlock) {
      pos++; // skip {{/
      const closeBlockName = expect(TokenType.BlockName);
      if (closeBlockName.value !== "switch") {
        throw new Error(`Expected /switch but got /${closeBlockName.value}`);
      }
      expect(TokenType.CloseExpression);
    } else {
      throw new Error("Unclosed switch block");
    }

    return {
      type: NodeType.SwitchBlock,
      expression,
      cases,
      defaultCase,
    };
  }

  // Main parse logic
  const typeDirective = parseTypeDirective();
  checkNoDuplicateDirective();

  // Skip newline after type directive if present
  if (peekType() === TokenType.Text && current()!.value.startsWith("\n")) {
    const textValue = current()!.value.slice(1);
    pos++;
    if (textValue.length > 0) {
      // Re-insert the trimmed text
      tokens.splice(pos, 0, { type: TokenType.Text, value: textValue });
    }
  }

  const body = parseBody(new Set());

  return { typeDirective, body };
}
