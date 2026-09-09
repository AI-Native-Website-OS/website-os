import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Link from 'next/link';
import type { Components } from 'react-markdown';

const components: Components = {
  a: ({ href, children }) => {
    if (href?.startsWith('http')) {
      return <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800" onClick={e => e.stopPropagation()}>{children}</a>;
    }
    return <Link href={href || '#'} className="underline text-blue-600 hover:text-blue-800" onClick={e => e.stopPropagation()}>{children}</Link>;
  },
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return <code className="px-1 py-0.5 bg-gray-200 rounded text-xs" {...props}>{children}</code>;
    }
    return <pre className="p-3 bg-gray-800 text-gray-100 rounded-lg text-xs overflow-x-auto my-2"><code className={className} {...props}>{children}</code></pre>;
  },
  table: ({ children }) => <div className="overflow-x-auto my-3 rounded-lg border border-gray-200 shadow-sm"><table className="min-w-full text-xs border-collapse bg-white">{children}</table></div>,
  th: ({ children }) => <th className="px-3 py-2 bg-gray-50 text-gray-600 font-semibold text-left border-b border-gray-200">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-gray-700 border-b border-gray-100">{children}</td>,
  p: ({ children }) => <span className="block last:mb-0">{children}</span>,
};

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
