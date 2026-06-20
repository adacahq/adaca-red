import { createElement, type ComponentType, type SVGProps } from 'react';
import {
  RocketLaunchIcon,
  ShieldExclamationIcon,
  FireIcon,
  DocumentTextIcon,
  FolderIcon,
  CubeIcon,
  FlagIcon,
  BoltIcon,
  BeakerIcon,
  ChartBarIcon,
  UsersIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  TagIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Curated icon registry for node types. The *choice* of icon is config
 * (`config.icon`, a stable name); the name→component mapping is code, mirroring
 * the view registry. Server code resolves to a component and renders it; the
 * client (nav, recents) receives the name string and resolves it here, since
 * components can't cross the RSC boundary.
 */
export const NODE_ICONS: Record<string, Icon> = {
  rocket: RocketLaunchIcon,
  shield: ShieldExclamationIcon,
  fire: FireIcon,
  document: DocumentTextIcon,
  folder: FolderIcon,
  cube: CubeIcon,
  flag: FlagIcon,
  bolt: BoltIcon,
  beaker: BeakerIcon,
  chart: ChartBarIcon,
  users: UsersIcon,
  check: CheckCircleIcon,
  calendar: CalendarDaysIcon,
  tag: TagIcon,
  squares: Squares2X2Icon,
};

export const DEFAULT_ICON = 'squares';
export const NODE_ICON_NAMES = Object.keys(NODE_ICONS);

export function iconFor(name?: string | null): Icon {
  return (name && NODE_ICONS[name]) || NODE_ICONS[DEFAULT_ICON];
}

/** Renders a node type's icon by name. A static component so callers don't
 *  resolve a component during their own render (react-hooks/static-components). */
export function NodeTypeIcon({ name, ...props }: { name?: string | null } & SVGProps<SVGSVGElement>) {
  return createElement(iconFor(name), props);
}
