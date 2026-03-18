export enum TokenType {
  Text,
  OpenExpression,
  CloseExpression,
  OpenRawExpression,
  CloseRawExpression,
  OpenBlock,
  CloseBlock,
  OpenComment,
  CloseComment,
  OpenPartial,
  BlockName,
  Identifier,
  Dot,
  StringLiteral,
  NumberLiteral,
  MetaVariable,
  TypeDirective,
  From,
  In,
  Assign,
  And,
  Or,
  Not,
  Equal,
  NotEqual,
  GreaterThan,
  LessThan,
  GreaterThanOrEqual,
  LessThanOrEqual,
  Plus,
  Minus,
  Star,
  Slash,
  OpenParen,
  CloseParen,
  WhitespaceStrip,
}

export interface Token {
  type: TokenType;
  value: string;
}

const BLOCK_NAMES = new Set([
  "if", "else", "for", "empty", "switch", "case", "default", "raw",
]);

const META_VARIABLES = new Set(["@index", "@first", "@last", "@length"]);

export function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let textBuf = "";

  function flushText() {
    if (textBuf.length > 0) {
      tokens.push({ type: TokenType.Text, value: textBuf });
      textBuf = "";
    }
  }

  function peek(offset = 0): string {
    return template[pos + offset] ?? "";
  }

  function match(str: string): boolean {
    return template.startsWith(str, pos);
  }

  function advance(n = 1): string {
    const s = template.slice(pos, pos + n);
    pos += n;
    return s;
  }

  function skipWhitespace() {
    while (pos < template.length && /\s/.test(template[pos])) {
      pos++;
    }
  }

  function readString(quote: string): string {
    pos++; // skip opening quote
    let value = "";
    while (pos < template.length && template[pos] !== quote) {
      value += template[pos];
      pos++;
    }
    pos++; // skip closing quote
    return value;
  }

  function readWord(): string {
    let word = "";
    while (pos < template.length && /[a-zA-Z0-9_$]/.test(template[pos])) {
      word += template[pos];
      pos++;
    }
    return word;
  }

  function readNumber(): string {
    let num = "";
    while (pos < template.length && /[0-9.]/.test(template[pos])) {
      num += template[pos];
      pos++;
    }
    return num;
  }

  function tokenizeExpressionContent(closeTokenType: TokenType, closeStr: string) {
    while (pos < template.length) {
      skipWhitespace();
      if (pos >= template.length) break;

      // Check for close with tilde
      if (match("~" + closeStr)) {
        tokens.push({ type: TokenType.WhitespaceStrip, value: "~" });
        advance(1 + closeStr.length);
        tokens.push({ type: closeTokenType, value: closeStr });
        return;
      }

      // Check for close
      if (match(closeStr)) {
        advance(closeStr.length);
        tokens.push({ type: closeTokenType, value: closeStr });
        return;
      }

      const ch = template[pos];

      if (ch === "~") {
        tokens.push({ type: TokenType.WhitespaceStrip, value: "~" });
        pos++;
      } else if (ch === "&" && peek(1) === "&") {
        tokens.push({ type: TokenType.And, value: "&&" });
        pos += 2;
      } else if (ch === "|" && peek(1) === "|") {
        tokens.push({ type: TokenType.Or, value: "||" });
        pos += 2;
      } else if (ch === "!" && peek(1) === "=") {
        tokens.push({ type: TokenType.NotEqual, value: "!=" });
        pos += 2;
      } else if (ch === "!") {
        tokens.push({ type: TokenType.Not, value: "!" });
        pos++;
      } else if (ch === "=" && peek(1) === "=") {
        tokens.push({ type: TokenType.Equal, value: "==" });
        pos += 2;
      } else if (ch === "=" && peek(1) !== "=") {
        tokens.push({ type: TokenType.Assign, value: "=" });
        pos++;
      } else if (ch === ">" && peek(1) === "=") {
        tokens.push({ type: TokenType.GreaterThanOrEqual, value: ">=" });
        pos += 2;
      } else if (ch === "<" && peek(1) === "=") {
        tokens.push({ type: TokenType.LessThanOrEqual, value: "<=" });
        pos += 2;
      } else if (ch === ">") {
        tokens.push({ type: TokenType.GreaterThan, value: ">" });
        pos++;
      } else if (ch === "<") {
        tokens.push({ type: TokenType.LessThan, value: "<" });
        pos++;
      } else if (ch === "+") {
        tokens.push({ type: TokenType.Plus, value: "+" });
        pos++;
      } else if (ch === "-") {
        tokens.push({ type: TokenType.Minus, value: "-" });
        pos++;
      } else if (ch === "*") {
        tokens.push({ type: TokenType.Star, value: "*" });
        pos++;
      } else if (ch === "/") {
        tokens.push({ type: TokenType.Slash, value: "/" });
        pos++;
      } else if (ch === "(") {
        tokens.push({ type: TokenType.OpenParen, value: "(" });
        pos++;
      } else if (ch === ")") {
        tokens.push({ type: TokenType.CloseParen, value: ")" });
        pos++;
      } else if (ch === ".") {
        tokens.push({ type: TokenType.Dot, value: "." });
        pos++;
      } else if (ch === '"' || ch === "'") {
        const value = readString(ch);
        tokens.push({ type: TokenType.StringLiteral, value });
      } else if (ch === "@") {
        // Meta-variable or type directive
        if (match("@type")) {
          tokens.push({ type: TokenType.TypeDirective, value: "@type" });
          pos += 5;
        } else {
          // Read full @word
          const start = pos;
          pos++; // skip @
          const word = readWord();
          const metaVar = "@" + word;
          if (META_VARIABLES.has(metaVar)) {
            tokens.push({ type: TokenType.MetaVariable, value: metaVar });
          } else {
            tokens.push({ type: TokenType.Identifier, value: metaVar });
          }
        }
      } else if (/[0-9]/.test(ch)) {
        const num = readNumber();
        tokens.push({ type: TokenType.NumberLiteral, value: num });
      } else if (/[a-zA-Z_$]/.test(ch)) {
        const word = readWord();
        if (word === "from") {
          tokens.push({ type: TokenType.From, value: "from" });
        } else if (word === "in") {
          tokens.push({ type: TokenType.In, value: "in" });
        } else if (BLOCK_NAMES.has(word)) {
          tokens.push({ type: TokenType.BlockName, value: word });
        } else {
          tokens.push({ type: TokenType.Identifier, value: word });
        }
      } else {
        // Skip unknown characters
        pos++;
      }
    }
  }

  while (pos < template.length) {
    // Escaped braces
    if (match("\\{{")) {
      pos += 3; // skip \{{
      // Collect until \}} or end
      let escaped = "{{";
      while (pos < template.length) {
        if (match("\\}}")) {
          escaped += "}}";
          pos += 3;
          break;
        }
        escaped += template[pos];
        pos++;
      }
      textBuf += escaped;
      continue;
    }

    // Raw expression {{{
    if (match("{{{")) {
      flushText();
      tokens.push({ type: TokenType.OpenRawExpression, value: "{{{" });
      pos += 3;
      tokenizeExpressionContent(TokenType.CloseRawExpression, "}}}");
      continue;
    }

    // Comment {{! (only if followed by space, @, or --)
    if (match("{{!") && (template[pos + 3] === " " || template[pos + 3] === "@" || template[pos + 3] === "-")) {
      flushText();
      tokens.push({ type: TokenType.OpenComment, value: "{{!" });
      pos += 3;
      tokenizeExpressionContent(TokenType.CloseComment, "}}");
      continue;
    }

    // Partial {{>
    if (match("{{>")) {
      flushText();
      tokens.push({ type: TokenType.OpenPartial, value: "{{>" });
      pos += 3;
      tokenizeExpressionContent(TokenType.CloseExpression, "}}");
      continue;
    }

    // Close block {{/
    if (match("{{/")) {
      flushText();
      tokens.push({ type: TokenType.CloseBlock, value: "{{/" });
      pos += 3;
      tokenizeExpressionContent(TokenType.CloseExpression, "}}");
      continue;
    }

    // Open block {{~#
    if (match("{{~#")) {
      flushText();
      tokens.push({ type: TokenType.OpenBlock, value: "{{~#" });
      pos += 4;
      // Check for raw block
      const savedPos = pos;
      skipWhitespace();
      if (match("raw")) {
        const afterRaw = pos + 3;
        if (afterRaw >= template.length || /[\s}]/.test(template[afterRaw])) {
          pos = afterRaw;
          tokens.push({ type: TokenType.BlockName, value: "raw" });
          skipWhitespace();
          if (match("}}")) pos += 2;
          // Now collect raw content until {{/raw}}
          collectRawContent();
          continue;
        }
      }
      pos = savedPos;
      tokenizeExpressionContent(TokenType.CloseExpression, "}}");
      continue;
    }

    // Open block {{#
    if (match("{{#")) {
      flushText();
      tokens.push({ type: TokenType.OpenBlock, value: "{{#" });
      pos += 3;
      // Check for raw block
      const savedPos = pos;
      skipWhitespace();
      if (match("raw")) {
        const afterRaw = pos + 3;
        if (afterRaw >= template.length || /[\s}]/.test(template[afterRaw])) {
          pos = afterRaw;
          tokens.push({ type: TokenType.BlockName, value: "raw" });
          skipWhitespace();
          if (match("}}")) pos += 2;
          // Now collect raw content until {{/raw}}
          collectRawContent();
          continue;
        }
      }
      pos = savedPos;
      tokenizeExpressionContent(TokenType.CloseExpression, "}}");
      continue;
    }

    // Expression {{~ (with whitespace strip)
    if (match("{{~")) {
      flushText();
      tokens.push({ type: TokenType.OpenExpression, value: "{{" });
      tokens.push({ type: TokenType.WhitespaceStrip, value: "~" });
      pos += 3;
      tokenizeExpressionContent(TokenType.CloseExpression, "}}");
      continue;
    }

    // Expression {{
    if (match("{{")) {
      flushText();
      tokens.push({ type: TokenType.OpenExpression, value: "{{" });
      pos += 2;
      tokenizeExpressionContent(TokenType.CloseExpression, "}}");
      continue;
    }

    // Regular text
    textBuf += template[pos];
    pos++;
  }

  flushText();
  return tokens;

  function collectRawContent() {
    let raw = "";
    while (pos < template.length) {
      if (match("{{/raw}}")) {
        if (raw.length > 0) {
          tokens.push({ type: TokenType.Text, value: raw });
        }
        tokens.push({ type: TokenType.CloseBlock, value: "{{/" });
        pos += 3;
        tokenizeExpressionContent(TokenType.CloseExpression, "}}");
        return;
      }
      raw += template[pos];
      pos++;
    }
    // If we reach here, unclosed raw block
    if (raw.length > 0) {
      tokens.push({ type: TokenType.Text, value: raw });
    }
  }
}
