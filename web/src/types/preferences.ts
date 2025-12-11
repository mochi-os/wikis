export interface PreferenceSchema {
  key: string
  type: 'select' | 'timezone'
  options?: string[]
  default: string
  label: string
  description: string
}

export interface PreferencesData {
  preferences: Record<string, string>
  schema: PreferenceSchema[]
}
