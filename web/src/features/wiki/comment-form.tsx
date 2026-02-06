import { useState, useRef } from 'react'
import { Button } from '@mochi/common'
import { Paperclip, Send, X } from 'lucide-react'

interface CommentFormProps {
  onSubmit: (body: string, files?: File[]) => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentForm({ onSubmit, onCancel, placeholder, autoFocus }: CommentFormProps) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    onSubmit(trimmed, files.length > 0 ? files : undefined)
    setBody('')
    setFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape' && onCancel) {
      onCancel()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-input bg-background min-h-16 w-full resize-none rounded-lg border px-3 py-2 text-sm"
        rows={3}
        autoFocus={autoFocus}
      />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={i} className="bg-muted relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
              {file.type.startsWith('image/') && (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-8 w-8 rounded object-cover"
                />
              )}
              <Paperclip className="text-muted-foreground size-3 shrink-0" />
              <span className="max-w-40 truncate">{file.name}</span>
              <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground ml-0.5">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" size="icon" className="size-8" disabled={!body.trim()} onClick={handleSubmit}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
