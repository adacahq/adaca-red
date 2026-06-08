import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Read-only render of stored Markdown, styled by the canvas prose styles. */
export default function RichTextView({ value }: { value?: string | null }) {
  if (!value) return <span style={{ color: 'var(--muted-2)' }}>–</span>;
  return (
    <div className="docs-prose" style={{ fontSize: 14 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
