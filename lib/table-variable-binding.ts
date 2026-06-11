import type { DynamicColumn, DynamicRow, MatrixTableData } from "@/components/requirement-drawer"

/** 底层存储 token：[[rowId::colId]]，行/列 ID 不变则引用永不过期 */
export const TABLE_VAR_TOKEN_REGEX = /\[\[([^:\]]+)::([^\]]+)\]\]/g

/** Excel 人类可读占位符：{{行首列名::列表头名}} */
export const EXCEL_PLACEHOLDER_REGEX = /\{\{([^:]+)::([^\}]+)\}\}/g

/** 导入时未匹配到的占位符标记 */
const NOT_FOUND_TOKEN_PREFIX = "未找到:"

export interface TableVariableToken {
  rowId: string
  colId: string
}

export interface TableMentionOption {
  rowId: string
  colId: string
  rowLabel: string
  colLabel: string
  cellValue: string
  searchText: string
}

export type ParsedTextPart =
  | { type: "text"; value: string }
  | { type: "token"; rowId: string; colId: string; raw: string }
  | { type: "not_found"; rowName: string; colName: string; raw: string }

const COMBINED_TOKEN_REGEX =
  /\[\[(?:未找到:([^:]+)::([^\]]+)|([^:\]]+)::([^\]]+))\]\]/g

export function createTableVariableToken(rowId: string, colId: string): string {
  return `[[${rowId}::${colId}]]`
}

export function createNotFoundTableVariableToken(rowName: string, colName: string): string {
  return `[[${NOT_FOUND_TOKEN_PREFIX}${rowName.trim()}::${colName.trim()}]]`
}

export function getRowDisplayName(row: DynamicRow, columns: DynamicColumn[]): string {
  const firstCol = columns[0]
  if (firstCol) {
    const val = String(row[firstCol.id] ?? "").trim()
    if (val) return val
  }
  return row.id
}

export function getColumnDisplayName(col: DynamicColumn): string {
  const title = String(col.title ?? "").trim()
  if (title) return title
  const tags = col.tags.filter((t) => t && t !== "all")
  if (tags.length > 0) return tags.join(", ")
  return col.id
}

export function findRowIdByDisplayName(
  tableData: MatrixTableData,
  rowName: string
): string | null {
  const name = rowName.trim()
  if (!name || tableData.columns.length === 0) return null

  const firstCol = tableData.columns[0]
  for (const row of tableData.rows) {
    if (String(row[firstCol.id] ?? "").trim() === name) {
      return row.id
    }
  }
  return null
}

export function findColumnIdByDisplayName(
  tableData: MatrixTableData,
  colName: string
): string | null {
  const name = colName.trim()
  if (!name) return null

  for (const col of tableData.columns) {
    if (String(col.title ?? "").trim() === name) return col.id
  }
  for (const col of tableData.columns) {
    if (getColumnDisplayName(col) === name) return col.id
  }
  return null
}

/** 将 Excel 占位符 {{行名::列名}} 转为 [[rowId::colId]] 或 [[未找到:...]] */
export function convertExcelPlaceholdersToTokens(
  text: string,
  tableData: MatrixTableData | undefined
): string {
  if (!text) return text
  if (!tableData || tableData.columns.length === 0) return text

  return text.replace(EXCEL_PLACEHOLDER_REGEX, (_match, rowName: string, colName: string) => {
    const rowId = findRowIdByDisplayName(tableData, rowName)
    const colId = findColumnIdByDisplayName(tableData, colName)
    if (rowId && colId) {
      return createTableVariableToken(rowId, colId)
    }
    return createNotFoundTableVariableToken(rowName, colName)
  })
}

export function normalizeTestCaseTextFields<
  T extends {
    number: string
    title: string
    precondition: string
    steps: string
    expected: string
  },
>(fields: T, tableData: MatrixTableData | undefined): T {
  return {
    ...fields,
    number: convertExcelPlaceholdersToTokens(fields.number, tableData),
    title: convertExcelPlaceholdersToTokens(fields.title, tableData),
    precondition: convertExcelPlaceholdersToTokens(fields.precondition, tableData),
    steps: convertExcelPlaceholdersToTokens(fields.steps, tableData),
    expected: convertExcelPlaceholdersToTokens(fields.expected, tableData),
  }
}

export function resolveCellValue(
  tableData: MatrixTableData | undefined,
  rowId: string,
  colId: string
): string | null {
  if (!tableData) return null
  const row = tableData.rows.find((r) => r.id === rowId)
  const col = tableData.columns.find((c) => c.id === colId)
  if (!row || !col) return null
  return String(row[colId] ?? "")
}

export function buildTableMentionOptions(tableData: MatrixTableData | undefined): TableMentionOption[] {
  if (!tableData || tableData.columns.length === 0 || tableData.rows.length === 0) {
    return []
  }

  const options: TableMentionOption[] = []
  for (const row of tableData.rows) {
    const rowLabel = getRowDisplayName(row, tableData.columns)
    for (const col of tableData.columns) {
      const colLabel = getColumnDisplayName(col)
      const cellValue = String(row[col.id] ?? "")
      options.push({
        rowId: row.id,
        colId: col.id,
        rowLabel,
        colLabel,
        cellValue,
        searchText: `${rowLabel} ${colLabel} ${cellValue}`.toLowerCase(),
      })
    }
  }
  return options
}

export function filterTableMentionOptions(
  options: TableMentionOption[],
  query: string
): TableMentionOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((opt) => opt.searchText.includes(q))
}

export function parseTextWithTableTokens(text: string): ParsedTextPart[] {
  if (!text) return []

  const parts: ParsedTextPart[] = []
  let lastIndex = 0
  const regex = new RegExp(COMBINED_TOKEN_REGEX.source, "g")
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined && match[2] !== undefined) {
      parts.push({
        type: "not_found",
        rowName: match[1],
        colName: match[2],
        raw: match[0],
      })
    } else if (match[3] !== undefined && match[4] !== undefined) {
      parts.push({
        type: "token",
        rowId: match[3],
        colId: match[4],
        raw: match[0],
      })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) })
  }

  return parts
}

/** 检测光标前的 @ 提及上下文；无有效 @ 时返回 null */
export function detectMentionContext(
  text: string,
  cursor: number
): { start: number; query: string } | null {
  const before = text.slice(0, cursor)
  const match = before.match(/@([^@\n\r]*)$/)
  if (!match) return null
  return {
    start: cursor - match[0].length,
    query: match[1] ?? "",
  }
}
