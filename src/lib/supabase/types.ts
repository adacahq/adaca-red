/**
 * Database types for the operations graph.
 *
 * Hand-written to match supabase/migrations. Regenerate the canonical version
 * any time the schema changes with:
 *
 *   supabase gen types typescript --local > src/lib/supabase/types.ts
 *
 * Convention reminder: every table leads with id (nanoid text), created_at,
 * updated_at. `data` / `config` columns are free-form jsonb (Json).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = { id: string; created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      definitions: {
        Row: Timestamps & { kind: 'node' | 'edge'; key: string; label: string; config: Json };
        Insert: { id?: string; created_at?: string; updated_at?: string; kind: 'node' | 'edge'; key: string; label: string; config?: Json };
        Update: Partial<Database['public']['Tables']['definitions']['Insert']>;
        Relationships: [];
      };
      roles: {
        Row: Timestamps & { key: string; label: string; config: Json };
        Insert: { id?: string; created_at?: string; updated_at?: string; key: string; label: string; config?: Json };
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
        Relationships: [];
      };
      users: {
        Row: Timestamps & { auth_id: string | null; name: string | null; email: string | null };
        Insert: { id?: string; created_at?: string; updated_at?: string; auth_id?: string | null; name?: string | null; email?: string | null };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      nodes: {
        Row: Timestamps & {
          type_key: string; parent_id: string | null; position: number;
          data: Json; current_rev: number; created_by: string | null; deleted_at: string | null;
        };
        Insert: {
          id?: string; created_at?: string; updated_at?: string;
          type_key: string; parent_id?: string | null; position?: number;
          data?: Json; current_rev?: number; created_by?: string | null; deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['nodes']['Insert']>;
        Relationships: [];
      };
      edges: {
        Row: Timestamps & {
          type_key: string; from_id: string; to_id: string;
          data: Json; current_rev: number; created_by: string | null; deleted_at: string | null;
        };
        Insert: {
          id?: string; created_at?: string; updated_at?: string;
          type_key: string; from_id: string; to_id: string;
          data?: Json; current_rev?: number; created_by?: string | null; deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['edges']['Insert']>;
        Relationships: [];
      };
      assignments: {
        Row: Timestamps & { node_id: string; user_id: string; role_key: string };
        Insert: { id?: string; created_at?: string; updated_at?: string; node_id: string; user_id: string; role_key: string };
        Update: Partial<Database['public']['Tables']['assignments']['Insert']>;
        Relationships: [];
      };
      revisions: {
        Row: Timestamps & {
          target_kind: 'node' | 'edge'; target_id: string; rev_no: number;
          data: Json; author_id: string | null; change_note: string | null;
        };
        Insert: {
          id?: string; created_at?: string; updated_at?: string;
          target_kind: 'node' | 'edge'; target_id: string; rev_no: number;
          data: Json; author_id?: string | null; change_note?: string | null;
        };
        Update: Partial<Database['public']['Tables']['revisions']['Insert']>;
        Relationships: [];
      };
      dashboards: {
        Row: Timestamps & {
          user_id: string; name: string; is_default: boolean; layout: Json; deleted_at: string | null;
        };
        Insert: {
          id?: string; created_at?: string; updated_at?: string;
          user_id: string; name?: string; is_default?: boolean; layout?: Json; deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['dashboards']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      set_user_role: {
        Args: { target_user_id: string; new_role: string | null };
        Returns: undefined;
      };
      save_node: {
        Args: {
          p_id: string | null;
          p_type: string;
          p_parent: string | null;
          p_data: Json;
          p_position?: number;
          p_change_note?: string | null;
        };
        Returns: string;
      };
      save_edge: {
        Args: {
          p_id: string | null;
          p_type: string;
          p_from: string;
          p_to: string;
          p_data: Json;
          p_change_note?: string | null;
        };
        Returns: string;
      };
      soft_delete_node: { Args: { p_id: string }; Returns: undefined };
      soft_delete_edge: { Args: { p_id: string }; Returns: undefined };
      current_user_id: { Args: Record<string, never>; Returns: string };
      get_subtree: {
        Args: { p_root: string };
        Returns: Database['public']['Tables']['nodes']['Row'][];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

// Convenience row aliases.
export type DefinitionRow = Database['public']['Tables']['definitions']['Row'];
export type RoleRow = Database['public']['Tables']['roles']['Row'];
export type UserRow = Database['public']['Tables']['users']['Row'];
export type NodeRow = Database['public']['Tables']['nodes']['Row'];
export type EdgeRow = Database['public']['Tables']['edges']['Row'];
export type AssignmentRow = Database['public']['Tables']['assignments']['Row'];
export type RevisionRow = Database['public']['Tables']['revisions']['Row'];
export type DashboardRow = Database['public']['Tables']['dashboards']['Row'];

/** The shape stored inside a definition's `config` jsonb. */
export interface FieldDef {
  key: string;
  label: string;
  data_type: 'text' | 'number' | 'enum' | 'date' | 'boolean' | 'richtext' | 'user';
  required?: boolean;
  filterable?: boolean;
  position?: number;
  options?: {
    /**
     * Enum options. Each choice carries a stable `key` (stored value), an
     * optional display `label`, and an optional `tone` (semantic colour). A
     * bare string is accepted as legacy shorthand for `{ key }`. Order is
     * meaningful (drives kanban column order). Resolve via `getChoices()`.
     */
    choices?: (string | ChoiceOption)[];
    min?: number;
    max?: number;
    /** For number fields: word labels for steps min..max (e.g. Very low…Very high). Value stays numeric. */
    labels?: string[];
  };
}

