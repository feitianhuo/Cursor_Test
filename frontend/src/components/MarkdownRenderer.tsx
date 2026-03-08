import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

export const MarkdownRenderer = ({ content, isUser }: MarkdownRendererProps) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isUser) {
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const codeString = String(children).replace(/\n$/, "");
          
          if (!inline && match) {
            return (
              <div className="group relative my-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-900 shadow-sm">
                <div className="flex items-center justify-between bg-gray-800/50 px-4 py-1.5">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {match[1]}
                  </span>
                  <button
                    onClick={() => handleCopy(codeString)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCode === codeString ? (
                      <Check size={12} className="text-green-500" />
                    ) : (
                      <Copy size={12} />
                    )}
                    {copiedCode === codeString ? "已复制" : "复制"}
                  </button>
                </div>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                    background: "transparent",
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code
              className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-medium text-pink-600"
              {...props}
            >
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-4 list-disc pl-6 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-4 list-decimal pl-6 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-3 text-xl font-bold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 text-lg font-bold">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-4 border-gray-200 pl-4 italic text-gray-600">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-gray-50 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="px-4 py-2 text-sm text-gray-700">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
