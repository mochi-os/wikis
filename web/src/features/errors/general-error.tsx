import { useNavigate, useRouter } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/request'

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean
  error?: unknown
  reset?: () => void
}

export function GeneralError({
  className,
  minimal = false,
  error,
}: GeneralErrorProps) {
  const navigate = useNavigate()
  const { history } = useRouter()

  // Extract error details directly from the error object
  let statusCode = 500
  let message = 'Unknown error'

  if (error instanceof ApiError) {
    statusCode = error.status || 500
    // Show the actual error message from the backend
    const errorData = error.data as { error?: string } | undefined
    message = errorData?.error || error.message || 'Unknown error'
  } else if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  }

  return (
    <div className={cn('h-svh w-full', className)}>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        {!minimal && (
          <h1 className='text-[7rem] leading-tight font-bold'>{statusCode}</h1>
        )}
        <span className='font-medium'>Error</span>
        <p className='text-muted-foreground text-center'>
          {message}
        </p>
        {!minimal && (
          <div className='mt-6 flex gap-4'>
            <Button variant='outline' onClick={() => history.go(-1)}>
              Go Back
            </Button>
            <Button onClick={() => navigate({ to: '/' })}>Back to Home</Button>
          </div>
        )}
      </div>
    </div>
  )
}
