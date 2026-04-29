"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { History, ChevronRight, Pencil, X, Plus, Trash2, Save, Columns3, ClipboardPaste, Check } from "lucide-react"
import { TestCase } from "@/components/test-execution-dialog"
import { IterationRecord } from "@/components/iteration-history-dialog"

export interface DynamicColumn {
  id: string
  title: string
  tags: string[]
}

export interface DynamicRow {
  id: string
  [key: string]: string
}

export interface MatrixTableData {
  columns: DynamicColumn[]
  rows: DynamicRow[]
}

export interface RequirementDetail {
  id: string
  projectId: string
  category: string
  title: string
  version: string
  status: "todo" | "in-progress" | "done"
  iterations: number
  description: string
  testCases: TestCase[]
  iterationHistory: IterationRecord[]
  // Dynamic content - may or may not exist
  imageUrl?: string
  tableData?: MatrixTableData
}

export interface NewRequirementDefaults {
  projectId: string
  category: string
}

export type DescriptionBlockLevel = 1 | 2 | 3

export interface DescriptionBlock {
  id: string
  text: string
  level: DescriptionBlockLevel
}

export function newDescriptionBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `blk-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function newDescriptionBlock(level: DescriptionBlockLevel = 1): DescriptionBlock {
  return { id: newDescriptionBlockId(), text: "", level }
}

function clampDescriptionLevel(v: unknown): DescriptionBlockLevel {
  const n = Number(v)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

/** 将数据库 content（JSON 字符串）安全解析为块数组；兼容旧纯文本与历史 string[] */
export function parseContentToDescriptionBlocks(raw: string | undefined | null): DescriptionBlock[] {
  const s = String(raw ?? "").trim()
  if (!s) return []
  try {
    const parsed = JSON.parse(s) as unknown
    if (!Array.isArray(parsed)) {
      return [{ id: newDescriptionBlockId(), text: s, level: 1 }]
    }
    if (parsed.length === 0) return []
    if (parsed.every((x) => typeof x === "string")) {
      return (parsed as string[]).map((text) => ({
        id: newDescriptionBlockId(),
        text,
        level: 1 as DescriptionBlockLevel,
      }))
    }
    if (parsed.every((x) => x !== null && typeof x === "object")) {
      return (parsed as Record<string, unknown>[]).map((row) => ({
        id: typeof row.id === "string" && row.id.trim() ? String(row.id) : newDescriptionBlockId(),
        text: row.text != null ? String(row.text) : "",
        level: clampDescriptionLevel(row.level),
      }))
    }
  } catch {
    // 非 JSON：整段作为一条 level 1
  }
  return [{ id: newDescriptionBlockId(), text: s, level: 1 }]
}

export function serializeDescriptionBlocksToContent(blocks: DescriptionBlock[]): string {
  return JSON.stringify(blocks)
}

export function descriptionBlocksHaveVisibleContent(blocks: DescriptionBlock[]): boolean {
  return blocks.some((b) => String(b.text).trim().length > 0)
}

/** 搜索栏拼接用纯文本 */
export function getDescriptionSearchPlainText(raw: string | undefined | null): string {
  return parseContentToDescriptionBlocks(raw)
    .map((b) => b.text)
    .join(" ")
}

/** 仅 Level 1 有可见序号（1. 2. …）；L2/L3 返回空串（无前缀符号）— 供编辑态使用 */
export function computeOutlineLabels(blocks: { level: DescriptionBlockLevel }[]): string[] {
  let n1 = 0
  return blocks.map((b) => {
    const L = Math.min(3, Math.max(1, b.level)) as DescriptionBlockLevel
    if (L === 1) {
      n1++
      return `${n1}.`
    }
    return ""
  })
}

/** 浏览态列表符号：L1 数字；L2 •；L3 ◦（配合固定宽 w-6 悬挂对齐） */
function computeBrowseListMarkers(blocks: { level: DescriptionBlockLevel }[]): string[] {
  let n1 = 0
  return blocks.map((b) => {
    const L = Math.min(3, Math.max(1, b.level)) as DescriptionBlockLevel
    if (L === 1) {
      n1++
      return `${n1}.`
    }
    if (L === 2) return "•"
    return "◦"
  })
}

/** 纯缩进区分层级：L1 顶格，L2/L3 逐级加深 */
function descriptionIndentPl(level: DescriptionBlockLevel): string {
  switch (level) {
    case 1:
      return "pl-0"
    case 2:
      return "pl-6"
    default:
      return "pl-10"
  }
}

/** L1 与正文之间留白；仅 L1 使用 */
function descriptionLevelOneIndexClass(): string {
  return "text-base tabular-nums text-slate-800 shrink-0 min-w-[2rem] text-right leading-relaxed"
}

function descriptionBodyClass(level: DescriptionBlockLevel): string {
  switch (level) {
    case 1:
      return "text-base text-slate-800 leading-relaxed"
    case 2:
      return "text-sm text-slate-600 leading-snug"
    default:
      return "text-xs text-slate-400 leading-snug"
  }
}

/** 浏览态正文：Notion 式嵌套列表用字重与灰度 */
function browseDescriptionBodyClass(level: DescriptionBlockLevel): string {
  switch (level) {
    case 1:
      return "text-base font-semibold text-slate-800 leading-relaxed"
    case 2:
      return "text-base text-slate-700 leading-relaxed"
    default:
      return "text-sm text-slate-600 leading-relaxed"
  }
}

function browseListRowIndent(level: DescriptionBlockLevel): string {
  switch (level) {
    case 1:
      return "ml-0"
    case 2:
      return "ml-5"
    default:
      return "ml-10"
  }
}

/** 固定 w-6 符号列：数字右对齐，圆点居中 */
function browseGlyphSpanClass(level: DescriptionBlockLevel): string {
  switch (level) {
    case 1:
      return "text-right tabular-nums text-base font-semibold text-slate-800"
    case 2:
      return "text-center text-base text-slate-700"
    default:
      return "text-center text-sm text-slate-600"
  }
}

/** L1 分段留白；同一 L1 下的 L2/L3 连续项紧凑 */
function descriptionBlockVerticalSpacing(
  level: DescriptionBlockLevel,
  prevLevel: DescriptionBlockLevel | undefined,
  index: number
): string {
  if (index === 0) {
    return level === 1 ? "mt-0 mb-2" : "mt-0"
  }
  if (level === 1) return "mt-4 mb-2"
  if (prevLevel === 1) return "mt-1"
  return "mt-0.5"
}

const descriptionEditControlClass =
  "border-slate-200 bg-white/80 shadow-none transition-colors hover:border-slate-300/90 hover:bg-slate-50/70 focus-visible:border-slate-300 focus-visible:ring-slate-200/40"

interface RequirementDrawerProps {
  requirement: RequirementDetail | null
  open: boolean
  availableCategories: string[]
  /** 新建模式且 requirement 为 null 时用于生成草稿（projectId / 默认分类） */
  newRequirementDefaults?: NewRequirementDefaults | null
  onOpenChange: (open: boolean) => void
  onSave?: (requirement: RequirementDetail) => void
  onDelete?: (requirementId: string) => void
  isNewRequirement?: boolean
}

function emptyTableData(): MatrixTableData {
  return { columns: [], rows: [] }
}

function createTableColumnId(): string {
  return `col_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`
}

function createTableRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`
}