/** Semantic colour for a chip/choice. Maps to CSS tokens in choices.ts. */
export type ChoiceTone = 'neutral' | 'info' | 'ok' | 'warn' | 'crit' | 'accent';

export interface ChoiceOption {
  key: string;
  label?: string;
  tone?: ChoiceTone;
}

export interface NodeConfig {
  allowedParents: string[];
  fields: FieldDef[];
  /** Detail-screen tab spec (definition-level). Sparse overlay over the tabs
   *  derived from fields/children/edges — see `nodeTabs` + `lib/views`. */
  tabs?: TabSpec[];
  /** Whether this type gets a register link in the nav sidebar. */
  sidebar?: boolean;
  /** Icon name (see `lib/views/icons`) for nav / list header / recents. */
  icon?: string;
}

/** One allowed (from-type → to-type) relationship for an edge type. `*` is a
 *  wildcard matching any node type (used by the loose `related` edge). */
export interface EdgePair {
  from: string;
  to: string;
}

export interface EdgeConfig {
  /** Each distinct relationship the edge permits, declared explicitly — NOT the
   *  cross-product of two lists. `[{from:'initiative',to:'risk'}]` allows only
   *  that direction, never the incidental cross terms. */
  pairs: EdgePair[];
  fields: FieldDef[];
}

/**
 * A presentation kind in the view registry (`src/lib/views/registry.tsx`).
 * `overview | children | edge | activity` are structural (derived defaults);
 * `board | red | timeline` are optional views the user adds, gated by a
 * circumstance predicate.
 */
export type ViewKind =
  | 'overview'
  | 'children'
  | 'edge'
  | 'activity'
  | 'board'
  | 'red'
  | 'timeline';

/**
 * One detail-screen tab, stored on a node definition's `config.tabs`.
 * Either references a derived structural tab (`ref`) — to reorder, hide or
 * relabel it — or adds an optional view (`kind`). `config` carries view params
 * (e.g. board: `{ childType, groupBy, containerTypes, cardFields }`;
 * children: `{ onlyTypes }`).
 */
export interface TabSpec {
  id: string;
  ref?: string;
  kind?: ViewKind;
  label?: string;
  hidden?: boolean;
  config?: Record<string, unknown>;
}
