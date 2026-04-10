export type SelectValue = string | number | boolean | null

export interface SelectOption {
  label: string
  value: SelectValue
  disabled?: boolean
  description?: string
}

export interface SelectOptionGroup {
  label: string
  options: SelectOption[]
}

export type SelectOptionEntry = SelectOption | SelectOptionGroup

export const isSelectOptionGroup = (
  entry: SelectOptionEntry,
): entry is SelectOptionGroup => {
  return 'options' in entry
}
