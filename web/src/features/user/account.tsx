import { useState } from 'react'
import type { Passkey, TotpSetupResponse } from '@/types/account'
import { startRegistration } from '@simplewebauthn/browser'
import {
  Check,
  Key,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  User,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  useAccountData,
  useMethods,
  usePasskeyDelete,
  usePasskeyRegisterBegin,
  usePasskeyRegisterFinish,
  usePasskeyRename,
  usePasskeys,
  useRecoveryGenerate,
  useRecoveryStatus,
  useSetMethods,
  useTotpDisable,
  useTotpSetup,
  useTotpStatus,
  useTotpVerify,
} from '@/hooks/use-account'
import {
  Button,
  ConfirmDialog,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  PageHeader,
  Main,
  usePageTitle,
  Section,
  FieldRow,
  DataChip,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  GeneralError,
  EmptyState,
  getErrorMessage,
  formatTimestamp,
  toast,
} from '@mochi/web'

// ============================================================================
// Identity Section
// ============================================================================

function IdentitySection() {
  const { data, isLoading, error, refetch } = useAccountData()

  return (
    <Section
      title='Identity'
      description='Your personal account information'
    >
      {error ? (
        <GeneralError error={error} minimal mode='inline' reset={refetch} />
      ) : isLoading ? (
        <div className='space-y-4 py-2'>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
        </div>
      ) : data?.identity ? (
        <div className='divide-y-0'>
          <FieldRow label="Name">
            <span className='text-foreground text-base font-semibold'>
              {data.identity.name}
            </span>
          </FieldRow>
          <FieldRow label="Username">
            <span className='text-foreground text-base'>
              {data.identity.username}
            </span>
          </FieldRow>
          <FieldRow label="Fingerprint">
            <DataChip value={data.identity.fingerprint} truncate='middle' />
          </FieldRow>
          <FieldRow label="Entity ID">
            <DataChip value={data.identity.entity} truncate='middle' />
          </FieldRow>
        </div>
      ) : null}
    </Section>
  )
}

// ============================================================================
// Login Requirements Section
// ============================================================================

function LoginRequirementsSection() {
  const { data: methodsData, isLoading, error, refetch } = useMethods()
  const { data: passkeysData, error: passkeysError } = usePasskeys()
  const { data: totpData, error: totpError } = useTotpStatus()
  const setMethods = useSetMethods()

  const methods = methodsData?.methods ?? ['email']
  const hasPasskey = passkeysError ? false : (passkeysData?.passkeys?.length ?? 0) > 0
  const hasTOTP = totpError ? false : (totpData?.enabled ?? false)

  const handleToggleMethod = (method: string, enabled: boolean) => {
    let newMethods: string[]
    if (enabled) {
      newMethods = [...methods, method]
    } else {
      newMethods = methods.filter((m) => m !== method)
    }
    // Ensure at least one method
    if (newMethods.length === 0) {
      newMethods = ['email']
    }

    setMethods.mutate(newMethods, {
      onSuccess: () => {
        toast.success('Login requirements updated')
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to update login requirements'))
      },
    })
  }

  return (
    <Section
      title='Login requirements'
      description='Require all selected methods to log in'
    >
      {error ? (
        <GeneralError error={error} minimal mode='inline' reset={refetch} />
      ) : isLoading ? (
        <div className='space-y-4 py-2'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
        </div>
      ) : (
        <div className='space-y-0 divide-y-0'>
          <div className='flex items-center justify-between py-4 border-b border-border/40'>
            <div className='space-y-1 pr-4'>
              <Label htmlFor='method-passkey' className='text-sm font-medium'>
                Passkey
              </Label>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {hasPasskey
                  ? 'Use a registered passkey to sign in'
                  : 'Register a passkey below to enable'}
              </p>
            </div>
            <Switch
              id='method-passkey'
              checked={methods.includes('passkey')}
              onCheckedChange={(checked) =>
                handleToggleMethod('passkey', checked)
              }
              disabled={setMethods.isPending || !hasPasskey}
            />
          </div>

          <div className='flex items-center justify-between py-4 border-b border-border/40'>
            <div className='space-y-1 pr-4'>
              <Label htmlFor='method-totp' className='text-sm font-medium'>
                Authenticator app
              </Label>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {hasTOTP
                  ? 'Use an authenticator app code to sign in'
                  : 'Set up an authenticator below to enable'}
              </p>
            </div>
            <Switch
              id='method-totp'
              checked={methods.includes('totp')}
              onCheckedChange={(checked) => handleToggleMethod('totp', checked)}
              disabled={setMethods.isPending || !hasTOTP}
            />
          </div>

          <div className='flex items-center justify-between py-4'>
            <div className='space-y-1 pr-4'>
              <Label htmlFor='method-email' className='text-sm font-medium'>
                Email code
              </Label>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                Receive a verification code by email
              </p>
            </div>
            <Switch
              id='method-email'
              checked={methods.includes('email')}
              onCheckedChange={(checked) =>
                handleToggleMethod('email', checked)
              }
              disabled={
                setMethods.isPending ||
                (methods.length === 1 && methods.includes('email'))
              }
            />
          </div>
        </div>
      )}
    </Section>
  )
}

