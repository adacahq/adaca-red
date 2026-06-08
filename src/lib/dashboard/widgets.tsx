import type { ComponentType, SVGProps } from 'react';
import {
  HashtagIcon,
  TableCellsIcon,
  ChartPieIcon,
  ChartBarIcon,
  ChartBarSquareIcon,
  PresentationChartLineIcon,
  Squares2X2Icon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import type { WidgetType } from './types';

export interface WidgetMeta {
  type: WidgetType;
  title: string;
  description: string;
  category: 'number' | 'table' | 'chart' | 'preset' | 'content';
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  needsSource: boolean; // false for risk-matrix (fixed source) and note
  needsData: boolean; // false for note
}

/** The widget catalog. Adding a presentation type = one entry + a body renderer. */
export const WIDGETS: WidgetMeta[] = [
  { type: 'kpi', title: 'Single number', description: 'A KPI: a count, or an aggregate of one numeric field.', category: 'number', icon: HashtagIcon, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, needsSource: true, needsData: true },
  { type: 'table', title: 'Table', description: 'Rows from a source with the columns you choose.', category: 'table', icon: TableCellsIcon, defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'donut', title: 'Donut', description: 'Share of a measure across a category.', category: 'chart', icon: ChartPieIcon, defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'bar', title: 'Bar', description: 'A measure grouped by a category.', category: 'chart', icon: ChartBarIcon, defaultSize: { w: 5, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'stacked-bar', title: 'Stacked bar', description: 'A measure by category, split into a series.', category: 'chart', icon: ChartBarSquareIcon, defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'line', title: 'Line', description: 'A measure over time.', category: 'chart', icon: PresentationChartLineIcon, defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'risk-matrix', title: 'Risk matrix', description: 'Likelihood × impact grid of risks.', category: 'preset', icon: Squares2X2Icon, defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 }, needsSource: false, needsData: true },
  { type: 'note', title: 'Note', description: 'A free-text note (markdown).', category: 'content', icon: DocumentTextIcon, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, needsSource: false, needsData: false },
];

export const WIDGET_BY_TYPE: Record<WidgetType, WidgetMeta> = Object.fromEntries(
  WIDGETS.map((w) => [w.type, w]),
) as Record<WidgetType, WidgetMeta>;
