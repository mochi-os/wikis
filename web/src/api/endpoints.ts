const endpoints = {
  // Cross-app endpoints (proxied via wikis backend)
  users: {
    search: '-/users/search',
  },
  groups: {
    list: '-/groups',
  },
  auth: {
    code: '/_/code',
    verify: '/_/verify',
    identity: '/_/identity',
    logout: '/_/logout',
  },
  wiki: {
    // Info
    info: '-/info',
    create: '-/create',
    join: '-/subscribe',
    directorySearch: '-/directory/search',
    recommendations: '-/recommendations',
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
    // RSS
    rssToken: 'rss/token',
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
} as const

export type Endpoints = typeof endpoints

export default endpoints
