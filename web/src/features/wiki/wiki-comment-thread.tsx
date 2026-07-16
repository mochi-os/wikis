// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { plural, t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Check, Pencil, Reply, Send, Trash2, X, Paperclip } from 'lucide-react'
import {
  Button,
  CommentTreeLayout,
  ConfirmDialog,
  EntityAvatar,
  IconButton,
  useFormat,
  getAppPath,
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  useImageObjectUrls,
  textUnchanged,
  pendingFileKey,
  removePendingFile,
} from '@mochi/web'
import type { WikiComment } from '@/types/wiki'
import { CommentAttachments } from './comment-attachments'

interface WikiCommentThreadProps {
  comment: WikiComment
  slug: string
  currentUserId?: string
  isOwner: boolean
  replyingTo: string | null
  replyDraft: string
  onStartReply: (commentId: string) => void
  onCancelReply: () => void
  onReplyDraftChange: (value: string) => void
  onSubmitReply: (commentId: string, files?: File[]) => void
  onEdit?: (commentId: string, body: string) => void
  onDelete?: (commentId: string) => void
  depth?: number
}

export function WikiCommentThread({
  comment,
  slug,
  currentUserId,
  isOwner,
  replyingTo,
  replyDraft,
  onStartReply,
  onCancelReply,
  onReplyDraftChange,
  onSubmitReply,
  onEdit,
  onDelete,
  depth = 0,
}: WikiCommentThreadProps) {
  const { formatTimestamp, formatFileSize } = useFormat()
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const replyPreviewUrls = useImageObjectUrls(replyFiles)
  const replyFileRef = { current: null as HTMLInputElement | null }

  const isReplying = replyingTo === comment.id
  const hasChildren = comment.children && comment.children.length > 0
  const canEdit = currentUserId === comment.author
  const canDelete = currentUserId === comment.author || isOwner

  const getTotalDescendants = (c: WikiComment): number => {
    if (!c.children) return 0
    return c.children.length + c.children.reduce((acc, child) => acc + getTotalDescendants(child), 0)
  }
  const totalDescendants = getTotalDescendants(comment)

  const timeAgo = formatTimestamp(comment.created)

  // The author's display name is denormalised onto the comment when it syncs.
  // If it hasn't arrived yet, fall back to a generic label — never the raw
  // entity ID, which reads as corrupt data.
  const authorName = comment.name || t`Unknown`

  const assetUrl = (slot: string) =>
    `${getAppPath()}/${comment.wiki}/-/comment/${comment.id}/asset/${slot}`
  const avatar = (
    <EntityAvatar
      src={assetUrl('avatar')}
      styleUrl={assetUrl('style')}
      seed={comment.author}
      name={authorName}
      size="xs"
      className="z-10"
    />
  )

  const collapsedContent = (
    <div className="flex h-5 items-center gap-2 py-0.5 text-xs select-none">
      <span className="text-muted-foreground font-medium">{authorName}</span>
      <span className="text-muted-foreground">&middot;</span>
      <span className="text-muted-foreground">{timeAgo}</span>
      <button
        onClick={() => setCollapsed(false)}
        className="text-primary ms-2 flex cursor-pointer items-center gap-1 hover:underline"
      >
        {totalDescendants > 0 ? (
          <span>{plural(totalDescendants, { one: '# reply', other: '+# more replies' })}</span>
        ) : (
          <span className="text-muted-foreground italic"><Trans>(expand)</Trans></span>
        )}
      </button>
    </div>
  )

  const content = (
    <div className="space-y-1.5">
      <div className="group/row">
        <div className="flex h-5 items-center gap-2 text-xs">
          <span className="text-foreground font-medium">{authorName}</span>
          <span className="text-muted-foreground">&middot;</span>
          <span className="text-muted-foreground">{timeAgo}</span>
          {comment.edited > 0 && (
            <span className="text-muted-foreground italic"><Trans>(edited)</Trans></span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="border-input bg-background min-h-16 w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={
                  !editBody.trim() ||
                  textUnchanged(editBody.trim(), comment.body)
                }
                onClick={() => {
                  const trimmed = editBody.trim()
                  if (textUnchanged(trimmed, comment.body)) {
                    setEditing(false)
                    return
                  }
                  onEdit?.(comment.id, trimmed)
                  setEditing(false)
                }}
              >
                <Check className="size-4" />
                <Trans>Save</Trans>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {comment.body_markdown ? (
              <div
                className="text-foreground max-w-none text-sm leading-relaxed [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:my-0.5"
                dangerouslySetInnerHTML={{ __html: comment.body_markdown }}
              />
            ) : (
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
            )}
          </>
        )}

        <CommentAttachments attachments={comment.attachments} />

        <div className="flex min-h-[28px] items-center gap-2 pt-0.5">
          {/* Always visible on mobile, hover/focus reveal on desktop */}
          <div className="flex items-center gap-1 opacity-100 transition-opacity md:pointer-events-none md:opacity-0 md:group-hover/row:pointer-events-auto md:group-hover/row:opacity-100 md:group-focus-within/row:pointer-events-auto md:group-focus-within/row:opacity-100">
            <button
              type="button"
              className="text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors"
              onClick={() => onStartReply(comment.id)}
            >
              <Reply className="size-3" />
              <span><Trans>Reply</Trans></span>
            </button>

            {canEdit && (
              <button
                type="button"
                className="text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors"
                onClick={() => {
                  setEditing(true)
                  setEditBody(comment.body)
                }}
              >
                <Pencil className="size-3" />
                <span><Trans>Edit</Trans></span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                className="text-muted-foreground hover:bg-hover hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors"
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="size-3" />
                <span><Trans>Delete</Trans></span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isReplying && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <textarea
            placeholder={t`Reply to ${comment.name || comment.author}...`}
            value={replyDraft}
            onChange={(e) => onReplyDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (replyDraft.trim()) onSubmitReply(comment.id, replyFiles.length > 0 ? replyFiles : undefined)
              } else if (e.key === 'Escape') {
                onCancelReply()
              }
            }}
            className="border-input bg-background min-h-16 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
            autoFocus
          />
          {replyFiles.length > 0 && (
            <AttachmentGroup>
              {replyFiles.map((file, i) => {
                const isImage = file.type.startsWith('image/')
                return (
                  <Attachment key={pendingFileKey(file)} state="uploading" size="sm">
                    <AttachmentMedia variant={isImage ? "image" : "icon"}>
                      {isImage && replyPreviewUrls[i] ? (
                        <img src={replyPreviewUrls[i] ?? undefined} alt={file.name} draggable={false} />
                      ) : (
                        <Paperclip />
                      )}
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{file.name}</AttachmentTitle>
                      <AttachmentDescription>
                        {formatFileSize(file.size)}
                      </AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction onClick={() => setReplyFiles((prev) => removePendingFile(prev, file))} aria-label={t`Remove file`}>
                        <X className="size-4" />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                )
              })}
            </AttachmentGroup>
          )}
          <div className="flex items-center justify-end gap-2">
            <input
              ref={(el) => { replyFileRef.current = el }}
              type="file"
              multiple
              onChange={(e) => { if (e.target.files) { const f = Array.from(e.target.files); setReplyFiles((prev) => [...prev, ...f]) } e.target.value = '' }}
              className="hidden"
            />
            <IconButton
              type='button'
              variant='ghost'
              className='size-8'
              onClick={() => replyFileRef.current?.click()}
              label={t`Attach reply files`}
            >
              <Paperclip className="size-4" />
            </IconButton>
            <IconButton
              type='button'
              variant='ghost'
              className='size-8'
              onClick={onCancelReply}
              label={t`Cancel reply`}
            >
              <X className="size-4" />
            </IconButton>
            <IconButton
              type='button'
              className='size-8'
              disabled={!replyDraft.trim()}
              onClick={() => onSubmitReply(comment.id, replyFiles.length > 0 ? replyFiles : undefined)}
              label={t`Send reply`}
            >
              <Send className="size-4" />
            </IconButton>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t`Delete comment`}
        desc={t`Are you sure you want to delete this comment? This will also delete all replies. This action cannot be undone.`}
        confirmText={t`Delete`}
        destructive={true}
        handleConfirm={() => {
          onDelete?.(comment.id)
          setDeleting(false)
        }}
      />
    </div>
  )

  const children = hasChildren ? (
    <>
      {comment.children.map((child) => (
        <WikiCommentThread
          key={child.id}
          comment={child}
          slug={slug}
          currentUserId={currentUserId}
          isOwner={isOwner}
          replyingTo={replyingTo}
          replyDraft={replyDraft}
          onStartReply={onStartReply}
          onCancelReply={onCancelReply}
          onReplyDraftChange={onReplyDraftChange}
          onSubmitReply={onSubmitReply}
          onEdit={onEdit}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </>
  ) : null

  return (
    <CommentTreeLayout
      depth={depth}
      isCollapsed={collapsed}
      onToggleCollapse={() => setCollapsed(!collapsed)}
      hasChildren={hasChildren}
      avatar={avatar}
      content={content}
      collapsedContent={collapsedContent}
    >
      {children}
    </CommentTreeLayout>
  )
}
