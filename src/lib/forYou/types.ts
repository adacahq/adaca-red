/** Per-user config for the For You table (stored in `for_you_views.config`). */
export interface ForYouConfig {
  /** Ordered, selected column keys. Absent ⇒ all available columns. */
  columns?: string[];
  /** Included node type keys. Absent ⇒ all types with a For-You field. */
  types?: string[];
}

/** A node surfaced in For You (serialisable for the client table). */
export interface ForYouItem {
  id: string;
  typeKey: string;
  data: Record<string, unknown>;
}
