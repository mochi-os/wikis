import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, X, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAddTag, useRemoveTag } from '@/hooks/use-wiki'

interface TagManagerProps {
  slug: string
  tags: string[]
}

export function TagManager({ slug, tags }: TagManagerProps) {
  const [newTag, setNewTag] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const addTag = useAddTag()
  const removeTag = useRemoveTag()

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase()
    if (!tag) return
    if (tags.includes(tag)) {
      toast.error('Tag already exists')
      return
    }

    addTag.mutate(
      { slug, tag },
      {
        onSuccess: () => {
          toast.success(`Tag "${tag}" added`)
          setNewTag('')
          setIsOpen(false)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to add tag')
        },
      }
    )
  }

  const handleRemoveTag = (tag: string) => {
    removeTag.mutate(
      { slug, tag },
      {
        onSuccess: () => {
          toast.success(`Tag "${tag}" removed`)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to remove tag')
        },
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TagIcon className="text-muted-foreground h-4 w-4" />

      {/* Existing tags */}
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="group gap-1 pr-1">
          <a href={`tag/${tag}`} className="hover:underline">
            {tag}
          </a>
          <button
            onClick={() => handleRemoveTag(tag)}
            className="text-muted-foreground hover:text-foreground ml-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            disabled={removeTag.isPending}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add tag button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2">
            <Plus className="h-3 w-3" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter tag name"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddTag}
                disabled={!newTag.trim() || addTag.isPending}
              >
                {addTag.isPending ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
