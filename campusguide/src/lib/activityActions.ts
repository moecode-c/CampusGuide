/**
 * Activity action names.
 *
 * These live in `lib` rather than beside the Mongoose model so client
 * components (the admin activity filter) can import them without pulling
 * mongoose into the browser bundle.
 */
export const ActivityActions = {
  Register: "auth.register",
  SignIn: "auth.signin",

  VerifyApprove: "admin.user.verify",
  VerifyReject: "admin.user.reject",
  UserBan: "admin.user.ban",
  UserUnban: "admin.user.unban",
  UserDelete: "admin.user.delete",

  ResourceCreate: "resource.create",
  ResourceUpdate: "resource.update",
  ResourceReplace: "resource.replace",
  ResourceDelete: "resource.delete",

  FolderCreate: "folder.create",
  FolderUpdate: "folder.update",
  FolderDelete: "folder.delete",

  ScheduleImport: "schedule.import",
} as const;

export type ActivityAction = (typeof ActivityActions)[keyof typeof ActivityActions];
