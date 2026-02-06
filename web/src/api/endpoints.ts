const endpoints = {
  // Cross-app endpoints (proxied via wikis backend)
  users: {
    search: '/wikis/-/users/search',
  },
  groups: {
    list: '/wikis/-/groups',
  },
  auth: {
    code: '/_/code',
    verify: '/_/verify',
    identity: '/_/identity',
    logout: '/_/logout',
  },
  wiki: {
    // Info
    info: 'info',
    create: 'create',
    join: 'subscribe',
    directorySearch: 'directory/search',
    recommendations: 'recommendations',
    // Pages
    page: (slug: string) => `${slug}`,
    pageEdit: (slug: string) => `${slug}/edit`,
    pageHistory: (slug: string) => `${slug}/history`,
    pageRevision: (slug: string, version: number) => `${slug}/history/${version}`,
    pageRevert: (slug: string) => `${slug}/revert`,
    pageDelete: (slug: string) => `${slug}/delete`,
    pageRename: (slug: string) => `${slug}/rename`,
    newPage: 'page/create',
    search: 'search',
    // Tags
    tagAdd: (slug: string) => `${slug}/tag/add`,
    tagRemove: (slug: string) => `${slug}/tag/remove`,
    tags: 'tags',
    tagPages: (tag: string) => `tag/${tag}`,
    // Recent changes
    changes: 'changes',
    // Redirects
    redirects: 'redirects',
    redirectSet: 'redirect/set',
    redirectDelete: 'redirect/delete',
    // Settings
    settings: 'settings',
    settingsSet: 'settings/set',
    rename: 'rename',
    // Replicas
    replicas: 'replicas',
    replicaRemove: 'replica/remove',
    // Access control
    access: 'access',
    accessSet: 'access/set',
    accessRevoke: 'access/revoke',
    // User/group search
    userSearch: 'user/search',
    groups: 'groups',
    // Delete wiki
    delete: 'delete',
    // Sync
    sync: 'sync',
    subscribe: 'subscribe',
    unsubscribe: 'unsubscribe',
    // Comments
    pageComments: (slug: string) => `${slug}/comments`,
    commentCreate: (slug: string) => `${slug}/comment/create`,
    commentEdit: (slug: string) => `${slug}/comment/edit`,
    commentDelete: (slug: string) => `${slug}/comment/delete`,
    // Attachments
    attachments: 'attachment/list',
    attachmentUpload: 'attachment/upload',
    attachmentDelete: 'attachment/delete',
    attachment: (id: string) => `-/attachments/${id}`,
  },
  user: {
    account: 'user/account/data',
    accountIdentity: 'user/account/identity',
    accountSessions: 'user/account/sessions',
    accountSessionRevoke: 'user/account/session/revoke',
    // Login methods
    accountMethods: 'user/account/methods',
    accountMethodsSet: 'user/account/methods/set',
    // Passkeys
    accountPasskeys: 'user/account/passkeys',
    accountPasskeyRegisterBegin: 'user/account/passkey/register/begin',
    accountPasskeyRegisterFinish: 'user/account/passkey/register/finish',
    accountPasskeyRename: 'user/account/passkey/rename',
    accountPasskeyDelete: 'user/account/passkey/delete',
    // TOTP
    accountTotp: 'user/account/totp',
    accountTotpSetup: 'user/account/totp/setup',
    accountTotpVerify: 'user/account/totp/verify',
    accountTotpDisable: 'user/account/totp/disable',
    // Recovery
    accountRecovery: 'user/account/recovery',
    accountRecoveryGenerate: 'user/account/recovery/generate',
    // Preferences
    preferences: 'user/preferences/data',
    preferencesSet: 'user/preferences/set',
    preferencesReset: 'user/preferences/reset',
  },
  system: {
    settings: 'system/settings/list',
    settingsGet: 'system/settings/get',
    settingsSet: 'system/settings/set',
    users: 'system/users/data',
    usersList: 'system/users/list',
    usersGet: 'system/users/get',
    usersCreate: 'system/users/create',
    usersUpdate: 'system/users/update',
    usersDelete: 'system/users/delete',
    usersSuspend: 'system/users/suspend',
    usersActivate: 'system/users/activate',
    usersSessions: 'system/users/sessions',
    usersSessionsRevoke: 'system/users/sessions/revoke',
  },
  domains: {
    data: 'domains/data',
    create: 'domains/create',
    get: 'domains/get',
    update: 'domains/update',
    delete: 'domains/delete',
    routeCreate: 'domains/route/create',
    routeUpdate: 'domains/route/update',
    routeDelete: 'domains/route/delete',
    delegationCreate: 'domains/delegation/create',
    delegationDelete: 'domains/delegation/delete',
    userSearch: 'domains/user/search',
    apps: 'domains/apps',
    entities: 'domains/entities',
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
