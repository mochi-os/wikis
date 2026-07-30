// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { EmptyState, GeneralError, Skeleton, toast, getErrorMessage, textUnchanged, findCommentTextInTree, useDiscardGuard } from '@mochi/web'
import {
  usePageComments,
  useCreateComment,
  useEditComment,
  useDeleteComment,
} from '@/hooks/use-wiki'
import { CommentForm } from './comment-form'
import { WikiCommentThread } from './wiki-comment-thread'
import { t } from '@lingui/core/macro'

interface PageCommentsProps {
  slug: string
  currentUserId?: string
  isOwner: boolean
  canComment: boolean
}

export function PageComments({ slug, currentUserId, isOwner, canComment }: PageCommentsProps) {
  const { data, isLoading, error, refetch } = usePageComments(slug)
  const createComment = useCreateComment()
  const editComment = useEditComment()
  const deleteComment = useDeleteComment()

  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyFileCount, setReplyFileCount] = useState(0)
  const pendingReplyTarget = useRef<string | null>(null)

  const startReply = useCallback((commentId: string) => {
    setReplyingTo(commentId)
    setReplyFileCount(0)
    const selected = window.getSelection()?.toString().trim()
    if (selected) {
      const quoted = selected.split('\n').map((line) => `> ${line}`).join('\n') + '\n\n'
      setReplyDraft(quoted)
    } else {
      setReplyDraft('')
    }
  }, [])

  const cancelReply = useCallback(() => {
    setReplyingTo(null)
    setReplyDraft('')
    setReplyFileCount(0)
  }, [])

  // Opening another comment's reply box throws the current draft away, so it
  // asks first, exactly like closing the box does. The guard lives here rather
  // than in the thread because the comment being replied to is not the one
  // whose Reply button was clicked.
  const { requestClose: requestReplySwitch, discardDialog: replySwitchDialog } =
    useDiscardGuard({
      hasText: replyDraft.trim().length > 0,
      hasFiles: replyFileCount > 0,
      onDiscard: () => {
        const next = pendingReplyTarget.current
        pendingReplyTarget.current = null
        if (next) startReply(next)
        else cancelReply()
      },
    })

  const handleStartReply = useCallback(
    (commentId: string) => {
      if (replyingTo && replyingTo !== commentId) {
        pendingReplyTarget.current = commentId
        requestReplySwitch()
        return
      }
      startReply(commentId)
    },
    [replyingTo, requestReplySwitch, startReply]
  )

  const handleCreate = async (body: string, files?: File[]) => {
    try {
      await createComment.mutateAsync({ slug, body, files })
    } catch (err) {
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  const handleReply = async (parentId: string, files?: File[]) => {
    const body = replyDraft.trim()
    if (!body) return
    try {
      await createComment.mutateAsync({ slug, body, parent: parentId, files })
      setReplyingTo(null)
      setReplyDraft('')
    } catch (err) {
      // Leave the form open with its draft and files so the thread can retry.
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  const handleEdit = (commentId: string, body: string) => {
    const original = findCommentTextInTree(data?.comments ?? [], commentId, {
      getId: (c) => c.id,
      getText: (c) => c.body,
      getChildren: (c) => c.children,
    })
    if (original !== undefined && textUnchanged(body, original)) {
      return
    }
    editComment.mutate(
      { slug, id: commentId, body, originalBody: original },
      {
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(
      { slug, id: commentId },
      {
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  if (isLoading) {
    return <PageCommentsSkeleton />
  }

  if (error) {
    return <GeneralError error={error} minimal mode="inline" reset={refetch} />
  }

  const comments = data?.comments ?? []

  return (
    <div className="space-y-4">
      {canComment && (
        <CommentForm onSubmit={handleCreate} placeholder={t`Write a comment...`} progress={createComment.progress} />
      )}
      {comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t`No comments yet`}
          description={t`Be the first to comment on this page.`}
        />
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => (
            <WikiCommentThread
              key={comment.id}
              comment={comment}
              slug={slug}
              currentUserId={currentUserId}
              isOwner={isOwner}
              replyingTo={replyingTo}
              replyDraft={replyDraft}
              onStartReply={handleStartReply}
              onCancelReply={cancelReply}
              onReplyDraftChange={setReplyDraft}
              onReplyFilesChange={setReplyFileCount}
              onSubmitReply={handleReply}
              onEdit={canComment ? handleEdit : undefined}
              onDelete={canComment ? handleDelete : undefined}
              progress={createComment.progress}
            />
          ))}
        </div>
      )}
      {replySwitchDialog}
    </div>
  )
}

export function PageCommentsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-3/4" />
      </div>
    </div>
  )
}
