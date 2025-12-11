export interface Domain {
  domain: string
  verified: number
  token: string
  tls: number
  created: number
  updated: number
}

export interface Route {
  domain: string
  path: string
  method: string
  target: string
  context: string
  priority: number
  enabled: number
  created: number
  updated: number
  target_name?: string
}

export interface Entity {
  id: string
  fingerprint: string
  class: string
  name: string
}

export interface Delegation {
  id: number
  domain: string
  path: string
  owner: number
  username: string
  created: number
  updated: number
}

export interface UserSearchResult {
  id: number
  username: string
  role: string
}

export interface DomainsData {
  domains: Domain[]
  delegations?: Delegation[]
  count: number
  admin: boolean
}

export interface DomainDetails {
  domain: Domain
  routes: Route[]
  delegations: Delegation[]
  admin: boolean
}

export interface App {
  id: string
  name: string
  latest: string
}
