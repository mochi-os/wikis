import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { EmptyState, Skeleton, toast, getErrorMessage } from '@mochi/common'
import {
  usePageComments,
  useCreateComment,
  useEditComment,
  useDeleteComment,
} from '@/hooks/use-wiki'
import { CommentForm } from './comment-form'
import { WikiCommentThread } from './wiki-comment-thread'

interface PageCommentsProps {
  slug: string
  currentUserId?: string
  isOwner: boolean
  canComment: boolean
}

export function PageComments({ slug, currentUserId, isOwner, canComment }: PageCommentsProps) {
  const { data, isLoading } = usePageComments(slug)
  const createComment = useCreateComment()
  const editComment = useEditComment()
  const deleteComment = useDeleteComment()

  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const handleCreate = (body: string, files?: File[]) => {
    createComment.mutate(
      { slug, body, files },
      {
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  const handleReply = (parentId: string, files?: File[]) => {
    const body = replyDraft.trim()
    if (!body) return
    createComment.mutate(
      { slug, body, parent: parentId, files },
      {
        onSuccess: () => {
          setReplyingTo(null)
          setReplyDraft('')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  const handleEdit = (commentId: string, body: string) => {
    editComment.mutate(
      { slug, id: commentId, body },
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

  const comments = data?.comments ?? []

  return (
    <div className="space-y-4">
      {canComment && (
        <CommentForm onSubmit={handleCreate} placeholder="Write a comment..." />
      )}
      {comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Be the first to comment on this page."
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
              onStartReply={(id) => {
                setReplyingTo(id)
                setReplyDraft('')
              }}
              onCancelReply={() => {
                setReplyingTo(null)
                setReplyDraft('')
              }}
              onReplyDraftChange={setReplyDraft}
              onSubmitReply={handleReply}
              onEdit={canComment ? handleEdit : undefined}
              onDelete={canComment ? handleDelete : undefined}
            />
          ))}
        </div>
      )}
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
