import { Schema, type InferSchemaType, type Model } from "mongoose";
import { defineModel } from "@/server/db/model";

/**
 * An in-app notification. Delivery is in-app only for now; an email or SMS
 * sender can later read the same records (channel, sentAt).
 */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, maxlength: 500 },
    href: { type: String, maxlength: 300 },
    readAt: { type: Date },
    channel: { type: String, default: "IN_APP" },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
// Old notifications are cleared after a year.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationDoc> = defineModel<NotificationDoc>("Notification", notificationSchema);
