export const ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.txt,.md'

const ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
])

export function isSupportedAttachmentFile(file: File): boolean {
  if (file.type.startsWith('image/')) {
    return true
  }

  const name = file.name.toLowerCase()
  for (const ext of ATTACHMENT_EXTENSIONS) {
    if (name.endsWith(ext)) {
      return true
    }
  }

  return false
}