// ============================================================================
// Passkeys Section
// ============================================================================

function PasskeyRow({
  passkey,
  onRename,
  onDelete,
}: {
  passkey: Passkey
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newName, setNewName] = useState(passkey.name)

  const handleRename = () => {
    if (newName.trim() && newName !== passkey.name) {
      onRename(passkey.id, newName.trim())
    }
    setIsRenaming(false)
  }

  return (
    <TableRow>
      <TableCell>
        {isRenaming ? (
          <div className='flex items-center gap-2'>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className='h-8 w-40'
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setIsRenaming(false)
              }}
            />
            <Button size='sm' variant='ghost' onClick={handleRename}>
              <Check className='h-4 w-4' />
            </Button>
          </div>
        ) : (
          <span className='font-medium'>{passkey.name}</span>
        )}
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {formatTimestamp(passkey.created)}
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {formatTimestamp(passkey.last_used, 'Never')}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex justify-end gap-1'>
          <Button variant='ghost' size='sm' onClick={() => setIsRenaming(true)}>
            <Pencil className='h-4 w-4' />
          </Button>
          <Button variant='ghost' size='sm' onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className='h-4 w-4' />
          </Button>
          <ConfirmDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            title='Delete passkey?'
            desc={`This will remove "${passkey.name}" from your account. You won't be able to use it to sign in anymore.`}
            confirmText='Delete'
            destructive
            handleConfirm={() => {
              onDelete(passkey.id)
              setShowDeleteDialog(false)
            }}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

