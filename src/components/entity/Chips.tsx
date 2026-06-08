'use client';

import { TONE_COLOR, humanizeKey, type Tone } from '@/lib/definitions/choices';
import { useChoiceMeta } from './ChoiceContext';

/**
 * Lifecycle status pill (spec §8.7): a 6px dot + mono text in the semantic hue.
 * Label and tone come from the definition's choices — passed explicitly (when
 * the field is known) or resolved from the choice context by value. No hardcoded
 * value→colour map.
 */
export default function Chip({
  value,
  tone,
  label,
}: {
  value: string;
  tone?: Tone;
  label?: string;
}) {
  const meta = useChoiceMeta();
  const fromCtx = meta[value];
  const t: Tone = tone ?? fromCtx?.tone ?? 'neutral';
  const text = label ?? fromCtx?.label ?? humanizeKey(value);
  const color = TONE_COLOR[t];

  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {text}
    </span>
  );
}
