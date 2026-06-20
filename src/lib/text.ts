/** Naive English pluraliser for type labels (Milestone→Milestones,
 *  Dependency→Dependencies, Status report→Status reports). */
export function pluralize(label: string): string {
  if (/[^aeiou]y$/i.test(label)) return label.replace(/y$/i, 'ies');
  if (/(s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  return `${label}s`;
}
