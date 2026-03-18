export interface Simple {
  name: string;
  age: number;
  active: boolean;
}

export interface WithArray {
  items: string[];
}

export interface WithNested {
  address: {
    street: string;
    city: string;
  };
}

export interface WithNullable {
  value: string | null;
}

export interface WithRole {
  role: "admin" | "editor" | "viewer";
}

export type AliasedType = {
  x: number;
  y: number;
};

export interface User {
  name: string;
  email: string;
  age: number;
}

export interface PageData {
  title: string;
  users: User[];
  showHeader: boolean;
}
