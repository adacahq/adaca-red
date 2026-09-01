/**
 * The navigation hierarchy, in one place. The sidebar renders the group/
 * section tree (a section with more than one view wears a chevron and its
 * views drop down beneath it) and the topbar names the current group and
 * section — both read this tree, so they can never drift apart.
 *
 * Pure data + pure functions only — no `'use client'` — so this is
 * importable from both the server layout (which builds the dynamic Register
 * group) and the client shell (sidebar, topbar).
 */

/** Who may see a nav item: everyone, signed-in staff, or admin/owner only. */
export type Tier = 'any' | 'internal' | 'admin';

export interface NavView {
  href: string;
  label: string;
  tier: Tier;
  /** Match the pathname exactly (for `/`) rather than by prefix. */
  exact?: boolean;
}

export interface NavSection {
  key: string;
  label: string;
  views: NavView[];
}

export interface NavGroup {
  key: string;
  /** Omitted for the top, unlabelled group (Dashboard / For You). */
  label?: string;
  sections: NavSection[];
  /** Rendered last, pinned to the bottom of the rail. */
  footer?: boolean;
}

/** A register entry: one node type flagged "show in sidebar". */
export interface RegisterItem {
  name: string;
  href: string;
}

/**
 * Red's system roles are `admin | owner | member | viewer` (`users.role`).
 * `role` is left as `string` here rather than a union: it flows straight
 * from the DB column (`string | null`, already narrowed to non-null by the
 * time it reaches the shell) and callers shouldn't need a cast to pass it.
 */
export function allowed(tier: Tier, role: string): boolean {
  if (tier === 'any') return true;
  if (tier === 'internal') return role !== 'viewer';
  return role === 'admin' || role === 'owner';
}

/** The static nav tree, plus the dynamic Register group built from the
 *  sidebar-flagged node definitions. */
export function navGroups(register: RegisterItem[]): NavGroup[] {
  return [
    {
      key: 'main',
      sections: [
        { key: 'dashboard', label: 'Dashboard', views: [{ href: '/', label: 'Dashboard', tier: 'any', exact: true }] },
        { key: 'for-you', label: 'For You', views: [{ href: '/for-you', label: 'For You', tier: 'any' }] },
      ],
    },
    {
      key: 'register',
      label: 'Register',
      sections: register.map((r) => ({
        key: r.href,
        label: r.name,
        views: [{ href: r.href, label: r.name, tier: 'any' }],
      })),
    },
    {
      key: 'reports',
      label: 'Reports',
      sections: [
        {
          key: 'reports',
          label: 'Reports',
          views: [
            // The index page is a real route (a card grid over the four
            // reports). Without an entry here the section's row would link
            // straight to the risk matrix and /reports would be unreachable
            // from the rail. `exact` so it doesn't swallow its own children.
            { href: '/reports', label: 'Overview', tier: 'any', exact: true },
            { href: '/reports/risk-matrix', label: 'Risk matrix', tier: 'any' },
            { href: '/reports/red-coverage', label: 'RED coverage', tier: 'any' },
            { href: '/reports/portfolio', label: 'Portfolio', tier: 'any' },
            { href: '/reports/incidents', label: 'Incident analytics', tier: 'any' },
          ],
        },
      ],
    },
    {
      key: 'admin',
      label: 'Admin',
      footer: true,
      sections: [
        {
          key: 'admin',
          label: 'Admin',
          views: [
            { href: '/admin/users', label: 'Users', tier: 'admin' },
            { href: '/admin/roles', label: 'Roles', tier: 'admin' },
            { href: '/admin/definitions', label: 'Definitions', tier: 'admin' },
            { href: '/admin/forms', label: 'Forms', tier: 'admin' },
            { href: '/admin/rubrics', label: 'Rubrics', tier: 'admin' },
            { href: '/admin/workflows', label: 'Workflows', tier: 'admin' },
            { href: '/admin/settings', label: 'Settings', tier: 'admin' },
          ],
        },
      ],
    },
  ];
}

/**
 * Prefix matching is boundary-aware: `/n/risk` must not light up for
 * `/n/risk-group`. A bare `startsWith` gets that wrong, and the Register
 * group is built from user-defined type keys, so sibling names that share a
 * prefix are a question of what someone types in Admin → Definitions, not a
 * hypothetical.
 */
export function viewOn(view: NavView, pathname: string): boolean {
  if (view.exact) return pathname === view.href;
  return pathname === view.href || pathname.startsWith(`${view.href}/`);
}

export function sectionOn(section: NavSection, pathname: string): boolean {
  return section.views.some((v) => viewOn(v, pathname));
}

export function visibleViews(section: NavSection, role: string): NavView[] {
  return section.views.filter((v) => allowed(v.tier, role));
}

/** Where the topbar's position readout points: the active group, its
 *  active section, and (when the section has more than one visible view)
 *  the specific view that's current. Null for a path that matches nothing
 *  in the tree (e.g. `/search`) rather than throwing. */
export function activeGroupAndSection(
  groups: NavGroup[],
  pathname: string,
  role: string,
): { group: NavGroup; section: NavSection; view: NavView | null } | null {
  for (const group of groups) {
    for (const section of group.sections) {
      if (!sectionOn(section, pathname)) continue;
      const views = visibleViews(section, role);
      // A section the caller may not see is not "where they are" — without
      // this, a viewer who reaches an admin URL would read ADMIN in the
      // topbar even though the rail shows them no such section.
      if (!views.length) continue;
      const view = views.find((v) => viewOn(v, pathname)) ?? null;
      return { group, section, view };
    }
  }
  return null;
}
