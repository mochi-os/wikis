import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from '@tanstack/react-router'
import { cn, ImageLightbox, type LightboxMedia, useLightboxHash } from '@mochi/common'
import { getApiBasepath } from '@mochi/common'

// Check if URL is an attachment URL
function isAttachmentUrl(url: string): boolean {
  return url.startsWith('attachments/') ||
         url.startsWith('-/attachments/') ||
         url.includes('/-/attachments/')
}

// Convert attachment URLs to absolute URLs for the current wiki
function resolveAttachmentUrl(url: string): string {
  // Handle relative attachments/id format (preferred)
  if (url.startsWith('attachments/')) {
    return `${getApiBasepath()}${url}`
  }
  // Handle legacy -/attachments/id format
  if (url.startsWith('-/attachments/')) {
    return `${getApiBasepath()}${url.slice(2)}` // Remove leading "-/"
  }
  // Handle absolute URLs from any wiki - extract attachment ID and optional suffix
  const match = url.match(/\/-\/attachments\/([^/?#]+)(\/thumbnail)?/)
  if (match) {
    return `${getApiBasepath()}attachments/${match[1]}${match[2] || ''}`
  }
  return url
}

// Get full-size URL for an attachment (removes /thumbnail suffix)
function getFullSizeUrl(url: string): string {
  const resolved = resolveAttachmentUrl(url)
  return resolved.replace(/\/thumbnail$/, '')
}

// Extract image URLs from markdown content before rendering
function extractImageUrls(content: string): string[] {
  const urls: string[] = []
  // Match markdown image syntax: ![alt](url)
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    urls.push(match[1])
  }
  return urls
}

interface MarkdownContentProps {
  content: string
  className?: string
  missingLinks?: string[]
}

export function MarkdownContent({ content, className, missingLinks = [] }: MarkdownContentProps) {
  // Pre-extract images from markdown content and build lightbox media array
  // This follows the same pattern as the feeds app PostAttachments component
  const lightboxMedia = useMemo<LightboxMedia[]>(() => {
    const urls = extractImageUrls(content)
    return urls.map((url, i) => ({
      id: String(i),
      name: url.split('/').pop() || 'Image',
      url: getFullSizeUrl(url),
      type: 'image' as const,
    }))
  }, [content])

  // Build a map from resolved src URL to lightbox index for fast lookup
  const srcToIndex = useMemo(() => {
    const map = new Map<string, number>()
    const urls = extractImageUrls(content)
    urls.forEach((url, i) => {
      map.set(resolveAttachmentUrl(url), i)
    })
    return map
  }, [content])

  // Use hash-based lightbox state for shareable URLs and back button support
  const { open, currentIndex, openLightbox, closeLightbox, setCurrentIndex } =
    useLightboxHash(lightboxMedia)

  return (
    <>
      <div
        className={cn(
          'prose prose-neutral dark:prose-invert max-w-none',
          // Headings
          'prose-headings:scroll-mt-20',
          // Links - use foreground color with underline for visibility
          'prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-muted-foreground',
          // Code
          'prose-code:before:content-none prose-code:after:content-none',
          'prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5',
          // Pre (code blocks)
          'prose-pre:bg-muted prose-pre:text-foreground prose-pre:border',
          '[&_pre_code]:p-0 [&_pre_code]:bg-transparent',
          // Tables
          'prose-table:border prose-th:border prose-td:border',
          'prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2',
          className
        )}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Handle images - resolve attachment URLs and open in lightbox
            img: ({ src, alt, node: _, ...props }) => {
              const resolvedSrc = src ? resolveAttachmentUrl(src) : src
              const index = resolvedSrc ? srcToIndex.get(resolvedSrc) : undefined

              if (index !== undefined) {
                return (
                  <button
                    type="button"
                    onClick={() => openLightbox(index)}
                    className="cursor-pointer border-0 bg-transparent p-0"
                  >
                    <img
                      src={resolvedSrc}
                      alt={alt}
                      className="m-0"
                    />
                  </button>
                )
              }

              return (
                <img src={resolvedSrc} alt={alt} {...props} />
              )
            },
            // Convert internal wiki links to router links
            a: ({ href, children, target: _, node: _node, ...props }) => {
              // Attachment links - resolve URL and render as regular links
              if (href && isAttachmentUrl(href)) {
                const resolvedHref = resolveAttachmentUrl(href)
                return (
                  <a href={resolvedHref} {...props}>
                    {children}
                  </a>
                )
              }
              // Check if it's an internal wiki link (relative or absolute)
              const isExternal = href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))
              if (href && !isExternal) {
                // Relative wiki page link - prefix with ../ to make it a sibling page
                // e.g., on /wiki/abc/home, link to "page-2" becomes "../page-2" -> /wiki/abc/page-2
                const siblingHref = href.startsWith('/') || href.startsWith('../') ? href : `../${href}`
                // Check if this is a link to a non-existent page (Wikipedia-style "red link")
                const cleanHref = href.split('#')[0].split('?')[0] // Remove anchors and query strings
                const isMissing = missingLinks.includes(cleanHref)
                return (
                  <Link
                    to={siblingHref}
                    {...props}
                    className={isMissing ? '!text-red-600 dark:!text-red-400' : undefined}
                  >
                    {children}
                  </Link>
                )
              }
              // External link - open in same tab
              return (
                <a href={href} {...props}>
                  {children}
                </a>
              )
            },
          }}
        >
          {content}
        </Markdown>
      </div>

      <ImageLightbox
        images={lightboxMedia}
        currentIndex={currentIndex}
        open={open}
        onOpenChange={(isOpen) => !isOpen && closeLightbox()}
        onIndexChange={setCurrentIndex}
      />
    </>
  )
}
