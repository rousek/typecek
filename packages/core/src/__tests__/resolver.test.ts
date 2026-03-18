import { describe, it, expect } from "vitest";
import path from "path";
import { resolveType } from "../resolver.js";
import { TypeKind } from "../types.js";

const fixturesDir = path.resolve(__dirname, "__fixtures__");
const typesFile = path.join(fixturesDir, "types.ts");

describe("type resolver", () => {
  it("resolves a simple interface with primitive properties", () => {
    const type = resolveType(typesFile, "Simple");
    expect(type.kind).toBe(TypeKind.Object);
    if (type.kind !== TypeKind.Object) return;
    expect(type.properties.get("name")?.kind).toBe(TypeKind.String);
    expect(type.properties.get("age")?.kind).toBe(TypeKind.Number);
    expect(type.properties.get("active")?.kind).toBe(TypeKind.Boolean);
  });

  it("resolves array properties", () => {
    const type = resolveType(typesFile, "WithArray");
    expect(type.kind).toBe(TypeKind.Object);
    if (type.kind !== TypeKind.Object) return;
    const items = type.properties.get("items");
    expect(items?.kind).toBe(TypeKind.Array);
    if (items?.kind !== TypeKind.Array) return;
    expect(items.elementType.kind).toBe(TypeKind.String);
  });

  it("resolves nested object properties", () => {
    const type = resolveType(typesFile, "WithNested");
    expect(type.kind).toBe(TypeKind.Object);
    if (type.kind !== TypeKind.Object) return;
    const address = type.properties.get("address");
    expect(address?.kind).toBe(TypeKind.Object);
    if (address?.kind !== TypeKind.Object) return;
    expect(address.properties.get("street")?.kind).toBe(TypeKind.String);
    expect(address.properties.get("city")?.kind).toBe(TypeKind.String);
  });

  it("resolves union types with null", () => {
    const type = resolveType(typesFile, "WithNullable");
    expect(type.kind).toBe(TypeKind.Object);
    if (type.kind !== TypeKind.Object) return;
    const value = type.properties.get("value");
    expect(value?.kind).toBe(TypeKind.Union);
    if (value?.kind !== TypeKind.Union) return;
    const kinds = value.types.map((t) => t.kind);
    expect(kinds).toContain(TypeKind.String);
    expect(kinds).toContain(TypeKind.Null);
  });

  it("resolves string literal unions", () => {
    const type = resolveType(typesFile, "WithRole");
    expect(type.kind).toBe(TypeKind.Object);
    if (type.kind !== TypeKind.Object) return;
    const role = type.properties.get("role");
    expect(role?.kind).toBe(TypeKind.Union);
    if (role?.kind !== TypeKind.Union) return;
    expect(role.types).toHaveLength(3);
    expect(role.types[0].kind).toBe(TypeKind.StringLiteral);
  });

  it("resolves type aliases", () => {
    const type = resolveType(typesFile, "AliasedType");
    expect(type.kind).toBe(TypeKind.Object);
    if (type.kind !== TypeKind.Object) return;
    expect(type.properties.get("x")?.kind).toBe(TypeKind.Number);
  });

  it("resolves interfaces with array of objects", () => {
    const type = resolveType(typesFile, "PageData");
    expect(type.kind).toBe(TypeKind.Object);
    if (type.kind !== TypeKind.Object) return;
    const users = type.properties.get("users");
    expect(users?.kind).toBe(TypeKind.Array);
    if (users?.kind !== TypeKind.Array) return;
    expect(users.elementType.kind).toBe(TypeKind.Object);
    if (users.elementType.kind !== TypeKind.Object) return;
    expect(users.elementType.properties.get("name")?.kind).toBe(TypeKind.String);
  });

  it("throws for non-existent type", () => {
    expect(() => resolveType(typesFile, "DoesNotExist")).toThrow("not found");
  });

  it("throws for non-existent file", () => {
    expect(() => resolveType("/nonexistent/file.ts", "Foo")).toThrow();
  });
});
