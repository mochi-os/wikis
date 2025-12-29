import { useState, useRef, useEffect } from 'react'
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

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  // Collect images during render for the lightbox gallery
  const [images, setImages] = useState<LightboxMedia[]>([])
  const imagesRef = useRef<LightboxMedia[]>([])
  const imageIndexRef = useRef(0)

  // Use hash-based lightbox state for shareable URLs and back button support
  const { open, currentIndex, openLightbox, closeLightbox, setCurrentIndex } =
    useLightboxHash(images)

  // Reset image collection when content changes
  useEffect(() => {
    imagesRef.current = []
    imageIndexRef.current = 0
  }, [content])

  // Sync collected images to state after render
  useEffect(() => {
    if (imagesRef.current.length > 0 && imagesRef.current.length !== images.length) {
      setImages([...imagesRef.current])
    }
  })

  // Reset index counter before each render
  imageIndexRef.current = 0

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
            img: ({ src, alt, ...props }) => {
              const resolvedSrc = src ? resolveAttachmentUrl(src) : src
              const fullSizeUrl = src ? getFullSizeUrl(src) : src

              // Register image and get its index for lightbox
              const index = imageIndexRef.current++
              if (fullSizeUrl && imagesRef.current.length <= index) {
                imagesRef.current.push({
                  id: String(index),
                  name: alt || 'Image',
                  url: fullSizeUrl,
                  type: 'image',
                })
              }

              return (
                <img
                  src={resolvedSrc}
                  alt={alt}
                  {...props}
                  className="cursor-pointer"
                  onClick={() => openLightbox(index)}
                />
              )
            },
            // Convert internal wiki links to router links
            a: ({ href, children, target: _, ...props }) => {
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
                // Relative wiki page link - convert to absolute path
                const absoluteHref = href.startsWith('/') ? href : `/${href}`
                return (
                  <Link to={absoluteHref} {...props}>
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
        images={images}
        currentIndex={currentIndex}
        open={open}
        onOpenChange={(isOpen) => !isOpen && closeLightbox()}
        onIndexChange={setCurrentIndex}
      />
    </>
  )
}
