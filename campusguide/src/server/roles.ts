export const Roles = {
  Student: "student",
  Admin: "admin",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
