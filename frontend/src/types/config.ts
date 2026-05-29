export interface PQModel {
  name: string
  is_builtin: boolean
  has_config: boolean
  created_at: string | null
}

export interface ColumnInfo {
  raw_name: string
  slug: string
  matched_to: string | null
  match_source: 'saved' | 'auto' | 'unmatched'
  sample_values: string[]
  sheets: string[]          // which sheet(s) this column appears in
}

export interface InspectResponse {
  model: string
  filename: string
  sheets_found: string[]    // all sheet/page names read
  total_columns: number
  unmatched_count: number
  columns: ColumnInfo[]
  standard_columns: string[]
}

export interface ColumnMapping {
  standard_column: string
  source_page?: string | null
}

export interface MappingsResponse {
  model: string
  mappings: Record<string, string | ColumnMapping>
}
