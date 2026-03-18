import { describe, it, expect } from "vitest";
import { escapeHtml } from "../escape.js";

describe("runtime", () => {
  describe("escapeHtml", () => {
    it("escapes ampersand", () => {
      expect(escapeHtml("a & b")).toBe("a &amp; b");
    });

    it("escapes less-than", () => {
      expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
    });

    it("escapes greater-than", () => {
      expect(escapeHtml("a > b")).toBe("a &gt; b");
    });

    it("escapes double quotes", () => {
      expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    });

    it("escapes single quotes", () => {
      expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    it("returns empty string for empty input", () => {
      expect(escapeHtml("")).toBe("");
    });

    it("returns string unchanged if no special characters", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
    });

    it("escapes multiple special characters in one string", () => {
      expect(escapeHtml('<a href="x">1 & 2</a>')).toBe(
        '&lt;a href=&quot;x&quot;&gt;1 &amp; 2&lt;/a&gt;'
      );
    });

    it("converts non-string values to string", () => {
      expect(escapeHtml(42 as unknown as string)).toBe("42");
      expect(escapeHtml(true as unknown as string)).toBe("true");
      expect(escapeHtml(null as unknown as string)).toBe("");
      expect(escapeHtml(undefined as unknown as string)).toBe("");
    });
  });
});
