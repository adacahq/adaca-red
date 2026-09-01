import { describe, expect, it } from 'vitest';
import { activeGroupAndSection, allowed, navGroups, viewOn } from './nav';
import type { RegisterItem } from './nav';

/**
 * The nav tree drives both the sidebar and the topbar readout — a wrong
 * match here means the two silently disagree about "where you are". The
 * trap this pins: `/` must not swallow every route, and a leaf report route
 * must resolve to itself, not to a bare section link that doesn't exist.
 */

const REGISTER: RegisterItem[] = [
  { name: 'Initiatives', href: '/initiatives' },
  { name: 'Risks', href: '/risks' },
  { name: 'Incidents', href: '/incidents' },
];

describe('nav', () => {
  it('/ matches Dashboard only (exact), not every route', () => {
    const groups = navGroups(REGISTER);
    const dashboard = groups[0].sections[0].views[0];
    expect(dashboard.href).toBe('/');
    expect(viewOn(dashboard, '/')).toBe(true);
    expect(viewOn(dashboard, '/for-you')).toBe(false);
    expect(viewOn(dashboard, '/risks')).toBe(false);

    const hit = activeGroupAndSection(groups, '/', 'member');
    expect(hit?.section.label).toBe('Dashboard');
    expect(hit?.view?.href).toBe('/');
  });

  it('/reports/risk-matrix resolves to the Reports section and view, not a bare /reports match', () => {
    const groups = navGroups(REGISTER);
    const hit = activeGroupAndSection(groups, '/reports/risk-matrix', 'member');
    expect(hit?.group.key).toBe('reports');
    expect(hit?.section.key).toBe('reports');
    expect(hit?.view?.label).toBe('Risk matrix');
  });

  it('a viewer sees no Admin views; an admin and an owner both see all seven', () => {
    const admin = navGroups(REGISTER).find((g) => g.key === 'admin')!.sections[0];
    expect(admin.views.filter((v) => allowed(v.tier, 'viewer'))).toHaveLength(0);
    expect(admin.views.filter((v) => allowed(v.tier, 'member'))).toHaveLength(0);
    expect(admin.views.filter((v) => allowed(v.tier, 'admin'))).toHaveLength(7);
    expect(admin.views.filter((v) => allowed(v.tier, 'owner'))).toHaveLength(7);
  });

  it('activeGroupAndSection returns null for an unknown path rather than throwing', () => {
    const groups = navGroups(REGISTER);
    expect(activeGroupAndSection(groups, '/search', 'admin')).toBeNull();
    expect(activeGroupAndSection(groups, '/nonexistent', 'viewer')).toBeNull();
  });

  it('a dynamic register item resolves to its own section', () => {
    const groups = navGroups(REGISTER);
    const hit = activeGroupAndSection(groups, '/risks', 'member');
    expect(hit?.group.key).toBe('register');
    expect(hit?.section.label).toBe('Risks');
    expect(hit?.view?.label).toBe('Risks');

    // A risk's own detail page still resolves to the Risks section.
    const detail = activeGroupAndSection(groups, '/risks/abc123defg', 'member');
    expect(detail?.section.label).toBe('Risks');
  });

  it('prefix matching stops at a path boundary', () => {
    // The Register group is built from user-defined type keys, so sibling
    // names that share a prefix are a matter of what someone types into
    // Admin → Definitions. A bare startsWith would light up the wrong row.
    const register: RegisterItem[] = [
      { name: 'Risk', href: '/n/risk' },
      { name: 'Risk group', href: '/n/risk-group' },
    ];
    const groups = navGroups(register);

    expect(activeGroupAndSection(groups, '/n/risk-group', 'member')?.section.label).toBe('Risk group');
    expect(activeGroupAndSection(groups, '/n/risk', 'member')?.section.label).toBe('Risk');
    expect(activeGroupAndSection(groups, '/n/risk/abc123defg', 'member')?.section.label).toBe('Risk');

    // And the raw predicate, directly.
    expect(viewOn({ href: '/n/risk', label: 'Risk', tier: 'any' }, '/n/risk-group')).toBe(false);
    expect(viewOn({ href: '/n/risk', label: 'Risk', tier: 'any' }, '/n/risk')).toBe(true);
    expect(viewOn({ href: '/n/risk', label: 'Risk', tier: 'any' }, '/n/risk/x')).toBe(true);
  });

  it('the reports index is reachable and does not swallow its own leaves', () => {
    const groups = navGroups(REGISTER);

    // The section's row links to views[0], so /reports must be first —
    // otherwise the index page is orphaned from the rail entirely.
    const reports = groups.find((g) => g.key === 'reports')!.sections[0];
    expect(reports.views[0].href).toBe('/reports');

    expect(activeGroupAndSection(groups, '/reports', 'member')?.view?.label).toBe('Overview');
    expect(activeGroupAndSection(groups, '/reports/portfolio', 'member')?.view?.label).toBe('Portfolio');
  });

  it('a section with no views the caller may see is not "where they are"', () => {
    const groups = navGroups(REGISTER);
    // A viewer who lands on an admin URL must not read ADMIN in the topbar
    // when the rail shows them no such section.
    expect(activeGroupAndSection(groups, '/admin/users', 'viewer')).toBeNull();
    expect(activeGroupAndSection(groups, '/admin/users', 'admin')?.group.key).toBe('admin');
  });
});
