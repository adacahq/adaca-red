'use client';

import { useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
  type LexicalNode,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import {
  ListNode,
  ListItemNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { CodeNode, CodeHighlightNode, $createCodeNode } from '@lexical/code';

function Tool({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      className="lexical-tool"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Link tool: a plain-React popover (no Headless UI) — closes on Escape, on
 *  an outside click, or once a link is applied/removed. */
function LinkButton() {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function apply() {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url || null);
    setUrl('');
    setOpen(false);
  }
  function unlink() {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="inline-flex" style={{ position: 'relative' }}>
      <button
        type="button"
        className="lexical-tool"
        title="Link"
        aria-label="Link"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        Link
      </button>
      {open && (
        <div
          className="flex items-center gap-2"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 80,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 8,
          }}
        >
          <input
            className="field-input"
            style={{ width: 200, fontSize: 13 }}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
            Apply
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={unlink}>
            Unlink
          </button>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <span className="lexical-div" aria-hidden />;
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const fmt = (f: 'bold' | 'italic' | 'strikethrough' | 'code') =>
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, f);
  const block = (create: () => LexicalNode) =>
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) $setBlocksType(sel, create);
    });

  return (
    <div className="lexical-toolbar">
      <Tool title="Paragraph" onClick={() => block(() => $createParagraphNode())}>P</Tool>
      <Tool title="Heading 1" onClick={() => block(() => $createHeadingNode('h1'))}>H1</Tool>
      <Tool title="Heading 2" onClick={() => block(() => $createHeadingNode('h2'))}>H2</Tool>
      <Tool title="Heading 3" onClick={() => block(() => $createHeadingNode('h3'))}>H3</Tool>
      <Divider />
      <Tool title="Bold" onClick={() => fmt('bold')}><b>B</b></Tool>
      <Tool title="Italic" onClick={() => fmt('italic')}><i>I</i></Tool>
      <Tool title="Strikethrough" onClick={() => fmt('strikethrough')}><s>S</s></Tool>
      <Tool title="Inline code" onClick={() => fmt('code')}>&lt;/&gt;</Tool>
      <Divider />
      <Tool title="Quote" onClick={() => block(() => $createQuoteNode())}>&ldquo;&rdquo;</Tool>
      <Tool title="Code block" onClick={() => block(() => $createCodeNode())}>{'{ }'}</Tool>
      <Tool title="Bullet list" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>&bull;</Tool>
      <Tool title="Numbered list" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>1.</Tool>
      <Divider />
      <LinkButton />
    </div>
  );
}

/** Seeds the editor from the initial markdown once on mount. */
function InitMarkdown({ markdown }: { markdown: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.update(() => {
      try {
        $convertFromMarkdownString(markdown ?? '', TRANSFORMERS);
      } catch {
        /* fall back to empty editor on malformed markdown */
      }
    });
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * Markdown-backed rich-text editor (decision #5): a full formatting toolbar
 * covering every supported markdown format, plus markdown shortcuts; stores and
 * emits Markdown. The single rich-text surface used everywhere (no plain
 * textareas).
 */
export default function RichText({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (markdown: string) => void;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'red',
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, CodeHighlightNode],
        theme: {},
        onError: (e: Error) => {
          console.error(e);
        },
      }}
    >
      <div className="lexical-wrap">
        <Toolbar />
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="lexical-editable"
              aria-placeholder="Write…"
              placeholder={null}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <ListPlugin />
      <LinkPlugin />
      <HistoryPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <OnChangePlugin
        onChange={(editorState) => {
          editorState.read(() => {
            try {
              onChange($convertToMarkdownString(TRANSFORMERS));
            } catch {
              /* ignore serialization hiccups */
            }
          });
        }}
      />
      <InitMarkdown markdown={value ?? ''} />
    </LexicalComposer>
  );
}
