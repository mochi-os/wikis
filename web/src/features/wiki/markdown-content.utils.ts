// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

type TocHeadingLevel = 2 | 3 | 4

export interface TocHeading {
  id: string
  text: string
  level: TocHeadingLevel
}

export type WikiLinkKind = 'attachment' | 'external' | 'internal'

const ATTACHMENT_PATTERNS = [
  /^attachments\//,
  /^-\/attachments\//,
  /\/-\/attachments\//,
]

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/
const HEADING_PATTERN = /^(#{2,4})\s+(.+?)\s*#*\s*$/

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .trim()
}

export function slugifyHeading(text: string): string {
  const normalized = stripInlineMarkdown(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')

  return normalized || 'section'
}

function getFenceToken(line: string): string | null {
  const match = line.match(FENCE_PATTERN)
  return match ? match[1] : null
}

function isFenceClose(line: string, openFence: string): boolean {
  const token = getFenceToken(line)
  return (
    !!token && token[0] === openFence[0] && token.length >= openFence.length
  )
}

export function extractTocHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = []
  const seen = new Map<string, number>()

  let openFence: string | null = null

  for (const line of content.split('\n')) {
    const fenceToken = getFenceToken(line)

    if (openFence) {
      if (fenceToken && isFenceClose(line, openFence)) {
        openFence = null
      }
      continue
    }

    if (fenceToken) {
      openFence = fenceToken
      continue
    }

    const match = line.match(HEADING_PATTERN)
    if (!match) {
      continue
    }

    const level = match[1].length as TocHeadingLevel
    const text = stripInlineMarkdown(match[2])
    if (!text) {
      continue
    }

    const baseId = slugifyHeading(text)
    const nextCount = (seen.get(baseId) ?? 0) + 1
    seen.set(baseId, nextCount)

    headings.push({
      id: nextCount === 1 ? baseId : `${baseId}-${nextCount}`,
      text,
      level,
    })
  }

  return headings
}

// The router path of a link to another page of the wiki. A page's links are
// written relative to the page, so they resolve against the page wherever it
// is shown: an old version, the editor's preview and a comment all sit at a
// deeper address, where the router would have read `changelog` as
// `<page>/history/changelog`. `wiki` is the wiki's path segment, or undefined
// where the wiki is the domain's root. A query or fragment is kept as written.
export function wikiPagePath(href: string, wiki?: string): string {
  const cut = href.search(/[?#]/)
  const path = cut < 0 ? href : href.slice(0, cut)
  const rest = cut < 0 ? '' : href.slice(cut)
  if (path.startsWith('/')) return href
  // As on the page itself, where `changelog` and `../changelog` both name the
  // page beside it. The empty segment stands for the page.
  const relative = path.startsWith('../') ? path : `../${path}`
  const segments = wiki ? [wiki, ''] : ['']
  for (const segment of relative.split('/')) {
    if (segment === '..') segments.pop()
    else if (segment !== '.' && segment !== '') segments.push(segment)
  }
  return `/${segments.join('/')}${rest}`
}

export function classifyWikiLink(href: string): WikiLinkKind {
  if (ATTACHMENT_PATTERNS.some((pattern) => pattern.test(href))) {
    return 'attachment'
  }

  if (/^(https?:)?\/\//i.test(href) || /^[a-z][a-z\d+\-.]*:/i.test(href)) {
    return 'external'
  }

  return 'internal'
}
