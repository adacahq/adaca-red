import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractPptxText, extractXlsxText, sniffOoxmlKind } from './ooxml';

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function fakeDocx(): Uint8Array {
  return zipSync({
    '[Content_Types].xml': utf8('<Types/>'),
    'word/document.xml': utf8('<w:document><w:body><w:p><w:r><w:t>Hi</w:t></w:r></w:p></w:body></w:document>'),
  });
}

function fakePptx(slides: Record<string, string>): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': utf8('<Types/>'),
    'ppt/presentation.xml': utf8('<p:presentation/>'),
  };
  for (const [name, xml] of Object.entries(slides)) files[`ppt/slides/${name}`] = utf8(xml);
  return zipSync(files);
}

function fakeXlsx(opts: { workbook?: string; sharedStrings?: string; sheets?: Record<string, string> }): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': utf8('<Types/>'),
    'xl/workbook.xml': utf8(opts.workbook ?? '<workbook><sheets/></workbook>'),
  };
  if (opts.sharedStrings) files['xl/sharedStrings.xml'] = utf8(opts.sharedStrings);
  for (const [name, xml] of Object.entries(opts.sheets ?? {})) files[`xl/worksheets/${name}`] = utf8(xml);
  return zipSync(files);
}

describe('sniffOoxmlKind', () => {
  it('classifies docx by word/document.xml', () => {
    expect(sniffOoxmlKind(fakeDocx())).toBe('docx');
  });

  it('classifies pptx by ppt/presentation.xml', () => {
    expect(sniffOoxmlKind(fakePptx({ 'slide1.xml': '<p:sld/>' }))).toBe('pptx');
  });

  it('classifies xlsx by xl/workbook.xml', () => {
    expect(sniffOoxmlKind(fakeXlsx({}))).toBe('xlsx');
  });

  it('returns null for a zip with none of the marker entries', () => {
    const bytes = zipSync({ 'readme.txt': utf8('hello') });
    expect(sniffOoxmlKind(bytes)).toBeNull();
  });

  it('returns null for corrupt/non-zip bytes', () => {
    expect(sniffOoxmlKind(new Uint8Array([0x01, 0x02, 0x03, 0x04]))).toBeNull();
    expect(sniffOoxmlKind(new Uint8Array([]))).toBeNull();
  });

  it('classifies correctly even when the marker entry is far larger than the extractors’ zip-bomb budget — sniffing reads entry names off the central directory and never decompresses, so size never matters', () => {
    // 30 MB uncompressed (deflates to almost nothing) — bigger than
    // extractPptxText/extractXlsxText's whole MAX_TOTAL_ENTRY_BYTES budget,
    // which WOULD skip an entry this size. Sniffing still succeeds because it
    // collects names as a filter side effect and always returns false, so
    // nothing is ever inflated.
    const bytes = zipSync({ 'word/document.xml': utf8('A'.repeat(30_000_000)) });
    expect(sniffOoxmlKind(bytes)).toBe('docx');
  });
});

describe('extractPptxText', () => {
  it('extracts runs per paragraph, prefixed by slide number', () => {
    const bytes = fakePptx({
      'slide1.xml': '<p:sld><p:txBody><a:p><a:r><a:t>Hello </a:t></a:r><a:r><a:t>world</a:t></a:r></a:p></p:txBody></p:sld>',
    });
    const text = extractPptxText(bytes);
    expect(text).toBe('Slide 1:\nHello world');
  });

  it('orders slides numerically, not lexicographically (slide10 after slide9)', () => {
    const bytes = fakePptx({
      'slide1.xml': '<a:p><a:r><a:t>one</a:t></a:r></a:p>',
      'slide9.xml': '<a:p><a:r><a:t>nine</a:t></a:r></a:p>',
      'slide10.xml': '<a:p><a:r><a:t>ten</a:t></a:r></a:p>',
      'slide2.xml': '<a:p><a:r><a:t>two</a:t></a:r></a:p>',
    });
    const text = extractPptxText(bytes);
    expect(text).toBe('Slide 1:\none\nSlide 2:\ntwo\nSlide 9:\nnine\nSlide 10:\nten');
  });

  it('decodes named and numeric XML entities', () => {
    const bytes = fakePptx({
      'slide1.xml': '<a:p><a:r><a:t>AT&amp;T &lt;co&gt; &#169; &#x2019;</a:t></a:r></a:p>',
    });
    expect(extractPptxText(bytes)).toBe('Slide 1:\nAT&T <co> © ’');
  });

  it('truncates at 400,000 chars', () => {
    const big = 'x'.repeat(400_010);
    const bytes = fakePptx({ 'slide1.xml': `<a:p><a:r><a:t>${big}</a:t></a:r></a:p>` });
    const text = extractPptxText(bytes);
    expect(text.endsWith('\n[truncated]')).toBe(true);
    expect(text.length).toBe(400_000 + '\n[truncated]'.length);
  });

  it('returns empty string for corrupt zip bytes', () => {
    expect(extractPptxText(new Uint8Array([0x00, 0x01]))).toBe('');
  });

  it('skips a slide entry over the zip-bomb budget, leaving a normal sibling slide intact', () => {
    // 26 MB uncompressed (deflates to almost nothing, fast to build) — over
    // the whole MAX_TOTAL_ENTRY_BYTES budget on its own, so this entry must
    // never reach the paragraph regex.
    const oversized = `<a:p><a:r><a:t>${'x'.repeat(26_000_000)}</a:t></a:r></a:p>`;
    const bytes = fakePptx({
      'slide1.xml': oversized,
      'slide2.xml': '<a:p><a:r><a:t>small</a:t></a:r></a:p>',
    });
    expect(extractPptxText(bytes)).toBe('Slide 2:\nsmall');
  });

  it('enforces an AGGREGATE budget, not just a per-entry one: several slides each well under any single-entry threshold still get cut off once their sum exceeds the budget (the verifier-reported gap — 6 entries at 24 MB uncompressed each, individually under the old per-entry cap, summed to a ~700 MB decompression spike)', () => {
    // Six ~5 MB entries (padding lives in an XML comment BEFORE <a:p>, so it
    // is never matched by the text-extraction regex — only the tiny <a:t>
    // label is, keeping the assertion legible regardless of how many entries
    // the budget admits). Total padded size ~30 MB against a 16 MB budget:
    // first-fit admits exactly 3 (5,000,0xx * 3 ≈ 15 MB) before the 4th no
    // longer fits the ~1 MB left over.
    const pad = 'p'.repeat(5_000_000);
    const labels = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
    const slides: Record<string, string> = {};
    labels.forEach((label, i) => {
      slides[`slide${i + 1}.xml`] = `<!--${pad}--><a:p><a:r><a:t>${label}</a:t></a:r></a:p>`;
    });
    const bytes = fakePptx(slides);

    const start = Date.now();
    const text = extractPptxText(bytes);
    const elapsedMs = Date.now() - start;

    expect(text).toBe('Slide 1:\nalpha\nSlide 2:\nbeta\nSlide 3:\ngamma');
    expect(text).not.toContain('delta');
    expect(text).not.toContain('epsilon');
    expect(text).not.toContain('zeta');
    expect(elapsedMs).toBeLessThan(2000);
  });
});

