'use client';

import { TONE_COLOR, humanizeKey, type Tone } from '@/lib/definitions/choices';
import { useChoiceMeta } from './ChoiceContext';

/**
 * Lifecycle status pill (spec §8.7, restyled onto Canvas's `.pill`): label
 * and tone come from the definition's choices — passed explicitly (when the
 * field is known) or resolved from the choice context by value. No
 * hardcoded value→colour map.
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

  // One path for all six tones. `.pill`'s coloured variants are just
  // `color` + a 45%-mixed `border-color`, and TONE_COLOR already yields a
  // var(--token) per tone — so deriving both here covers every tone,
  // including `info`, which has no matching variant class. Mapping five
  // tones onto variant classes and special-casing the sixth is the kind of
  // exception that grows a hardcoded colour map; this cannot.
  const color = TONE_COLOR[t];

  return (
    <span
      className="pill"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      {text}
    </span>
  );
}
