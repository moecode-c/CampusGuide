import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { TeamPostKinds, TeamDifficulties, TeamPostStatuses } from "@/lib/teams";

/**
 * A notice on the project-team board.
 *
 * Both directions of the search live in one collection so the feed is a single
 * query: `needs_members` is a team advertising open spots, `needs_team` is a
 * student advertising themselves. The two differ only in how a card is worded.
 *
 * Contact happens off-platform — the post carries a phone number and the reader
 * calls or messages it. There is no in-app join request.
 */

const teamPostSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Denormalized so a card still reads correctly if the owner is later deleted.
    ownerName: { type: String, required: true },

    kind: { type: String, enum: Object.values(TeamPostKinds), required: true, index: true },

    title: { type: String, required: true },
    subject: { type: String, required: true, index: true },
    academicYear: { type: Number, min: 1, max: 4, index: true },

    /** The specific assignment, when there is one. Plenty of posts go up before it's announced. */
    projectName: { type: String },

    description: { type: String },

    /**
     * How ambitious a project the poster wants. Required — an optional field
     * here would leave half the board invisible to the difficulty filter.
     */
    difficulty: {
      type: String,
      enum: Object.values(TeamDifficulties),
      required: true,
      default: TeamDifficulties.Medium,
      index: true,
    },

    skillsNeeded: { type: [String], default: [] },

    currentMembers: { type: Number, min: 1, max: 20, default: 1 },
    /** Spots still open. Only meaningful on a `needs_members` post. */
    neededCount: { type: Number, min: 1, max: 20 },

    // Stored in the canonical `+20…` shape produced by normalizePhone(), so the
    // same number typed three different ways is one number.
    contactPhone: { type: String, required: true },
    contactWhatsapp: { type: Boolean, default: true },

    status: {
      type: String,
      enum: Object.values(TeamPostStatuses),
      required: true,
      default: TeamPostStatuses.Open,
      index: true,
    },
  },
  { timestamps: true }
);

// The default feed: open posts, newest first, optionally narrowed by difficulty.
teamPostSchema.index({ status: 1, difficulty: 1, createdAt: -1 });
// The subject/year filter pair.
teamPostSchema.index({ subject: 1, academicYear: 1 });
// "My posts" reads newest-first for one owner.
teamPostSchema.index({ ownerId: 1, createdAt: -1 });

export type TeamPostDoc = InferSchemaType<typeof teamPostSchema>;

export const TeamPost: Model<TeamPostDoc> =
  (mongoose.models.TeamPost as Model<TeamPostDoc>) ||
  mongoose.model<TeamPostDoc>("TeamPost", teamPostSchema);
