/**
 * Base path for a node type. The three original domain types keep their named
 * routes (`/initiatives`, …) so existing links, recents and search stay valid;
 * every other type — including newly created ones — is served by the generic
 * `/n/[type]` route family. Detail = `${routeFor(type)}/${id}`.
 */
const NAMED: Record<string, string> = {
  initiative: '/initiatives',
  risk: '/risks',
  incident: '/incidents',
};

export function routeFor(typeKey: string): string {
  return NAMED[typeKey] ?? `/n/${typeKey}`;
}
