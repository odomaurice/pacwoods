import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Compiles a model once per process in production. In development, hot
 * reload re-runs the model module with a possibly changed schema; reusing the
 * model cached from before would silently drop any new fields on save, so the
 * model is recompiled instead.
 */
export function defineModel<T>(name: string, schema: Schema): Model<T> {
  if (process.env.NODE_ENV !== "production" && mongoose.models[name]) mongoose.deleteModel(name);
  return (mongoose.models[name] ?? mongoose.model(name, schema)) as unknown as Model<T>;
}
