export interface Identity {
  entity: string
  fingerprint: string
  username: string
  name: string
}

export interface Session {
  code: string
  address: string
  agent: string
  created: number
  accessed: number
  expires: number
}

export interface AccountData {
  identity: Identity
  sessions: Session[]
}

export interface SessionsResponse {
  sessions: Session[]
}

// Login methods
export interface MethodsResponse {
  methods: string[]
}

// Passkeys
export interface Passkey {
  id: string
  name: string
  transports: string
  created: number
  last_used: number
}

export interface PasskeysResponse {
  passkeys: Passkey[]
}

export interface PasskeyRegisterBeginResponse {
  options: unknown
  ceremony: string
}

export interface PasskeyRegisterFinishResponse {
  status: string
  name: string
}

// TOTP
export interface TotpStatusResponse {
  enabled: boolean
}

export interface TotpSetupResponse {
  secret: string
  url: string
  issuer: string
  domain: string
}

export interface TotpVerifyResponse {
  ok: boolean
}

// Recovery codes
export interface RecoveryStatusResponse {
  count: number
}

export interface RecoveryGenerateResponse {
  codes: string[]
}
