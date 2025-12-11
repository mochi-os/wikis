export interface SystemSetting {
  name: string
  value: string
  default: string
  description: string
  pattern: string
  user_readable: boolean
  read_only: boolean
  public: boolean
}

export interface SystemSettingsData {
  settings: SystemSetting[]
}