describe('extractXlsxText', () => {
  it('lists sheet names, shared strings (incl. multi-run rich text and preserved space), then inline strings', () => {
    const bytes = fakeXlsx({
      workbook: '<workbook><sheets><sheet name="Overview" sheetId="1"/><sheet name="Controls" sheetId="2"/></sheets></workbook>',
      sharedStrings:
        '<sst><si><t>Hello</t></si>' +
        '<si><t xml:space="preserve"> World </t></si>' +
        '<si><r><t>Rich</t></r><r><t> Text</t></r></si></sst>',
      sheets: {
        'sheet1.xml': '<worksheet><sheetData><row><c><is><t>Inline value</t></is></c></row></sheetData></worksheet>',
      },
    });
    const text = extractXlsxText(bytes);
    expect(text).toBe('Sheets: Overview, Controls\nHello\n World \nRich Text\nInline value');
  });

  it('decodes entities in sheet names and strings', () => {
    const bytes = fakeXlsx({
      workbook: '<workbook><sheets><sheet name="R&amp;D"/></sheets></workbook>',
      sharedStrings: '<sst><si><t>A &lt; B</t></si></sst>',
    });
    expect(extractXlsxText(bytes)).toBe('Sheets: R&D\nA < B');
  });

  it('orders worksheet files numerically', () => {
    const bytes = fakeXlsx({
      sheets: {
        'sheet9.xml': '<worksheet><is><t>nine</t></is></worksheet>',
        'sheet10.xml': '<worksheet><is><t>ten</t></is></worksheet>',
      },
    });
    expect(extractXlsxText(bytes)).toBe('nine\nten');
  });

  it('truncates at 400,000 chars', () => {
    const big = 'y'.repeat(400_010);
    const bytes = fakeXlsx({ sharedStrings: `<sst><si><t>${big}</t></si></sst>` });
    const text = extractXlsxText(bytes);
    expect(text.endsWith('\n[truncated]')).toBe(true);
    expect(text.length).toBe(400_000 + '\n[truncated]'.length);
  });

  it('returns empty string for corrupt zip bytes', () => {
    expect(extractXlsxText(new Uint8Array([0x00, 0x01]))).toBe('');
  });

  it('skips an oversized shared-strings entry over the zip-bomb budget, leaving sheet names intact', () => {
    // 26 MB uncompressed — over the whole MAX_TOTAL_ENTRY_BYTES budget on its
    // own, so this entry must never reach the <si>/<t> regex; workbook.xml is
    // small and unaffected.
    const oversized = `<sst><si><t>${'y'.repeat(26_000_000)}</t></si></sst>`;
    const bytes = fakeXlsx({
      workbook: '<workbook><sheets><sheet name="Overview"/></sheets></workbook>',
      sharedStrings: oversized,
    });
    expect(extractXlsxText(bytes)).toBe('Sheets: Overview');
  });

  it('enforces an aggregate budget across worksheet entries: several sheets each well under any single-entry threshold still get cut off once their sum exceeds the budget', () => {
    // Same shape as the pptx aggregate-budget test: padding lives in an XML
    // comment outside <is>/<t>, so only the tiny label is ever extracted.
    const pad = 'p'.repeat(5_000_000);
    const labels = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
    const sheets: Record<string, string> = {};
    labels.forEach((label, i) => {
      sheets[`sheet${i + 1}.xml`] = `<!--${pad}--><worksheet><is><t>${label}</t></is></worksheet>`;
    });
    const bytes = fakeXlsx({ sheets });

    const start = Date.now();
    const text = extractXlsxText(bytes);
    const elapsedMs = Date.now() - start;

    expect(text).toBe('alpha\nbeta\ngamma');
    expect(text).not.toContain('delta');
    expect(text).not.toContain('epsilon');
    expect(text).not.toContain('zeta');
    expect(elapsedMs).toBeLessThan(2000);
  });
});
