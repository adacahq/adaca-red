import HeadlineMetrics from '@/components/canvas/HeadlineMetrics';
import RichTextView from '@/components/rich-text/RichTextView';
import type { LandingBlock } from '@/lib/supabase/types';

/**
 * Structured landing-page blocks for public forms (docs/workflow-forms-plan.md
 * §7 · Part A). A small code registry keyed by `block.type` — config chooses
 * which blocks appear and what they say; unknown types render nothing
 * (forward-compat). Shared/sync, same idiom as RichTextView — safe in server
 * trees. Canvas idiom throughout: `.stats`/`.slates` figures, `.dive`/`.dstop`
 * numbered steps, `.mstones`/`.ms` listed rows — radius scale, `.card`
 * surfaces and shadows are all in play now; colour goes inline via
 * var(--token), layout via Tailwind.
 */

const VERDICT_ORDER = ['green', 'amber', 'red'] as const;
const VERDICT_TONE: Record<(typeof VERDICT_ORDER)[number], string> = {
  green: 'var(--ok)',
  amber: 'var(--warn)',
  red: 'var(--crit)',
};
const VERDICT_LABEL: Record<(typeof VERDICT_ORDER)[number], string> = {
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
};
/** Verdict key → `.rag` modifier class. */
const RAG_CLASS: Record<(typeof VERDICT_ORDER)[number], string> = { green: 'g', amber: 'a', red: 'r' };

export default function LandingBlocks({
  blocks,
  thresholds,
}: {
  blocks: LandingBlock[];
  thresholds?: { green: number; amber: number } | null;
}) {
  return (
    <div className="flex flex-col gap-8 mb-10">
      {blocks.map((block, i) => (
        <Block key={i} block={block} thresholds={thresholds} />
      ))}
    </div>
  );
}

function Block({
  block,
  thresholds,
}: {
  block: LandingBlock;
  thresholds?: { green: number; amber: number } | null;
}) {
  switch (block.type) {
    case 'prose':
      return <RichTextView value={block.markdown} />;
    case 'verdictLegend':
      return <VerdictLegend items={block.items} thresholds={thresholds} />;
    case 'steps':
      return <Steps items={block.items} />;
    case 'stats':
      return <Stats items={block.items} />;
    default:
      return null;
  }
}

/** Short, plain wording derived from the live verdict thresholds (fractions
 *  0–1, rendered as percentages) when a tile has no explicit description. */
function verdictFallback(key: (typeof VERDICT_ORDER)[number], thresholds: { green: number; amber: number }): string {
  const green = Math.round(thresholds.green * 100);
  const amber = Math.round(thresholds.amber * 100);
  if (key === 'green') return `Coverage at ${green}% or above.`;
  if (key === 'amber') return `Between ${amber}% and ${green}%.`;
  return `Below ${amber}%.`;
}

function VerdictLegend({
  items,
  thresholds,
}: {
  items?: { key: 'green' | 'amber' | 'red'; label?: string; description?: string }[];
  thresholds?: { green: number; amber: number } | null;
}) {
  const byKey = new Map((items ?? []).map((it) => [it.key, it]));
  return (
    <div className="mstones">
      {VERDICT_ORDER.map((key) => {
        const item = byKey.get(key);
        const description = item?.description || (thresholds ? verdictFallback(key, thresholds) : undefined);
        return (
          <div key={key} className="ms">
            <span className="id">
              <span aria-hidden className={`rag ${RAG_CLASS[key]}`} />
            </span>
            <span className="nm">
              <span style={{ color: VERDICT_TONE[key] }}>{item?.label || VERDICT_LABEL[key]}</span>
              {description && <small>{description}</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Steps({ items }: { items: { label: string; description?: string }[] }) {
  return (
    <ol className="dive" style={{ listStyleType: 'none' }}>
      {items.map((item, i) => (
        <li key={i} className="dstop">
          <p className="dd">Step {String(i + 1).padStart(2, '0')}</p>
          <h3>{item.label}</h3>
          {item.description && <p>{item.description}</p>}
        </li>
      ))}
    </ol>
  );
}

function Stats({ items }: { items: { value: string; label: string }[] }) {
  return <HeadlineMetrics metrics={items} />;
}
