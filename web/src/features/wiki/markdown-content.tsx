import {
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactNode,
  useEffect,
  useMemo,
} from 'react'
import { ExternalLink, Hash } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from '@tanstack/react-router'
import {
  CopyButton,
  cn,
  ImageLightbox,
  type LightboxMedia,
  useLightboxHash,
  isDomainEntityRouting,
  getApiBasepath,
} from '@mochi/web'
import {
  classifyWikiLink,
  extractTocHeadings,
  slugifyHeading,
  type TocHeading,
} from './markdown-content.utils'
function resolveAttachmentUrl(url: string): string {
  if (url.startsWith('attachments/')) {
    return `${getApiBasepath()}${url}`
  }
  if (url.startsWith('-/attachments/')) {
    return `${getApiBasepath()}${url.slice(2)}`
  }
  const match = url.match(/\/-\/attachments\/([^/?#]+)(\/thumbnail)?/)
  if (match) {
    return `${getApiBasepath()}attachments/${match[1]}${match[2] || ''}`
  }
  return url
}

function getFullSizeUrl(url: string): string {
  const resolved = resolveAttachmentUrl(url)
  return resolved.replace(/\/thumbnail$/, '')
}

function extractImageUrls(content: string): string[] {
  const urls: string[] = []
  const regex = /!\[[^\]]*\]\(([^)]+)\)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    urls.push(match[1])
  }
  return urls
}

function getNodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(getNodeText).join('')
  }
  if (isValidElement(node)) {
    return getNodeText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

interface MarkdownContentProps {
  content: string
  className?: string
  missingLinks?: string[]
  toc?: boolean
  onHeadingsChange?: (headings: TocHeading[]) => void
}

export function MarkdownContent({
  content,
  className,
  missingLinks = [],
  toc = false,
  onHeadingsChange,
}: MarkdownContentProps) {
  const headings = useMemo(() => extractTocHeadings(content), [content])
  const currentPathWithQuery =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : ''

  useEffect(() => {
    if (toc && onHeadingsChange) {
      onHeadingsChange(headings)
    }
  }, [toc, onHeadingsChange, headings])

  const lightboxMedia = useMemo<LightboxMedia[]>(() => {
    const urls = extractImageUrls(content)
    return urls.map((url, i) => ({
      id: String(i),
      name: url.split('/').pop() || 'Image',
      url: getFullSizeUrl(url),
      type: 'image' as const,
    }))
  }, [content])

  const srcToIndex = useMemo(() => {
    const map = new Map<string, number>()
    const urls = extractImageUrls(content)
    urls.forEach((url, i) => {
      map.set(resolveAttachmentUrl(url), i)
    })
    return map
  }, [content])

  const headingFallbackCounts = new Map<string, number>()
  let headingCursor = 0

  const resolveHeadingId = (level: 2 | 3 | 4, text: string) => {
    for (; headingCursor < headings.length; headingCursor += 1) {
      const candidate = headings[headingCursor]
      if (candidate.level === level) {
        headingCursor += 1
        return candidate.id
      }
    }

    const baseId = slugifyHeading(text)
    const nextCount = (headingFallbackCounts.get(baseId) ?? 0) + 1
    headingFallbackCounts.set(baseId, nextCount)
    return nextCount === 1 ? baseId : `${baseId}-${nextCount}`
  }

  const renderHeading =
    (level: 2 | 3 | 4, classes: string) =>
    ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => {
      const headingText = getNodeText(children).trim()
      const id = resolveHeadingId(level, headingText)
      const content = (
        <>
          <span>{children}</span>
          <a
            href={
              currentPathWithQuery
                ? `${currentPathWithQuery}#${id}`
                : `#${id}`
            }
            className='text-muted-foreground hover:text-foreground ml-2 inline-flex opacity-0 transition-opacity group-hover:opacity-100'
            aria-label={`Link to ${headingText}`}
          >
            <Hash className='size-3.5' />
          </a>
        </>
      )

      if (level === 2) {
        return (
          <h2 id={id} className={classes} {...props}>
            {content}
          </h2>
        )
      }

      if (level === 3) {
        return (
          <h3 id={id} className={classes} {...props}>
            {content}
          </h3>
        )
      }

      return (
        <h4 id={id} className={classes} {...props}>
          {content}
        </h4>
      )
    }

  const { open, currentIndex, openLightbox, closeLightbox, setCurrentIndex } =
    useLightboxHash(lightboxMedia)

  return (
    <>
      <div
        className={cn(
          'max-w-none text-foreground',
          '[&_p]:my-4 [&_p]:leading-7',
          '[&_h2]:scroll-mt-20 [&_h2]:font-semibold [&_h2]:tracking-tight',
          '[&_h3]:scroll-mt-20 [&_h3]:font-semibold [&_h3]:tracking-tight',
          '[&_h4]:scroll-mt-20 [&_h4]:font-semibold [&_h4]:tracking-tight',
          '[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl',
          '[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-xl',
          '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-lg',
          '[&_a]:text-primary [&_a]:decoration-primary/40 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary/85',
          '[&_ul]:my-4 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-6',
          '[&_ol]:my-4 [&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6',
          '[&_li]:my-1',
          '[&_code]:bg-surface-2 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]',
          '[&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:shadow-none',
          '[&_table]:border [&_th]:border [&_td]:border',
          '[&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2',
          className
        )}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: renderHeading(2, 'group flex items-center'),
            h3: renderHeading(3, 'group flex items-center'),
            h4: renderHeading(4, 'group flex items-center'),
            ul: ({ children, ...props }) => (
              <ul
                className='marker:text-muted-foreground my-4 space-y-1'
                {...props}
              >
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol
                className='marker:text-muted-foreground my-4 space-y-1'
                {...props}
              >
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className='pl-1' {...props}>
                {children}
              </li>
            ),
            img: ({ src, alt, node: _, ...props }) => {
              const resolvedSrc = src ? resolveAttachmentUrl(src) : src
              const index = resolvedSrc
                ? srcToIndex.get(resolvedSrc)
                : undefined

              if (index !== undefined) {
                return (
                  <button
                    type='button'
                    onClick={() => openLightbox(index)}
                    className='cursor-pointer border-0 bg-transparent p-0'
                  >
                    <img src={resolvedSrc} alt={alt} className='m-0' />
                  </button>
                )
              }

              return <img src={resolvedSrc} alt={alt} {...props} />
            },
            pre: ({ children }) => {
              const codeElement = Array.isArray(children)
                ? children[0]
                : children
              const codeClass = isValidElement(codeElement)
                ? String(
                    (codeElement.props as { className?: string }).className ??
                      ''
                  )
                : ''
              const language =
                codeClass.match(/language-([\w-]+)/i)?.[1] ?? 'text'
              const codeText = getNodeText(
                isValidElement(codeElement)
                  ? (codeElement.props as { children?: ReactNode }).children
                  : children
              ).replace(/\n$/, '')

              return (
                <div className='not-prose bg-surface-1 my-6 overflow-hidden rounded-xl border'>
                  <div className='bg-surface-2 flex items-center justify-between border-b px-3 py-1.5'>
                    <span className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
                      {language}
                    </span>
                    <CopyButton value={codeText} className='size-7' />
                  </div>
                  <pre className='m-0 overflow-x-auto bg-transparent px-4 py-3 text-[13px] leading-6'>
                    {children}
                  </pre>
                </div>
              )
            },
            code: ({ className, children, ...props }) => {
              const codeContent = getNodeText(children)
              const isBlockCode =
                className?.includes('language-') || codeContent.includes('\n')

              if (!isBlockCode) {
                return (
                  <code
                    className={cn('bg-surface-2 rounded px-1.5 py-0.5', className)}
                    {...props}
                  >
                    {children}
                  </code>
                )
              }

              return (
                <code
                  className={cn(
                    'block min-w-max bg-transparent p-0 font-mono',
                    className
                  )}
                  {...props}
                >
                  {children}
                </code>
              )
            },
            a: ({
              href,
              children,
              target: _,
              node: _node,
              ref: _ref,
              ...props
            }) => {
              if (!href) {
                return <a {...props}>{children}</a>
              }

              const kind = classifyWikiLink(href)

              if (kind === 'attachment') {
                const resolvedHref = resolveAttachmentUrl(href)
                return (
                  <a href={resolvedHref} {...props}>
                    {children}
                  </a>
                )
              }
              const isExternal = href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))
              if (href && !isExternal) {
                // Relative wiki page link - convert to navigable path
                // Domain routing (e.g., docs.mochi-os.org): pages are at root, so use absolute /page
                // Normal routing (e.g., /wikis/abc/home): use ../page to stay within wiki context
                const siblingHref = href.startsWith('/') || href.startsWith('../') ? href
                  : isDomainEntityRouting() ? `/${href}` : `../${href}`
                // Check if this is a link to a non-existent page (Wikipedia-style "red link")
                const cleanHref = href.split('#')[0].split('?')[0] // Remove anchors and query strings
                const isMissing = missingLinks.includes(cleanHref)
                return (
                  <Link
                    to={siblingHref}
                    preload={false}
                    {...props}
                    className={cn(
                      'transition-colors',
                      isMissing && 'text-red-600! dark:text-red-400!'
                    )}
                  >
                    {children}
                  </Link>
                )
              }

              return (
                <a
                  href={href}
                  target='_blank'
                  rel='noopener noreferrer'
                  {...props}
                >
                  <span className='inline-flex items-center gap-1'>
                    {children}
                    <ExternalLink className='size-3.5 shrink-0' />
                  </span>
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