function normalizeTags(tags: string[]): string[] {
  const next = Array.from(
    new Set(
      tags
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
  return next.length > 0 ? next : ["all"]
}

function inferColumnTagsFromHeader(header: string): string[] {
  const m = header.match(/(?:^|[^\d])(\d{2})(?!\d)/)
  return m?.[1] ? [m[1]] : ["all"]
}

function parseClipboardTextToTableData(raw: string): MatrixTableData | null {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return null

  const matrix = lines.map((line) => line.split("\t"))
  const width = Math.max(...matrix.map((r) => r.length))
  const headerCells = matrix[0] ?? []

  const columns: DynamicColumn[] = Array.from({ length: width }, (_, index) => {
    const rawHeader = (headerCells[index] ?? "").trim()
    const title = rawHeader || `列${index + 1}`
    return {
      id: createTableColumnId(),
      title,
      tags: inferColumnTagsFromHeader(title),
    }
  })

  const rows: DynamicRow[] = matrix.slice(1).map((cells) => {
    const row: DynamicRow = { id: createTableRowId() }
    columns.forEach((col, index) => {
      row[col.id] = cells[index] ?? ""
    })
    return row
  })
  return { columns, rows }
}

function mergeTableDataForImport(existing: MatrixTableData, incoming: MatrixTableData, append: boolean): MatrixTableData {
  if (!append) return incoming

  const mergedColumns: DynamicColumn[] = existing.columns.map((col) => ({ ...col, tags: normalizeTags(col.tags) }))
  const titleToId = new Map<string, string>(mergedColumns.map((col) => [col.title.trim(), col.id]))
  const incomingToTargetId = new Map<string, string>()

  for (const col of incoming.columns) {
    const key = col.title.trim()
    const matchedId = titleToId.get(key)
    if (matchedId) {
      incomingToTargetId.set(col.id, matchedId)
      continue
    }
    const nextCol: DynamicColumn = {
      id: createTableColumnId(),
      title: col.title,
      tags: normalizeTags(col.tags),
    }
    mergedColumns.push(nextCol)
    titleToId.set(nextCol.title.trim(), nextCol.id)
    incomingToTargetId.set(col.id, nextCol.id)
  }

  const normalizeRow = (row: DynamicRow): DynamicRow => {
    const next: DynamicRow = { id: row.id }
    for (const col of mergedColumns) {
      next[col.id] = row[col.id] ?? ""
    }
    return next
  }

  const existingRows = existing.rows.map(normalizeRow)
  const incomingRows = incoming.rows.map((row) => {
    const next: DynamicRow = { id: createTableRowId() }
    for (const col of mergedColumns) {
      next[col.id] = ""
    }
    for (const sourceCol of incoming.columns) {
      const targetId = incomingToTargetId.get(sourceCol.id)
      if (!targetId) continue
      next[targetId] = row[sourceCol.id] ?? ""
    }
    return next
  })

  return { columns: mergedColumns, rows: [...existingRows, ...incomingRows] }
}

function buildNewDraft(defaults: NewRequirementDefaults, draftId: string): RequirementDetail {
  return {
    id: draftId,
    projectId: defaults.projectId,
    category: defaults.category,
    title: "",
    version: "",
    status: "todo",
    iterations: 1,
    description: "",
    testCases: [],
    iterationHistory: [],
    tableData: emptyTableData(),
  }
}

export function RequirementDrawer({
  requirement,
  open,
  availableCategories,
  newRequirementDefaults = null,
  onOpenChange,
  onSave,
  onDelete,
  isNewRequirement = false,
}: RequirementDrawerProps) {
  const availableCategoriesRef = useRef(availableCategories)
  availableCategoriesRef.current = availableCategories

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editVersion, setEditVersion] = useState("")
  const [editDescriptionBlocks, setEditDescriptionBlocks] = useState<DescriptionBlock[]>([])
  const [editCategory, setEditCategory] = useState("")
  const [tableFilter, setTableFilter] = useState("all")
  const [editTableData, setEditTableData] = useState<MatrixTableData>({ columns: [], rows: [] })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState("")
  const [newColumnTags, setNewColumnTags] = useState("all")
  const [showClipboardImport, setShowClipboardImport] = useState(false)
  const [clipboardText, setClipboardText] = useState("")
  const [appendImportedRows, setAppendImportedRows] = useState(false)
  const [editingTagColumnId, setEditingTagColumnId] = useState<string | null>(null)
  const [editingTagValue, setEditingTagValue] = useState("")

  const resetFormState = () => {
    setIsEditing(false)
    setEditTitle("")
    setEditVersion("")
    setEditDescriptionBlocks([])
    setEditCategory("")
    setTableFilter("all")
    setEditTableData(emptyTableData())
    setDeleteDialogOpen(false)
    setNewColumnTitle("")
    setNewColumnTags("all")
    setShowClipboardImport(false)
    setClipboardText("")
    setAppendImportedRows(false)
    setEditingTagColumnId(null)
    setEditingTagValue("")
  }

  const newDraftSessionIdRef = useRef<string>("")

  useEffect(() => {
    if (!open) {
      newDraftSessionIdRef.current = ""
    }
  }, [open])

  const effectiveRequirement: RequirementDetail | null = useMemo(() => {
    if (requirement) return requirement
    if (open && isNewRequirement && newRequirementDefaults) {
      if (!newDraftSessionIdRef.current) {
        newDraftSessionIdRef.current = `tmp-req-${Date.now()}`
      }
      return buildNewDraft(newRequirementDefaults, newDraftSessionIdRef.current)
    }
    return null
  }, [requirement, open, isNewRequirement, newRequirementDefaults])

  const hydrateFieldsFromRequirement = useCallback((req: RequirementDetail) => {
    const cats = availableCategoriesRef.current
    setEditTitle(req.title)
    setEditVersion(req.version ?? "")
    setEditDescriptionBlocks(parseContentToDescriptionBlocks(req.description))
    setEditCategory(req.category || cats[0] || "core")
    if (req.tableData) {
      setEditTableData({
        columns: req.tableData.columns.map((c) => ({ ...c })),
        rows: req.tableData.rows.map((r) => ({ ...r })),
      })
    } else {
      setEditTableData(emptyTableData())
    }
    setTableFilter("all")
  }, [])

  const latestEffectiveRef = useRef<RequirementDetail | null>(null)
  latestEffectiveRef.current = effectiveRequirement

  /** 仅在打开、切换需求 id、或新建/浏览模式切换时回填，避免 Radix open 抖动或父级对象引用变化导致编辑态被清空 */
  useEffect(() => {
    if (!open) return
    const req = latestEffectiveRef.current
    if (!req) return
    hydrateFieldsFromRequirement(req)
    setIsEditing(Boolean(isNewRequirement))
  }, [open, effectiveRequirement?.id, isNewRequirement, hydrateFieldsFromRequirement])

  const prevOpenRef = useRef(open)
  useEffect(() => {
    const prev = prevOpenRef.current
    if (prev && !open) {
      resetFormState()
    }
    prevOpenRef.current = open
  }, [open])

  const enterEditMode = () => {
    const req = latestEffectiveRef.current
    if (!req) return
    hydrateFieldsFromRequirement(req)
    setIsEditing(true)
  }

  const tableDataForRender = isEditing
    ? editTableData
    : (effectiveRequirement?.tableData ?? { columns: [], rows: [] })

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    for (const col of tableDataForRender.columns) {
      for (const tag of col.tags) {
        if (tag.trim()) tags.add(tag.trim())
      }
    }
    if (tags.size === 0) tags.add("all")
    return Array.from(tags)
  }, [tableDataForRender.columns])

  useEffect(() => {
    if (!availableTags.includes(tableFilter)) {
      setTableFilter(availableTags[0] ?? "all")
    }
  }, [availableTags, tableFilter])

  const visibleColumns = useMemo(() => {
    if (tableFilter === "all") return tableDataForRender.columns
    return tableDataForRender.columns.filter((col) => col.tags.includes("all") || col.tags.includes(tableFilter))
  }, [tableDataForRender.columns, tableFilter])

  const browseDescriptionBlocks = useMemo(
    () => parseContentToDescriptionBlocks(effectiveRequirement?.description ?? ""),
    [effectiveRequirement?.description]
  )
  const showBrowseDescription =
    !isEditing && descriptionBlocksHaveVisibleContent(browseDescriptionBlocks)

  const browseBlocksWithText = useMemo(
    () => browseDescriptionBlocks.filter((b) => b.text.trim()),
    [browseDescriptionBlocks]
  )
  const browseListMarkers = useMemo(
    () => computeBrowseListMarkers(browseBlocksWithText),
    [browseBlocksWithText]
  )

  const editOutlineLabels = useMemo(
    () => computeOutlineLabels(editDescriptionBlocks),
    [editDescriptionBlocks]
  )

  const updateBlockText = (index: number, text: string) => {
    setEditDescriptionBlocks((prev) => {
      const next = [...prev]
      if (!next[index]) return prev
      next[index] = { ...next[index], text }
      return next
    })
  }

  const updateBlockLevel = (index: number, level: DescriptionBlockLevel) => {
    setEditDescriptionBlocks((prev) => {
      const next = [...prev]
      if (!next[index]) return prev
      next[index] = { ...next[index], level }
      return next
    })
  }

  const removeDescriptionBlock = (index: number) => {
    setEditDescriptionBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  const addDescriptionBlock = () => {
    setEditDescriptionBlocks((prev) => [...prev, newDescriptionBlock(1)])
  }

  const handleTableCellEdit = (rowIndex: number, columnId: string, value: string) => {
    setEditTableData((prev) => {
      const rows = [...prev.rows]
      rows[rowIndex] = { ...rows[rowIndex], [columnId]: value }
      return { ...prev, rows }
    })
  }

  const handleAddTableRow = () => {
    setEditTableData((prev) => {
      const rowId = createTableRowId()
      const base: DynamicRow = { id: rowId }
      for (const col of prev.columns) {
        base[col.id] = ""
      }
      return { ...prev, rows: [...prev.rows, base] }
    })
  }

  const handleDeleteTableRow = (rowIndex: number) => {
    setEditTableData((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== rowIndex) }))
  }

  const handleAddTableColumn = () => {
    const title = newColumnTitle.trim()
    if (!title) return
    const id = createTableColumnId()
    const tags = newColumnTags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
    const normalizedTags = normalizeTags(tags)

    setEditTableData((prev) => ({
      columns: [...prev.columns, { id, title, tags: normalizedTags }],
      rows: prev.rows.map((row) => ({ ...row, [id]: "" })),
    }))
    setNewColumnTitle("")
    setNewColumnTags("all")
  }

  const handleDeleteTableColumn = (columnId: string) => {
    setEditTableData((prev) => ({
      columns: prev.columns.filter((c) => c.id !== columnId),
      rows: prev.rows.map((row) => {
        const next = { ...row }
        delete next[columnId]
        return next
      }),
    }))
  }

  const handleColumnTitleChange = (columnId: string, title: string) => {
    setEditTableData((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => (col.id === columnId ? { ...col, title } : col)),
    }))
  }

  const startEditColumnTags = (column: DynamicColumn) => {
    setEditingTagColumnId(column.id)
    setEditingTagValue(column.tags.join(", "))
  }

  const commitEditColumnTags = (columnId: string) => {
    const tags = normalizeTags(editingTagValue.split(","))
    setEditTableData((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => (col.id === columnId ? { ...col, tags } : col)),
    }))
    setEditingTagColumnId(null)
    setEditingTagValue("")
  }

  const cancelEditColumnTags = () => {
    setEditingTagColumnId(null)
    setEditingTagValue("")
  }

  const handleClipboardImport = () => {
    const parsed = parseClipboardTextToTableData(clipboardText)
    if (!parsed) return
    setEditTableData((prev) => mergeTableDataForImport(prev, parsed, appendImportedRows))
    setClipboardText("")
    setShowClipboardImport(false)
  }

  const handleSave = () => {
    if (!effectiveRequirement || !onSave) return
    const updatedRequirement: RequirementDetail = {
      ...effectiveRequirement,
      title: editTitle,
      version: editVersion,
      category: editCategory || effectiveRequirement.category,
      description: serializeDescriptionBlocksToContent(editDescriptionBlocks),
      tableData: editTableData,
    }
    onSave(updatedRequirement)
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (!effectiveRequirement || !onDelete) return
    onDelete(effectiveRequirement.id)
    setDeleteDialogOpen(false)
    onOpenChange(false)
  }

  if (!effectiveRequirement) return null

  const accessibilityTitle = effectiveRequirement.title?.trim() || "新建需求"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[95vw] sm:max-w-4xl overflow-y-auto p-0 border-l border-slate-200"
      >
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 p-5 pb-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex-1 min-w-0">
              <SheetTitle className="sr-only">{accessibilityTitle}</SheetTitle>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-semibold h-auto py-1 px-2 -ml-2 border-slate-300 focus:border-sky-500"
                    placeholder="输入需求标题..."
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0">版本号</span>
                    <Input
                      value={editVersion}
                      onChange={(e) => setEditVersion(e.target.value)}
                      className="h-7 text-xs w-32"
                      placeholder="例如：v1.2.0"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-lg font-semibold text-slate-800">
                    {accessibilityTitle}
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-slate-100 text-slate-700 border border-slate-200">
                    {effectiveRequirement.version?.trim() ? effectiveRequirement.version : "未设置版本"}
                  </Badge>
                </div>
              )}
              <SheetDescription className="sr-only">需求详情</SheetDescription>
              
              {!isEditing && effectiveRequirement.iterations > 1 && (
                <button type="button" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-600 transition-colors group mt-2">
                  <History className="w-3 h-3" />
                  <span>迭代 {effectiveRequirement.iterations} 次</span>
                  <ChevronRight className="w-2.5 h-2.5 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                </button>
              )}
            </div>
            
            {!isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  enterEditMode()
                }}
                className="shrink-0 gap-1.5 text-xs h-7"
              >
                <Pencil className="w-3 h-3" />
                编辑
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Content Area */}
        <div className="p-5 space-y-6">
          {/* Description：浏览态无有效内容时整块不渲染 */}
          {(isEditing || showBrowseDescription) && (
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-0.5 h-3 bg-sky-500 rounded-full" />
              需求描述
            </h3>
            {isEditing && (
              <div className="mb-3">
                <Select value={editCategory || availableCategories[0] || "core"} onValueChange={setEditCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="选择需求分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isEditing ? (
              <div className="flex flex-col">
                {editDescriptionBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    className={cn(
                      "flex items-start gap-2.5",
                      descriptionIndentPl(block.level),
                      descriptionBlockVerticalSpacing(
                        block.level,
                        editDescriptionBlocks[index - 1]?.level,
                        index
                      )
                    )}
                  >
                    {block.level === 1 ? (
                      <span
                        className={cn(descriptionLevelOneIndexClass(), "pt-2 select-none")}
                        aria-hidden
                      >
                        {editOutlineLabels[index]}
                      </span>
                    ) : null}
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <Select
                        value={String(block.level)}
                        onValueChange={(v) =>
                          updateBlockLevel(index, Number(v) as DescriptionBlockLevel)
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-9 w-[4.25rem] shrink-0 px-2 text-xs",
                            descriptionEditControlClass
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 级</SelectItem>
                          <SelectItem value="2">2 级</SelectItem>
                          <SelectItem value="3">3 级</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={block.text}
                        onChange={(e) => updateBlockText(index, e.target.value)}
                        rows={Math.min(12, Math.max(2, block.text.split("\n").length + 1))}
                        placeholder="输入描述内容…"
                        className={cn(
                          "min-h-11 flex-1 min-w-0 resize-y py-2",
                          descriptionBodyClass(block.level),
                          descriptionEditControlClass
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-slate-400 hover:text-rose-600"
                      onClick={() => removeDescriptionBlock(index)}
                      aria-label="删除此行"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full h-10 text-xs text-slate-500 hover:text-slate-900 border-0 shadow-none"
                  onClick={addDescriptionBlock}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  添加描述行
                </Button>
              </div>
            ) : (
              <div className="flex flex-col space-y-1.5">
                {browseBlocksWithText.map((b, i) => (
                  <div
                    key={b.id}
                    className={cn(
                      "flex items-start gap-2",
                      browseListRowIndent(b.level),
                      b.level === 1 && i > 0 && "!mt-3"
                    )}
                  >
                    <span
                      className={cn(
                        "w-6 shrink-0 select-none pt-0.5",
                        browseGlyphSpanClass(b.level)
                      )}
                      aria-hidden
                    >
                      {browseListMarkers[i]}
                    </span>
                    <div
                      className={cn(
                        "min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]",
                        browseDescriptionBodyClass(b.level)
                      )}
                    >
                      {b.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {/* Image Section - Conditional Rendering */}
          {effectiveRequirement.imageUrl && !isEditing && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-0.5 h-3 bg-amber-500 rounded-full" />
                示意图
              </h3>
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="aspect-video flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-slate-200 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-xs">需求示意图</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Data Table Section - Conditional Rendering */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-0.5 h-3 bg-emerald-500 rounded-full" />
                关联数据
              </h3>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <Columns3 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  <SelectValue placeholder="选择字段标签" />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEditing && (
              <div className="mb-3 p-3 border border-slate-200 rounded-lg bg-slate-50/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={newColumnTitle}
                    onChange={(e) => setNewColumnTitle(e.target.value)}
                    placeholder="新列名，例如：07广告位"
                    className="h-8 text-xs bg-white"
                  />
                  <Input
                    value={newColumnTags}
                    onChange={(e) => setNewColumnTags(e.target.value)}
                    placeholder="标签：fr07,all"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleAddTableColumn} className="h-8 text-xs gap-1.5">
                    <Plus className="w-3 h-3" />
                    添加列
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowClipboardImport((prev) => !prev)}
                    className="h-8 text-xs gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    从 Excel 粘贴
                  </Button>
                </div>
                {showClipboardImport && (
                  <div className="mt-3 rounded-md border border-sky-200 bg-white p-3 space-y-2">
                    <p className="text-xs text-slate-600">
                      请直接从 Excel 或飞书表格中复制数据并粘贴于此。系统会自动将第一行作为表头（列名）。
                    </p>
                    <Textarea
                      value={clipboardText}
                      onChange={(e) => setClipboardText(e.target.value)}
                      rows={8}
                      placeholder={"示例：\n07广告位\t状态\t负责人\n首页Banner\t进行中\t小王"}
                      className="text-xs bg-white border-slate-200"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                        <Checkbox
                          checked={appendImportedRows}
                          onCheckedChange={(checked) => setAppendImportedRows(Boolean(checked))}
                        />
                        追加到现有数据末尾（不勾选则覆盖当前表格）
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setShowClipboardImport(false)
                            setClipboardText("")
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={handleClipboardImport}
                          disabled={!clipboardText.trim()}
                        >
                          确认导入
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {visibleColumns.map((col, colIndex) => {
                        const minWidthClass =
                          col.title.trim().length <= 6 ? "min-w-[120px]" : "min-w-[150px]"
                        return (
                        <th
                          key={col.id}
                          className={cn(
                            "px-3 py-2 text-left font-medium text-slate-600 whitespace-normal break-words align-top",
                            minWidthClass,
                            colIndex === 0 &&
                              "sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              {isEditing ? (
                                <Input
                                  value={col.title}
                                  onChange={(e) => handleColumnTitleChange(col.id, e.target.value)}
                                  className="w-full min-w-[120px] h-7 text-xs px-2 bg-white border-slate-200"
                                />
                              ) : (
                                <span className="pt-1">{col.title}</span>
                              )}
                              {isEditing && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 text-slate-300 hover:text-rose-400"
                                  onClick={() => handleDeleteTableColumn(col.id)}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </Button>
                              )}
                            </div>
                            {isEditing ? (
                              editingTagColumnId === col.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editingTagValue}
                                    onChange={(e) => setEditingTagValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault()
                                        commitEditColumnTags(col.id)
                                      } else if (e.key === "Escape") {
                                        e.preventDefault()
                                        cancelEditColumnTags()
                                      }
                                    }}
                                    className="w-full min-w-[120px] h-6 text-[10px] px-2 bg-white border-slate-200"
                                    placeholder="逗号分隔标签"
                                    autoFocus
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-emerald-500 hover:text-emerald-600"
                                    onClick={() => commitEditColumnTags(col.id)}
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 bg-white hover:bg-slate-50"
                                  onClick={() => startEditColumnTags(col)}
                                >
                                  {col.tags.join(", ")}
                                </button>
                              )
                            ) : (
                              <div className="text-[10px] text-slate-400 mt-1">{col.tags.join(", ")}</div>
                            )}
                          </div>
                        </th>
                      )})}
                      {isEditing && <th className="px-2 py-2 w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableDataForRender.rows.map((row, rowIndex) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        {visibleColumns.map((col, colIndex) => {
                          const cellValue = String(row[col.id] ?? "")
                          const minWidthClass = cellValue.trim().length <= 10 ? "min-w-[120px]" : "min-w-[150px]"
                          return (
                          <td
                            key={`${row.id}-${col.id}`}
                            className={cn(
                              "px-2 py-1.5 whitespace-normal break-words",
                              minWidthClass,
                              colIndex === 0 && "sticky left-0 bg-white z-10"
                            )}
                          >
                            {isEditing ? (
                              <Input
                                value={row[col.id] ?? ""}
                                onChange={(e) => handleTableCellEdit(rowIndex, col.id, e.target.value)}
                                className="w-full min-w-[120px] h-8 text-xs px-2 bg-white"
                              />
                            ) : (
                              <span className="text-slate-700">{row[col.id] ?? "-"}</span>
                            )}
                          </td>
                        )})}
                        {isEditing && (
                          <td className="px-1 py-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-rose-500"
                              onClick={() => handleDeleteTableRow(rowIndex)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isEditing && (
                <div className="p-2 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddTableRow}
                    className="w-full h-8 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    添加行
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-100 p-4">
          {isEditing ? (
            <div className="flex items-center justify-between gap-3">
              {/* Delete button - only show for existing requirements */}
              {!isNewRequirement && (
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="w-3 h-3" />
                      删除此需求
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-slate-800">
                        <Trash2 className="w-5 h-5 text-rose-500" />
                        确认删除？
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-500">
                        此操作将永久删除需求 &ldquo;<strong className="text-slate-700">{effectiveRequirement.title}</strong>&rdquo;，包括所有测试用例和历史记录。
                        <br />
                        <span className="text-rose-500 text-xs mt-2 block">此操作无法撤销。</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-slate-600">取消</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              <div className="flex-1" />
              
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  if (isNewRequirement) {
                    onOpenChange(false)
                  } else {
                    setIsEditing(false)
                    if (effectiveRequirement) {
                      hydrateFieldsFromRequirement(effectiveRequirement)
                    }
                  }
                }}
                className="text-xs"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!editTitle.trim()}
                className="gap-1.5 text-xs bg-slate-900 hover:bg-slate-800"
              >
                <Save className="w-3 h-3" />
                保存
              </Button>
            </div>
          ) : (
            <div />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
