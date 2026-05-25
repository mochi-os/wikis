const ENTITY_LABEL_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{6,}$/

export function looksLikeEntityIdentifier(value?: string | null): boolean {
  if (!value) return false
  return ENTITY_LABEL_PATTERN.test(value)
}

export function getAuthorLabel(name: string | null | undefined, author: string): string {
  if (name && !looksLikeEntityIdentifier(name)) {
    return name
  }

  if (!author) {
    return name || ''
  }

  return author.slice(0, 6)
}
