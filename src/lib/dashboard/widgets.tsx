import type { WidgetType } from './types';

export interface WidgetMeta {
  type: WidgetType;
  title: string;
  description: string;
  category: 'number' | 'table' | 'chart' | 'preset' | 'content';
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  needsSource: boolean; // false for risk-matrix (fixed source) and note
  needsData: boolean; // false for note
}

/** The widget catalog. Adding a presentation type = one entry + a body renderer. */
export const WIDGETS: WidgetMeta[] = [
  { type: 'kpi', title: 'Single number', description: 'A KPI: a count, or an aggregate of one numeric field.', category: 'number', defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, needsSource: true, needsData: true },
  { type: 'table', title: 'Table', description: 'Rows from a source with the columns you choose.', category: 'table', defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'donut', title: 'Donut', description: 'Share of a measure across a category.', category: 'chart', defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'bar', title: 'Bar', description: 'A measure grouped by a category.', category: 'chart', defaultSize: { w: 5, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'stacked-bar', title: 'Stacked bar', description: 'A measure by category, split into a series.', category: 'chart', defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'line', title: 'Line', description: 'A measure over time.', category: 'chart', defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, needsSource: true, needsData: true },
  { type: 'risk-matrix', title: 'Risk matrix', description: 'Likelihood × impact grid of risks.', category: 'preset', defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 }, needsSource: false, needsData: true },
  { type: 'note', title: 'Note', description: 'A free-text note (markdown).', category: 'content', defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, needsSource: false, needsData: false },
];

export const WIDGET_BY_TYPE: Record<WidgetType, WidgetMeta> = Object.fromEntries(
  WIDGETS.map((w) => [w.type, w]),
) as Record<WidgetType, WidgetMeta>;
