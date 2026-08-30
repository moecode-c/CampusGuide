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

  // Rejected sign-ins. Previously unrecorded — `authorize()` just returned
  // null — which left the most useful security signal invisible.
  SignInFailed: "auth.signin.failed",
  SignInUnknown: "auth.signin.unknown",
  SignInBanned: "auth.signin.banned",
  RateLimited: "abuse.rate_limited",

  FlagEnabled: "admin.flag.enable",
  FlagDisabled: "admin.flag.disable",
  AlertAcknowledged: "admin.alert.ack",

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

  UserCreate: "admin.user.create",

  TeamPostCreate: "team.post.create",
  TeamPostDelete: "team.post.delete",

  /**
   * A deliberate bulk clear-out of stale posts from the admin dashboard.
   *
   * Kept distinct from TeamPostDelete on purpose: the mass-deletion alert counts
   * single deletes to catch a compromised account, and one intentional cleanup
   * of twenty old posts would otherwise raise a security alert against the admin
   * who pressed the button. One log entry records the whole sweep.
   */
  TeamPostPurge: "team.post.purge",

  IpBlocked: "security.ip.block",
  IpUnblocked: "security.ip.unblock",

  VideoCourseCreate: "video.course.create",
  VideoCourseUpdate: "video.course.update",
  VideoCourseDelete: "video.course.delete",
} as const;

export type ActivityAction = (typeof ActivityActions)[keyof typeof ActivityActions];
