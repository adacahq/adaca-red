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

/** Definition config kinds: node/edge types plus the forms/workflow layer. */
export type DefinitionKind = 'node' | 'edge' | 'form' | 'rubric' | 'workflow';

export interface Database {
  public: {
    Tables: {
      definitions: {
        Row: Timestamps & { kind: DefinitionKind; key: string; label: string; config: Json };
        Insert: { id?: string; created_at?: string; updated_at?: string; kind: DefinitionKind; key: string; label: string; config?: Json };
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
      for_you_views: {
        Row: Timestamps & {
          user_id: string; is_default: boolean; config: Json; deleted_at: string | null;
        };
        Insert: {
          id?: string; created_at?: string; updated_at?: string;
          user_id: string; is_default?: boolean; config?: Json; deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['for_you_views']['Insert']>;
        Relationships: [];
      };
      documents: {
        Row: Timestamps & {
          node_id: string; filename: string; mime_type: string;
          size_bytes: number; storage_path: string; text_content: string | null;
        };
        Insert: {
          id?: string; created_at?: string; updated_at?: string;
          node_id: string; filename: string; mime_type: string;
          size_bytes: number; storage_path: string; text_content?: string | null;
        };
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
        Relationships: [];
      };
      settings: {
        Row: Timestamps & { key: string; value: Json };
        Insert: { id?: string; created_at?: string; updated_at?: string; key: string; value: Json };
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
        Relationships: [];
      };
      counters: {
        Row: Timestamps & { key: string; value: number };
        Insert: { id?: string; created_at?: string; updated_at?: string; key: string; value?: number };
        Update: Partial<Database['public']['Tables']['counters']['Insert']>;
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
      next_counter: { Args: { p_key: string }; Returns: number };
      purge_nodes: { Args: { p_ids: string[] }; Returns: number };
      claim_run_unit: {
        Args: { p_id: string; p_step: number; p_sub: number };
        Returns: string | null;
      };
      complete_run_unit: {
        Args: {
          p_id: string;
          p_step: number;
          p_sub: number;
          p_token: string;
          p_slot: string[];
          p_output: Json;
          p_merge: boolean;
        };
        Returns: number | null;
      };
      advance_run_step: {
        Args: {
          p_id: string;
          p_from_step: number;
          p_total_subs: number;
          p_last_step: boolean;
          p_change_note: string;
        };
        Returns: boolean;
      };
      fail_run_unit: {
        Args: {
          p_id: string;
          p_step: number;
          p_sub: number;
          p_token: string;
          p_error: string;
          p_change_note: string;
        };
        Returns: boolean;
      };
      release_run_unit: {
        Args: {
          p_id: string;
          p_step: number;
          p_sub: number;
          p_token: string;
          p_max: number;
          p_error: string;
          p_change_note: string;
        };
        Returns: number | null;
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
export type RevisionRow = Database['public']['Tables']['revisions']['Row'];
export type DashboardRow = Database['public']['Tables']['dashboards']['Row'];

/** The shape stored inside a definition's `config` jsonb. */
export interface FieldDef {
  key: string;
  label: string;
  data_type: 'text' | 'number' | 'enum' | 'date' | 'boolean' | 'richtext' | 'user' | 'users';
  required?: boolean;
  filterable?: boolean;
  /** For `user`/`users` fields: include in the per-user "For You" surface. */
  forYou?: boolean;
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

// ─── Forms / workflow layer (definitions kinds 'form' | 'rubric' | 'workflow')
// See docs/workflow-forms-plan.md. All three are `config` jsonb shapes, read
// whole, admin-edited. Retention semantics: WHOLE-node deletion policies —
// anything that must outlive a submission is written onto the assessment node.

export type RetentionMode = 'off' | 'days' | 'persist';
export interface RetentionSetting {
  mode: RetentionMode;
  days?: number;
}

/** Kinds a public form can accept as uploads. All OOXML kinds are sniffed
 *  inside the zip (never trusted from extension/MIME alone). */
export type UploadKind = 'pdf' | 'docx' | 'pptx' | 'xlsx';

/** Structured landing-page blocks rendered from a small code registry
 *  (LandingBlocks component) — config chooses which blocks appear and what
 *  they say; absent/empty = today's prose-only page. */
export type LandingBlock =
  | { type: 'prose'; markdown: string }
  | {
      type: 'verdictLegend';
      /** Per-verdict copy; description falls back to wording derived from the
       *  live verdict thresholds of the form's workflow. */
      items?: { key: 'green' | 'amber' | 'red'; label?: string; description?: string }[];
    }
  | { type: 'steps'; items: { label: string; description?: string }[] }
  | { type: 'stats'; items: { value: string; label: string }[] };

/** Public intake form: creates nodes of `targetType` from anonymous submissions. */
export interface FormConfig {
  targetType: string;
  /** Workflow definition key run after each submission. */
  workflow?: string;
  enabled: boolean;
  /** Keys of target-type fields shown to the submitter. */
  fields: string[];
  /** Field key → literal or token template ({{submission_number}}, {{submission_date}}, {{form_key}}, …). */
  presets: Record<string, string>;
  /** Field keys the workflow copies onto the result node (lead/contact fields). */
  carryOver?: string[];
  uploads?: {
    enabled: boolean;
    accept: UploadKind[];
    maxFiles: number;
    minFiles?: number;
    guidance?: string;
  };
  copy: {
    title: string;
    intro?: string;
    submitLabel?: string;
    /** Appended AFTER the auto-generated retention line. */
    privacyNote?: string;
    successNote?: string;
    /** Structured blocks rendered between intro and the form; absent = intro only. */
    blocks?: LandingBlock[];
    /** Prominent page CTA on the public form page; absent = none (today). */
    cta?: { label: string; href: string };
  };
  /** Per-form override of the app-wide retention settings. */
  retention?: {
    submission?: RetentionSetting;
    assessment?: RetentionSetting;
  };
}

export interface RubricControl {
  key: string;
  label: string;
  description: string;
  /** What good evidence looks like — guides both the LLM and the submitter. */
  evidence?: string;
  /** Verdict weighting; default 1. */
  weight?: number;
}

export interface RubricPrinciple {
  key: string;
  label: string;
  description?: string;
  controls: RubricControl[];
}

export interface RubricRating {
  key: string;
  label: string;
  /** Numeric contribution to coverage; null = excluded (e.g. not_applicable). */
  score: number | null;
  tone: ChoiceTone;
  /** Customer-facing "next best step" line shown on the report score tile for this rating. */
  guidance?: string;
}

export interface RubricConfig {
  principles: RubricPrinciple[];
  ratings: RubricRating[];
}

export interface ReportSection {
  key: string;
  title: string;
  source: 'verdict' | 'findings' | 'coherence' | 'llm';
  /** For source 'llm': plain-language composition prompt. */
  prompt?: string;
  maxItems?: number;
  /** verdict source: 'tiles' renders the four counts as expandable cards
   *  carrying each rating's `guidance` copy; default 'inline' (today's row).
   *  findings source: 'tabs' renders one tab per rubric principle; default
   *  stacked. */
  display?: 'inline' | 'tiles' | 'tabs';
  /** findings source: show control keys (F.3, …) next to each finding; default true. */
  showControlIds?: boolean;
  /** findings source: show per-principle "what this means for you" summaries; default false. */
  showSummaries?: boolean;
  /** Render the section body inside a collapsed <details>; default false. */
  collapsed?: boolean;
}

export type WorkflowStep = {
  /** Public status-page label override; falls back to the code STEP_LABELS map. */
  label?: string;
} & (
  | { type: 'extract'; config?: Record<string, never> }
  | { type: 'assess'; config: { rubric: string; prompt?: string } }
  | { type: 'coherence'; config?: { prompt?: string } }
  | { type: 'verdict'; config: { thresholds: { green: number; amber: number } } }
  | { type: 'report'; config: { sections: ReportSection[] } }
  | {
      type: 'notify';
      config: {
        /** Submission field holding the recipient address. */
        emailField?: string;
        /** Token-templated ({{verdict_label}}, {{form_label}}, …). */
        subject: string;
        ctas: { label: string; href: string }[];
      };
    }
);

export interface WorkflowConfig {
  /** Node type the pipeline produces (e.g. 'assessment'). */
  resultType: string;
  /** Anthropic model id; default claude-opus-4-8. */
  model?: string;
  /** Public status-page presentation; absent = today's minimal page (deploy ≠ change). */
  status?: {
    /** Renders "usually takes N–M minutes" copy; absent = today's generic line. */
    expectedMinutes?: [number, number];
    /** Render the stage list derived from `steps`; default false. */
    showStages?: boolean;
    /** Live sub-unit detail line ("Assessing principle 4 of 6 …"); default false. */
    showDetail?: boolean;
  };
  steps: WorkflowStep[];
}