function PasskeysSection() {
  const { data, isLoading, error, refetch } = usePasskeys()
  const registerBegin = usePasskeyRegisterBegin()
  const registerFinish = usePasskeyRegisterFinish()
  const renamePasskey = usePasskeyRename()
  const deletePasskey = usePasskeyDelete()
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')

  const handleRegister = async () => {
    setIsRegistering(true)
    try {
      const beginResult = await registerBegin.mutateAsync()
      const credential = await startRegistration({
        optionsJSON: beginResult.options as Parameters<typeof startRegistration>[0]['optionsJSON'],
      })
      await registerFinish.mutateAsync({
        ceremony: beginResult.ceremony,
        credential,
        name: passkeyName || 'Passkey',
      })
      toast.success('Passkey registered')
      setRegisterDialogOpen(false)
      setPasskeyName('')
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast.error('Registration cancelled')
      } else {
        toast.error(getErrorMessage(error, 'Failed to register passkey'))
      }
    } finally {
      setIsRegistering(false)
    }
  }

  const handleRename = (id: string, name: string) => {
    renamePasskey.mutate(
      { id, name },
      {
        onSuccess: () => toast.success('Passkey renamed'),
        onError: (error) => toast.error(getErrorMessage(error, 'Failed to rename passkey')),
      }
    )
  }

  const handleDelete = (id: string) => {
    deletePasskey.mutate(id, {
      onSuccess: () => toast.success('Passkey deleted'),
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to delete passkey')),
    })
  }

  const passkeys = data?.passkeys ?? []

  return (
    <Card className='shadow-md'>
      <CardHeader className='border-b/60 border-b pb-4 flex flex-row items-center justify-between'>
        <div className='space-y-1'>
          <CardTitle className='text-lg'>Passkeys</CardTitle>
          <CardDescription>Sign in with biometrics or security keys</CardDescription>
        </div>
        <ResponsiveDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setRegisterDialogOpen(true)}
          >
            Add passkey
            <Plus className='ml-2 h-4 w-4' />
          </Button>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Register passkey</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Use a security key, fingerprint, or face recognition.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className='py-4'>
              <Label htmlFor='passkey-name'>Passkey name</Label>
              <Input
                id='passkey-name'
                placeholder='My passkey'
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                className='mt-2'
              />
            </div>
            <ResponsiveDialogFooter>
              <Button onClick={handleRegister} disabled={isRegistering}>
                Register
                {isRegistering && (
                  <Loader2 className='ml-2 h-4 w-4 animate-spin' />
                )}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </CardHeader>
      <CardContent className='pt-2'>
        {error ? (
          <GeneralError error={error} minimal mode='inline' reset={refetch} />
        ) : isLoading ? (
          <div className='space-y-3 py-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        ) : passkeys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No passkeys registered"
            className="my-4"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className='w-24'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passkeys.map((passkey) => (
                <PasskeyRow
                  key={passkey.id}
                  passkey={passkey}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Authenticator App Section
// ============================================================================

function AuthenticatorSection() {
  const { data, isLoading, error, refetch } = useTotpStatus()
  const setupTotp = useTotpSetup()
  const verifyTotp = useTotpVerify()
  const disableTotp = useTotpDisable()
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSetup = async () => {
    try {
      const result = await setupTotp.mutateAsync()
      setSetupData(result)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to set up authenticator'))
    }
  }

  const handleVerify = async () => {
    if (!verifyCode) return
    setIsVerifying(true)
    try {
      const result = await verifyTotp.mutateAsync(verifyCode)
      if (result.ok) {
        toast.success('Authenticator app enabled')
        setSetupData(null)
        setVerifyCode('')
      } else {
        toast.error('Invalid code')
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to verify code'))
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDisable = () => {
    disableTotp.mutate(undefined, {
      onSuccess: () => toast.success('Authenticator app disabled'),
      onError: (error) => toast.error(getErrorMessage(error, 'Failed to disable authenticator')),
    })
  }

  const isEnabled = data?.enabled ?? false

  return (
    <Section
      title='Authenticator App'
      description='Use an authenticator app to generate one-time codes'
    >
      {error ? (
        <GeneralError error={error} minimal mode='inline' reset={refetch} />
      ) : isLoading ? (
        <div className='py-2'>
          <Skeleton className='h-20 w-full' />
        </div>
      ) : setupData ? (
        <div className='space-y-6 py-4'>
          <div className='space-y-3'>
            <p className='text-sm font-medium'>1. Scan QR Code</p>
            <div className='flex justify-center rounded-xl border-2 bg-white p-6 shadow-sm'>
              <QRCodeSVG value={setupData.url} size={200} />
            </div>
          </div>
          <div className='space-y-2.5'>
            <Label className='text-sm font-medium'>2. Manual Entry</Label>
            <DataChip value={setupData.secret} chipClassName='flex-1' />
          </div>
          <div className='border-t pt-6 space-y-4'>
            <p className='text-sm font-medium'>3. Verify Code</p>
            <div className='flex items-center gap-3'>
              <Input
                placeholder='000000'
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                className='w-32 font-mono text-center'
                maxLength={6}
              />
              <Button
                onClick={handleVerify}
                disabled={isVerifying || !verifyCode}
              >
                Verify & Enable
                {isVerifying && <Loader2 className='ml-2 h-4 w-4 animate-spin' />}
              </Button>
              <Button variant='ghost' onClick={() => setSetupData(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : isEnabled ? (
        <div className='flex items-center justify-between py-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30'>
              <Check className='h-5 w-5 text-green-600 dark:text-green-500' />
            </div>
            <div>
              <p className='text-sm font-medium'>Status: Enabled</p>
              <p className='text-muted-foreground text-xs'>Authenticator app is active</p>
            </div>
          </div>
          <Button variant='destructive' size='sm' onClick={() => setShowDisableDialog(true)}>
            Disable
          </Button>
          <ConfirmDialog
            open={showDisableDialog}
            onOpenChange={setShowDisableDialog}
            title='Disable authenticator?'
            desc='This will remove the app from your account.'
            confirmText='Disable'
            destructive
            handleConfirm={() => {
              handleDisable()
              setShowDisableDialog(false)
            }}
          />
        </div>
      ) : (
        <div className='py-6 text-center'>
          <p className='text-muted-foreground mb-4 text-sm'>Add an app for additional security</p>
          <Button onClick={handleSetup} disabled={setupTotp.isPending}>Set up authenticator</Button>
        </div>
      )}
    </Section>
  )
}

// ============================================================================
// Recovery Codes Section
// ============================================================================

function RecoveryCodesSection() {
  const { data, isLoading, error, refetch } = useRecoveryStatus()
  const generateCodes = useRecoveryGenerate()
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showCodes, setShowCodes] = useState<string[] | null>(null)

  const handleGenerate = async () => {
    try {
      const result = await generateCodes.mutateAsync()
      setShowCodes(result.codes)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to generate codes'))
    }
  }

  const count = data?.count ?? 0

  return (
    <Section
      title='Recovery Codes'
      description='Backup codes for account recovery'
    >
      {error ? (
        <GeneralError error={error} minimal mode='inline' reset={refetch} />
      ) : isLoading ? (
        <div className='py-2'><Skeleton className='h-20 w-full' /></div>
      ) : showCodes ? (
        <div className='space-y-5 py-4'>
          <Alert variant='destructive' className='bg-amber-50 dark:bg-amber-950/20 border-amber-200'>
            <Shield className='h-4 w-4 text-amber-600' />
            <AlertTitle>Save these codes</AlertTitle>
            <AlertDescription>Each code can only be used once.</AlertDescription>
          </Alert>
          <div className='bg-muted/30 rounded-xl border p-5'>
            <div className='grid grid-cols-2 gap-3 font-mono text-sm'>
              {showCodes.map((code, i) => (
                <div key={i} className='bg-background flex items-center justify-center rounded-md border py-2.5 font-semibold'>{code}</div>
              ))}
            </div>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={() => {
              navigator.clipboard.writeText(showCodes.join('\n'))
              toast.success('Codes copied')
            }}>Copy all</Button>
            <Button variant='ghost' size='sm' onClick={() => setShowCodes(null)}>Done</Button>
          </div>
        </div>
      ) : (
        <div className='flex items-center justify-between py-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30'>
              <RefreshCw className='h-5 w-5 text-blue-600 dark:text-blue-500' />
            </div>
            <div>
              <p className='text-sm font-medium'>{count > 0 ? `${count} remaining` : 'No codes'}</p>
              <p className='text-muted-foreground text-xs'>Recovery codes</p>
            </div>
          </div>
          <Button variant='outline' size='sm' onClick={() => setShowGenerateDialog(true)}>
            {count > 0 ? 'Regenerate' : 'Generate'}
          </Button>
          <ConfirmDialog
            open={showGenerateDialog}
            onOpenChange={setShowGenerateDialog}
            title={count > 0 ? 'Regenerate?' : 'Generate?'}
            desc='Make sure to save the new codes.'
            confirmText='Proceed'
            handleConfirm={() => {
              void handleGenerate()
              setShowGenerateDialog(false)
            }}
          />
        </div>
      )}
    </Section>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function UserAccount() {
  usePageTitle('Account')

  return (
    <>
      <PageHeader title="Account" icon={<User className='size-4 md:size-5' />} />
      <Main>
        <div className='space-y-8 pb-10'>
          <IdentitySection />
          <LoginRequirementsSection />
          <PasskeysSection />
          <AuthenticatorSection />
          <RecoveryCodesSection />
        </div>
      </Main>
    </>
  )
}
