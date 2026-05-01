import type { Session } from '@/types/account'
import { Trans, useLingui } from '@lingui/react/macro'
import { Loader2, LogOut } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  EmptyState,
  GeneralError,
  Header,
  ListSkeleton,
  Main,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormat,
  getErrorMessage,
  toast,
  usePageTitle,
} from '@mochi/web'
import { useAccountData, useRevokeSession } from '@/hooks/use-account'

function SessionRow({
  session,
  isCurrent,
}: {
  session: Session
  isCurrent: boolean
}) {
  const { formatTimestamp } = useFormat()
  const revokeSession = useRevokeSession()

  const handleRevoke = () => {
    revokeSession.mutate(session.code, {
      onSuccess: () => {
        toast.success("Session revoked")
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "Failed to revoke session"))
      },
    })
  }

  return (
    <TableRow>
      <TableCell>
        <div className='flex flex-col'>
          <span className='font-medium'>
            {session.agent || 'Unknown device'}
            {isCurrent && (
              <span className='text-muted-foreground ml-2 text-xs'>
                (current)
              </span>
            )}
          </span>
        </div>
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {formatTimestamp(session.created, 'Never')}
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {formatTimestamp(session.accessed, 'Never')}
      </TableCell>
      <TableCell className='text-right'>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              disabled={revokeSession.isPending}
            >
              {revokeSession.isPending ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <LogOut className='h-4 w-4' />
              )}
              <span className='sr-only'><Trans>Revoke session</Trans></span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle><Trans>Revoke session?</Trans></AlertDialogTitle>
              <AlertDialogDescription>
                This will sign out this session. If this is your current
                session, you will need to sign in again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel><Trans>Cancel</Trans></AlertDialogCancel>
              <AlertDialogAction onClick={handleRevoke}>
                <Trans>Revoke</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}

export function UserSessions() {
  const { t } = useLingui()
  usePageTitle(t`Sessions`)
  const { data, isLoading, error, refetch } = useAccountData()

  const sessions = data?.sessions ?? []
  const sortedSessions = [...sessions].sort((a, b) => b.accessed - a.accessed)

  return (
    <>
      <Header className="border-b-0">
        <h1 className='text-lg font-semibold'><Trans>Sessions</Trans></h1>
      </Header>

      <Main>
        {error ? (
          <GeneralError error={error} minimal mode='inline' reset={refetch} />
        ) : isLoading ? (
          <ListSkeleton variant='simple' height='h-10' count={3} />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={LogOut}
            title={t`No active sessions`}
            description={t`Your active sessions will appear here.`}
            className='py-8'
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Trans>Session</Trans></TableHead>
                <TableHead><Trans>Created</Trans></TableHead>
                <TableHead><Trans>Last active</Trans></TableHead>
                <TableHead className='w-12'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSessions.map((session, index) => (
                <SessionRow
                  key={session.code}
                  session={session}
                  isCurrent={index === 0 && session.accessed > 0}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Main>
    </>
  )
}
