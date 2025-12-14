import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AccountData,
  SessionsResponse,
  MethodsResponse,
  PasskeysResponse,
  PasskeyRegisterBeginResponse,
  PasskeyRegisterFinishResponse,
  TotpStatusResponse,
  TotpSetupResponse,
  TotpVerifyResponse,
  RecoveryStatusResponse,
  RecoveryGenerateResponse,
} from '@/types/account'
import endpoints from '@/api/endpoints'
import { requestHelpers } from '@mochi/common'

export function useAccountData() {
  return useQuery({
    queryKey: ['account', 'data'],
    queryFn: () => requestHelpers.get<AccountData>(endpoints.user.account),
  })
}

export function useSessions() {
  return useQuery({
    queryKey: ['account', 'sessions'],
    queryFn: () =>
      requestHelpers.get<SessionsResponse>(endpoints.user.accountSessions),
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      requestHelpers.post<{ ok: boolean }>(
        endpoints.user.accountSessionRevoke,
        {
          code,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account'] })
    },
  })
}

// ============================================================================
// Login methods
// ============================================================================

export function useMethods() {
  return useQuery({
    queryKey: ['account', 'methods'],
    queryFn: () =>
      requestHelpers.get<MethodsResponse>(endpoints.user.accountMethods),
  })
}

export function useSetMethods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (methods: string[]) =>
      requestHelpers.post<{ ok: boolean; methods: string[] }>(
        endpoints.user.accountMethodsSet,
        { methods }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'methods'] })
    },
  })
}

// ============================================================================
// Passkeys
// ============================================================================

export function usePasskeys() {
  return useQuery({
    queryKey: ['account', 'passkeys'],
    queryFn: () =>
      requestHelpers.get<PasskeysResponse>(endpoints.user.accountPasskeys),
  })
}

export function usePasskeyRegisterBegin() {
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<PasskeyRegisterBeginResponse>(
        endpoints.user.accountPasskeyRegisterBegin,
        {}
      ),
  })
}

export function usePasskeyRegisterFinish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      ceremony: string
      credential: unknown
      name?: string
    }) =>
      requestHelpers.post<PasskeyRegisterFinishResponse>(
        endpoints.user.accountPasskeyRegisterFinish,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'passkeys'] })
    },
  })
}

export function usePasskeyRename() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; name: string }) =>
      requestHelpers.post<{ ok: boolean }>(
        endpoints.user.accountPasskeyRename,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'passkeys'] })
    },
  })
}

export function usePasskeyDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      requestHelpers.post<{ ok: boolean }>(
        endpoints.user.accountPasskeyDelete,
        { id }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'passkeys'] })
    },
  })
}

// ============================================================================
// TOTP
// ============================================================================

export function useTotpStatus() {
  return useQuery({
    queryKey: ['account', 'totp'],
    queryFn: () =>
      requestHelpers.get<TotpStatusResponse>(endpoints.user.accountTotp),
  })
}

export function useTotpSetup() {
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<TotpSetupResponse>(
        endpoints.user.accountTotpSetup,
        {}
      ),
  })
}

export function useTotpVerify() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      requestHelpers.post<TotpVerifyResponse>(
        endpoints.user.accountTotpVerify,
        { code }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'totp'] })
    },
  })
}

export function useTotpDisable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<{ ok: boolean }>(
        endpoints.user.accountTotpDisable,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'totp'] })
    },
  })
}

// ============================================================================
// Recovery codes
// ============================================================================

export function useRecoveryStatus() {
  return useQuery({
    queryKey: ['account', 'recovery'],
    queryFn: () =>
      requestHelpers.get<RecoveryStatusResponse>(
        endpoints.user.accountRecovery
      ),
  })
}

export function useRecoveryGenerate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<RecoveryGenerateResponse>(
        endpoints.user.accountRecoveryGenerate,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', 'recovery'] })
    },
  })
}
