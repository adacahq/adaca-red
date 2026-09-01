import { strFromU8, unzipSync } from 'fflate';

/**
 * Pure OOXML (zip-based Office) helpers — magic-byte/zip-entry sniffing plus
 * text extraction for the dormant PPTX/XLSX upload kinds
 * (docs/workflow-forms-plan.md). No Supabase, no fs — safe for vitest and the
 * Workers runtime alike. XML is read with regex, not a parser dep, matching
 * the sniff-by-magic-bytes spirit of `sniffContainer` in `forms/config.ts`.
 */

/** Caps a pathological spreadsheet/deck from exploding the LLM request payload. */
const MAX_CHARS = 400_000;

/** Aggregate uncompressed-size BUDGET per extraction call, checked via
 *  fflate's filter callback BEFORE decompression (`UnzipFileInfo.originalSize`).
 *  A per-entry-only cap is not enough: deflate can legally inflate ~1000:1,
 *  and several entries each individually under a per-entry cap still sum to
 *  a memory spike once `unzipSync` decompresses all of them into its result
 *  object at once (confirmed: 6 entries at 24 MB uncompressed each, a 138 KB
 *  upload, ~700 MB RSS). This budget is spent first-fit in central-directory
 *  order — an entry is accepted only if it still fits what's left, so it also
 *  caps any single entry at MAX_TOTAL_ENTRY_BYTES, making a separate
 *  per-entry constant redundant. 16 MB leaves headroom under the 128 MB
 *  Workers ceiling once you account for the UTF-16 JS string copies
 *  (`strFromU8`, the regex matches, the joined output) on top of the raw
 *  decompressed bytes, and is far more XML than the 400k-char MAX_CHARS
 *  output cap could ever use anyway — MAX_CHARS runs AFTER decompression, so
 *  it protects nothing on its own. Entries skipped for budget are silently
 *  omitted, not an error, so one absurd slide/sheet (or a pile of them)
 *  doesn't blank the rest of a legitimate file. */
const MAX_TOTAL_ENTRY_BYTES = 16_000_000;

function cap(text: string): string {
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n[truncated]` : text;
}

/** Decode the XML entities OOXML text runs actually use. Numeric entities are
 *  decoded before the named ones so a literal "&amp;lt;" round-trips to
 *  "&lt;" rather than "<"; `&amp;` itself is decoded last for the same reason. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** All top-level occurrences of `<tag ...>…</tag>` in one XML fragment (no
 *  nesting awareness — fine for the flat runs/paragraphs OOXML actually emits). */
function matchAllTagContents(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1]);
}

/** A single attribute value off every occurrence of `<tag ...>` in an XML fragment. */
function matchAllAttr(xml: string, tag: string, attr: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1]);
}

const OOXML_MARKERS: Record<string, 'docx' | 'pptx' | 'xlsx'> = {
  'word/document.xml': 'docx',
  'ppt/presentation.xml': 'pptx',
  'xl/workbook.xml': 'xlsx',
};

/** Classify a zip container by its marker entry — never trust the filename or
 *  declared content-type. Reads entry NAMES only: the filter callback runs
 *  before decompression, so always returning false means nothing is ever
 *  inflated at sniff/submit time (a zip bomb can't cost more than parsing the
 *  central directory). Corrupt/non-zip data resolves to null, same as an
 *  unrecognised file today. */
export function sniffOoxmlKind(bytes: Uint8Array): 'docx' | 'pptx' | 'xlsx' | null {
  const found = new Set<string>();
  try {
    unzipSync(bytes, {
      filter: (f) => {
        if (f.name in OOXML_MARKERS) found.add(f.name);
        return false;
      },
    });
  } catch {
    // Not a zip, or a corrupt one — falls through to null below.
  }
  for (const [name, kind] of Object.entries(OOXML_MARKERS)) {
    if (found.has(name)) return kind;
  }
  return null;
}

function slideNumber(name: string): number {
  const m = /slide(\d+)\.xml$/.exec(name);
  return m ? parseInt(m[1], 10) : 0;
}

/** PPTX → plain text: every `<a:t>` run per `<a:p>` paragraph, slide by slide,
 *  slides ordered numerically (slide10 after slide9, not after slide1). */
export function extractPptxText(bytes: Uint8Array): string {
  let entries: Record<string, Uint8Array>;
  try {
    let budget = MAX_TOTAL_ENTRY_BYTES;
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (!/^ppt\/slides\/slide\d+\.xml$/.test(f.name) || f.originalSize > budget) return false;
        budget -= f.originalSize;
        return true;
      },
    });
  } catch {
    return '';
  }

  const slideFiles = Object.keys(entries).sort((a, b) => slideNumber(a) - slideNumber(b));
  const lines: string[] = [];
  for (const name of slideFiles) {
    lines.push(`Slide ${slideNumber(name)}:`);
    const xml = strFromU8(entries[name]);
    for (const para of matchAllTagContents(xml, 'a:p')) {
      const text = matchAllTagContents(para, 'a:t').map(decodeXmlEntities).join('');
      if (text) lines.push(text);
    }
  }
  return cap(lines.join('\n'));
}

function sheetFileNumber(name: string): number {
  const m = /sheet(\d+)\.xml$/.exec(name);
  return m ? parseInt(m[1], 10) : 0;
}

/** XLSX → plain text: sheet names, then every shared string (including
 *  multi-run rich text) and inline string, in sheet order. Numeric cell
 *  values are skipped — governance evidence is text. */
export function extractXlsxText(bytes: Uint8Array): string {
  let entries: Record<string, Uint8Array>;
  try {
    let budget = MAX_TOTAL_ENTRY_BYTES;
    entries = unzipSync(bytes, {
      filter: (f) => {
        const matches =
          f.name === 'xl/workbook.xml' ||
          f.name === 'xl/sharedStrings.xml' ||
          /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name);
        if (!matches || f.originalSize > budget) return false;
        budget -= f.originalSize;
        return true;
      },
    });
  } catch {
    return '';
  }

  const lines: string[] = [];

  if (entries['xl/workbook.xml']) {
    const names = matchAllAttr(strFromU8(entries['xl/workbook.xml']), 'sheet', 'name').map(decodeXmlEntities);
    if (names.length > 0) lines.push(`Sheets: ${names.join(', ')}`);
  }

  if (entries['xl/sharedStrings.xml']) {
    const xml = strFromU8(entries['xl/sharedStrings.xml']);
    for (const si of matchAllTagContents(xml, 'si')) {
      const text = matchAllTagContents(si, 't').map(decodeXmlEntities).join('');
      if (text) lines.push(text);
    }
  }

  const sheetFiles = Object.keys(entries)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => sheetFileNumber(a) - sheetFileNumber(b));
  for (const name of sheetFiles) {
    const xml = strFromU8(entries[name]);
    for (const is of matchAllTagContents(xml, 'is')) {
      const text = matchAllTagContents(is, 't').map(decodeXmlEntities).join('');
      if (text) lines.push(text);
    }
  }

  return cap(lines.join('\n'));
}
