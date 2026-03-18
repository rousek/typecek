export interface User {
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  role: "admin" | "editor" | "viewer";
  address: {
    street: string;
    city: string;
  } | null;
}

export interface PageData {
  title: string;
  users: User[];
  showHeader: boolean;
}
