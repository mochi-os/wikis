import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none',
        // Headings
        'prose-headings:scroll-mt-20',
        // Links
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // Code
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5',
        // Pre (code blocks)
        'prose-pre:bg-muted prose-pre:border',
        // Tables
        'prose-table:border prose-th:border prose-td:border',
        'prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2',
        className
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Convert internal wiki links to router links
          a: ({ href, children, ...props }) => {
            // Check if it's an internal wiki link (starts with / but not //)
            if (href && href.startsWith('/') && !href.startsWith('//')) {
              return (
                <Link to={href} {...props}>
                  {children}
                </Link>
              )
            }
            // External link - open in new tab
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
