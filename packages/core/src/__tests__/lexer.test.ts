import { describe, it, expect } from "vitest";
import { tokenize, TokenType } from "../lexer.js";

describe("lexer", () => {
  describe("text", () => {
    it("tokenizes plain text", () => {
      const tokens = tokenize("hello world");
      expect(tokens).toEqual([
        { type: TokenType.Text, value: "hello world" },
      ]);
    });

    it("tokenizes empty string", () => {
      const tokens = tokenize("");
      expect(tokens).toEqual([]);
    });
  });

  describe("expressions", () => {
    it("tokenizes simple expression", () => {
      const tokens = tokenize("{{name}}");
      expect(tokens).toEqual([
        { type: TokenType.OpenExpression, value: "{{" },
        { type: TokenType.Identifier, value: "name" },
        { type: TokenType.CloseExpression, value: "}}" },
      ]);
    });

    it("tokenizes property access", () => {
      const tokens = tokenize("{{user.name}}");
      expect(tokens).toEqual([
        { type: TokenType.OpenExpression, value: "{{" },
        { type: TokenType.Identifier, value: "user" },
        { type: TokenType.Dot, value: "." },
        { type: TokenType.Identifier, value: "name" },
        { type: TokenType.CloseExpression, value: "}}" },
      ]);
    });

    it("tokenizes expression with surrounding text", () => {
      const tokens = tokenize("Hello {{name}}!");
      expect(tokens[0]).toEqual({ type: TokenType.Text, value: "Hello " });
      expect(tokens[tokens.length - 1]).toEqual({ type: TokenType.Text, value: "!" });
    });

    it("tokenizes raw/unescaped expression with triple braces", () => {
      const tokens = tokenize("{{{content}}}");
      expect(tokens).toEqual([
        { type: TokenType.OpenRawExpression, value: "{{{" },
        { type: TokenType.Identifier, value: "content" },
        { type: TokenType.CloseRawExpression, value: "}}}" },
      ]);
    });
  });

  describe("operators", () => {
    it("tokenizes logical operators", () => {
      const tokens = tokenize("{{a && b || !c}}");
      const types = tokens.map((t) => t.type);
      expect(types).toContain(TokenType.And);
      expect(types).toContain(TokenType.Or);
      expect(types).toContain(TokenType.Not);
    });

    it("tokenizes comparison operators", () => {
      const tokens = tokenize("{{a == b}}");
      expect(tokens).toContainEqual({ type: TokenType.Equal, value: "==" });
    });

    it("tokenizes not-equal operator", () => {
      const tokens = tokenize("{{a != b}}");
      expect(tokens).toContainEqual({ type: TokenType.NotEqual, value: "!=" });
    });

    it("tokenizes greater/less than operators", () => {
      const tokens = tokenize("{{a > b}}");
      expect(tokens).toContainEqual({ type: TokenType.GreaterThan, value: ">" });

      const tokens2 = tokenize("{{a < b}}");
      expect(tokens2).toContainEqual({ type: TokenType.LessThan, value: "<" });
    });

    it("tokenizes greater/less than or equal operators", () => {
      const tokens = tokenize("{{a >= b}}");
      expect(tokens).toContainEqual({ type: TokenType.GreaterThanOrEqual, value: ">=" });

      const tokens2 = tokenize("{{a <= b}}");
      expect(tokens2).toContainEqual({ type: TokenType.LessThanOrEqual, value: "<=" });
    });

    it("tokenizes arithmetic operators", () => {
      const tokens = tokenize("{{a + b - c * d / e}}");
      const types = tokens.map((t) => t.type);
      expect(types).toContain(TokenType.Plus);
      expect(types).toContain(TokenType.Minus);
      expect(types).toContain(TokenType.Star);
      expect(types).toContain(TokenType.Slash);
    });

    it("tokenizes parentheses", () => {
      const tokens = tokenize("{{(a || b) && !c}}");
      expect(tokens).toContainEqual({ type: TokenType.OpenParen, value: "(" });
      expect(tokens).toContainEqual({ type: TokenType.CloseParen, value: ")" });
    });
  });

  describe("type directive", () => {
    it("tokenizes type directive comment", () => {
      const tokens = tokenize('{{! @type UserProfile from "./types" }}');
      expect(tokens).toContainEqual({ type: TokenType.OpenComment, value: "{{!" });
      expect(tokens).toContainEqual({ type: TokenType.TypeDirective, value: "@type" });
      expect(tokens).toContainEqual({ type: TokenType.Identifier, value: "UserProfile" });
      expect(tokens).toContainEqual({ type: TokenType.From, value: "from" });
      expect(tokens).toContainEqual({ type: TokenType.StringLiteral, value: "./types" });
      expect(tokens).toContainEqual({ type: TokenType.CloseComment, value: "}}" });
    });
  });

  describe("comments", () => {
    it("tokenizes regular comment", () => {
      const tokens = tokenize("{{! this is a comment }}");
      expect(tokens[0]).toEqual({ type: TokenType.OpenComment, value: "{{!" });
    });
  });

  describe("control flow", () => {
    it("tokenizes #if block open", () => {
      const tokens = tokenize("{{#if condition}}");
      expect(tokens).toContainEqual({ type: TokenType.OpenBlock, value: "{{#" });
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "if" });
    });

    it("tokenizes /if block close", () => {
      const tokens = tokenize("{{/if}}");
      expect(tokens).toContainEqual({ type: TokenType.CloseBlock, value: "{{/" });
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "if" });
    });

    it("tokenizes #else", () => {
      const tokens = tokenize("{{#else}}");
      expect(tokens).toContainEqual({ type: TokenType.OpenBlock, value: "{{#" });
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "else" });
    });

    it("tokenizes #else if", () => {
      const tokens = tokenize("{{#else if condition}}");
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "else" });
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "if" });
    });

    it("tokenizes #for..in", () => {
      const tokens = tokenize("{{#for item in items}}");
      expect(tokens).toContainEqual({ type: TokenType.OpenBlock, value: "{{#" });
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "for" });
      expect(tokens).toContainEqual({ type: TokenType.Identifier, value: "item" });
      expect(tokens).toContainEqual({ type: TokenType.In, value: "in" });
      expect(tokens).toContainEqual({ type: TokenType.Identifier, value: "items" });
    });

    it("tokenizes #empty and /empty", () => {
      const tokens = tokenize("{{#empty}}no items{{/empty}}");
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "empty" });
    });

    it("tokenizes #switch", () => {
      const tokens = tokenize("{{#switch user.role}}");
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "switch" });
    });

    it("tokenizes #case with string literal", () => {
      const tokens = tokenize('{{#case "admin"}}');
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "case" });
      expect(tokens).toContainEqual({ type: TokenType.StringLiteral, value: "admin" });
    });

    it("tokenizes #default", () => {
      const tokens = tokenize("{{#default}}");
      expect(tokens).toContainEqual({ type: TokenType.BlockName, value: "default" });
    });
  });

  describe("meta-variables", () => {
    it("tokenizes @index", () => {
      const tokens = tokenize("{{@index}}");
      expect(tokens).toContainEqual({ type: TokenType.MetaVariable, value: "@index" });
    });

    it("tokenizes @first", () => {
      const tokens = tokenize("{{@first}}");
      expect(tokens).toContainEqual({ type: TokenType.MetaVariable, value: "@first" });
    });

    it("tokenizes @last", () => {
      const tokens = tokenize("{{@last}}");
      expect(tokens).toContainEqual({ type: TokenType.MetaVariable, value: "@last" });
    });

    it("tokenizes @length", () => {
      const tokens = tokenize("{{@length}}");
      expect(tokens).toContainEqual({ type: TokenType.MetaVariable, value: "@length" });
    });
  });

  describe("partials", () => {
    it("tokenizes partial invocation", () => {
      const tokens = tokenize("{{> header}}");
      expect(tokens).toContainEqual({ type: TokenType.OpenPartial, value: "{{>" });
      expect(tokens).toContainEqual({ type: TokenType.Identifier, value: "header" });
    });

    it("tokenizes partial with props", () => {
      const tokens = tokenize("{{> header title=page.title}}");
      expect(tokens).toContainEqual({ type: TokenType.Identifier, value: "title" });
      expect(tokens).toContainEqual({ type: TokenType.Assign, value: "=" });
    });
  });

  describe("escaping", () => {
    it("tokenizes escaped braces as text", () => {
      const tokens = tokenize("\\{{ expression \\}}");
      expect(tokens).toEqual([
        { type: TokenType.Text, value: "{{ expression }}" },
      ]);
    });

    it("tokenizes #raw block content as text", () => {
      const tokens = tokenize("{{#raw}}{{ anything }}{{/raw}}");
      expect(tokens).toContainEqual({ type: TokenType.Text, value: "{{ anything }}" });
    });
  });

  describe("whitespace control", () => {
    it("tokenizes tilde on opening tag", () => {
      const tokens = tokenize("{{~#if condition}}");
      expect(tokens).toContainEqual({ type: TokenType.OpenBlock, value: "{{~#" });
    });

    it("tokenizes tilde on closing tag", () => {
      const tokens = tokenize("{{/if~}}");
      expect(tokens).toContainEqual({ type: TokenType.WhitespaceStrip, value: "~" });
    });

    it("tokenizes tilde on expression", () => {
      const tokens = tokenize("{{~ name ~}}");
      expect(tokens).toContainEqual({ type: TokenType.WhitespaceStrip, value: "~" });
    });
  });

  describe("string literals", () => {
    it("tokenizes double-quoted strings", () => {
      const tokens = tokenize('{{#case "hello"}}');
      expect(tokens).toContainEqual({ type: TokenType.StringLiteral, value: "hello" });
    });

    it("tokenizes single-quoted strings", () => {
      const tokens = tokenize("{{#case 'hello'}}");
      expect(tokens).toContainEqual({ type: TokenType.StringLiteral, value: "hello" });
    });
  });

  describe("number literals", () => {
    it("tokenizes integer", () => {
      const tokens = tokenize("{{42}}");
      expect(tokens).toContainEqual({ type: TokenType.NumberLiteral, value: "42" });
    });

    it("tokenizes decimal", () => {
      const tokens = tokenize("{{3.14}}");
      expect(tokens).toContainEqual({ type: TokenType.NumberLiteral, value: "3.14" });
    });
  });
});
