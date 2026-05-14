"use client"

import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type ClipboardEvent as ReactClipboardEvent,
} from "react"
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
import { cn, uniqueClientId } from "@/lib/utils"
import {
  History,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Pencil,
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  Columns3,
  ClipboardPaste,
  Check,
  ImagePlus,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { stringifyErrorForLog } from "@/lib/stringify-error"
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
  // 需求配图（对应 DB image_urls text[]）
  imageUrls?: string[]
  tableData?: MatrixTableData
}

export interface NewRequirementDefaults {
  projectId: string
  category: string
}

export type DescriptionBlockLevel = 1 | 2 | 3 | 4

export interface DescriptionBlock {
  id: string
  text: string
  level: DescriptionBlockLevel
}

export function newDescriptionBlockId(): string {
  return uniqueClientId("blk")
}

export function newDescriptionBlock(level: DescriptionBlockLevel = 1): DescriptionBlock {
  return { id: newDescriptionBlockId(), text: "", level }
}

function clampDescriptionLevel(v: unknown): DescriptionBlockLevel {
  const n = Math.round(Number(v))
  if (n >= 1 && n <= 4) return n as DescriptionBlockLevel
  if (n === 5) return 4
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

/** 与列表前缀一致（L1 无序号；L2 递增 1. 2. …；L3 •；L4 ◦） */
export function computeOutlineLabels(blocks: { level: DescriptionBlockLevel }[]): string[] {
  return computeBlockListMarkers(blocks)
}

/** 编辑/浏览共用：L1 无前缀（且重置 L2 计数）；L2 在每个 L1 后从 1 重新递增；L3 •；L4 ◦ */
function computeBlockListMarkers(blocks: { level: DescriptionBlockLevel }[]): string[] {
  let n2 = 0
  return blocks.map((b) => {
    const L = Math.min(4, Math.max(1, b.level)) as DescriptionBlockLevel
    if (L === 1) {
      n2 = 0
      return ""
    }
    if (L === 2) {
      n2++
      return `${n2}.`
    }
    if (L === 3) return "•"
    return "◦"
  })
}

/** 浏览模式 L2–L4：剥除用户粘贴自带的列表前缀与缩进（L1 大标题不使用，避免误伤正文） */
function cleanViewListBodyText(raw: string): string {
  return (raw || "")
    .replace(/^[\s\-*•◦\d.]+(?=\s)/, "")
    .replace(/^[\s\-*•◦]+/, "")
    .trim()
}

function descriptionBodyClass(level: DescriptionBlockLevel): string {
  switch (level) {
    case 1:
      return "text-base text-slate-800 leading-relaxed"
    case 2:
      return "text-base font-medium text-slate-700 leading-relaxed"
    case 3:
      return "text-sm font-normal text-slate-600 leading-relaxed"
    case 4:
      return "text-sm font-normal text-slate-500 leading-relaxed"
  }
}

function editBlockGlyphClass(level: DescriptionBlockLevel): string {
  switch (level) {
    case 1:
      return "text-right tabular-nums text-sm font-normal text-slate-400"
    case 2:
      return "text-right tabular-nums text-sm font-medium text-slate-700"
    case 3:
      return "text-center text-sm font-normal text-slate-600"
    case 4:
      return "text-center text-sm font-normal text-slate-500"
  }
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
  /** 仅此路径写库；请返回 Promise 以便抽屉展示保存中并成功后关窗 */
  onSave?: (requirement: RequirementDetail) => void | Promise<void>
  onDelete?: (requirementId: string) => void
  isNewRequirement?: boolean
}

function emptyTableData(): MatrixTableData {
  return { columns: [], rows: [] }
}

/** 行内除 id 外，所有数据列均为空/空白 → 视为无实质内容（保存前剔除脏空行） */
function rowHasNoSubstantiveContent(row: DynamicRow, columnIds: string[]): boolean {
  return columnIds.every((id) => String(row[id] ?? "").trim() === "")
}

export function stripEmptyRowsFromTableData(data: MatrixTableData): MatrixTableData {
  const columnIds = data.columns.map((c) => c.id)
  const rows = data.rows.filter((row) => !rowHasNoSubstantiveContent(row, columnIds))
  return { columns: data.columns, rows }
}

const REQUIREMENT_IMAGES_BUCKET = "requirement-images"

export function normalizeRequirementImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls.map((u) => String(u).trim()).filter(Boolean)
}

function storagePathScopeForRequirement(reqId: string): string {
  const s = String(reqId).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-")
  return (s || "draft").slice(0, 180)
}

/** 用于脏检测：与表单提交字段一致（描述为序列化后的 content 字符串） */
function persistenceFingerprint(
  title: string,
  version: string,
  category: string,
  descriptionSerialized: string,
  tableData: MatrixTableData,
  imageUrls: string[]
): string {
  const stripped = stripEmptyRowsFromTableData(tableData)
  const imgs = [...normalizeRequirementImageUrls(imageUrls)].sort()
  return JSON.stringify({
    title: String(title ?? "").trim(),
    version: String(version ?? "").trim(),
    category: String(category ?? "").trim(),
    description: String(descriptionSerialized ?? ""),
    tableData: stripped,
    imageUrls: imgs,
  })
}

function fingerprintFromRequirement(req: RequirementDetail): string {
  const desc = serializeDescriptionBlocksToContent(parseContentToDescriptionBlocks(req.description))
  return persistenceFingerprint(
    req.title,
    req.version ?? "",
    req.category ?? "",
    desc,
    req.tableData ?? emptyTableData(),
    normalizeRequirementImageUrls(req.imageUrls)
  )
}

function createTableColumnId(): string {
  return uniqueClientId("col")
}

function createTableRowId(): string {
  return uniqueClientId("row")
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

/**
 * 解析 Excel / 飞书 剪贴板 TSV：制表符分列；含换行、制表符的单元格由双引号包裹；
 * 引号内换行不得拆成新行；"" 表示字面双引号。
 */
function parseTsvToMatrix(raw: string): string[][] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === "\t") {
      row.push(field)
      field = ""
      continue
    }
    if (ch === "\n") {
      row.push(field)
      field = ""
      rows.push(row)
      row = []
      continue
    }
    field += ch
  }
  row.push(field)
  rows.push(row)

  while (rows.length > 0 && rows[rows.length - 1].every((c) => String(c).trim() === "")) {
    rows.pop()
  }
  return rows
}

/**
 * 剪贴板矩阵净水：剔除「全格空白」的无效行；各行去掉尾部仅含空白/空串的单元格，
 * 避免 Excel 多框选空列导致幽灵表头列，且不改变行内靠前单元格与列索引对齐。
 */
function cleanPastedTsvMatrix(matrix: string[][]): string[][] {
  return matrix
    .map((row) => row.map((cell) => String(cell ?? "")))
    .map((cells) => {
      let end = cells.length
      while (end > 0 && cells[end - 1].trim() === "") {
        end--
      }
      return cells.slice(0, end)
    })
    .filter((cells) => cells.length > 0 && !cells.every((cell) => cell.trim() === ""))
}

/** 粘贴区：保留浏览器默认粘贴行为；解析在确认导入时用 parseTsvToMatrix */
function handleImportAreaPaste(_e: ReactClipboardEvent<HTMLTextAreaElement>) {
  // 不 preventDefault：让含引号内换行的 TSV 原样进入 textarea
}

/** 覆盖导入：第一行作为表头，其余为数据行 */
function parseClipboardTextToTableData(raw: string): MatrixTableData | null {
  const matrix = cleanPastedTsvMatrix(parseTsvToMatrix(raw))
  if (matrix.length === 0) return null

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

/**
 * 追加导入（基于表头名称的智能映射 + 按行索引合并）：
 * - parsedRows[0]：传入表头；parsedRows[1..]：数据行，第 k 行对应表格第 k 行（0-based）：若 rows[k] 已存在则就地更新映射列，否则在末尾新建行。
 * - 表头名与现有列 title（trim 完全匹配）→ 写入该列 id；同一粘贴块内同一列 id 仅用一次，重复表头名则新建列。
 * - 无匹配则在 columns 末尾新建列；并为所有已有行补齐新列 key（空串），再写入粘贴值。
 */
function mergeTableDataForAppendByHeader(existing: MatrixTableData, parsedRows: string[][]): MatrixTableData {
  const matrix = parsedRows.map((r) => r.map((c) => String(c ?? "")))
  if (matrix.length === 0) return existing

  const headerRow = matrix[0]
  const dataRows = matrix.slice(1)

  let columns: DynamicColumn[] = existing.columns.map((col) => ({
    ...col,
    tags: normalizeTags(col.tags),
  }))

  /** 表头名 -> 当前表中的代表列（用于「是否已有该名列」判断） */
  const titleToRepresentativeCol = new Map<string, DynamicColumn>()
  for (const col of columns) {
    const key = col.title.trim()
    if (!titleToRepresentativeCol.has(key)) {
      titleToRepresentativeCol.set(key, col)
    }
  }

  const usedTitles = new Set(columns.map((c) => c.title.trim()))

  function allocateUniqueColumnTitle(raw: string, colIndex: number): string {
    const base = raw.trim() ? raw.trim() : `未命名列_${colIndex + 1}`
    if (!usedTitles.has(base)) {
      usedTitles.add(base)
      return base
    }
    let i = 2
    let candidate = `${base} (${i})`
    while (usedTitles.has(candidate)) {
      i++
      candidate = `${base} (${i})`
    }
    usedTitles.add(candidate)
    return candidate
  }

  const width = headerRow.length
  const incomingIndexToTargetId: string[] = new Array(width)
  /** 本块粘贴中已为某一「粘贴列索引」分配过的目标列 id，避免重复表头都挤到同一列 */
  const targetIdUsedInThisMapping = new Set<string>()

  for (let j = 0; j < width; j++) {
    const lookupName = (headerRow[j] ?? "").trim()
    let matched = lookupName ? titleToRepresentativeCol.get(lookupName) : undefined
    if (matched && targetIdUsedInThisMapping.has(matched.id)) {
      matched = undefined
    }

    if (matched) {
      incomingIndexToTargetId[j] = matched.id
      targetIdUsedInThisMapping.add(matched.id)
      continue
    }

    const title = allocateUniqueColumnTitle(lookupName, j)
    const newCol: DynamicColumn = {
      id: createTableColumnId(),
      title,
      tags: normalizeTags(inferColumnTagsFromHeader(title)),
    }
    columns.push(newCol)
    incomingIndexToTargetId[j] = newCol.id
    targetIdUsedInThisMapping.add(newCol.id)
  }

  const normalizeRowToAllColumns = (row: DynamicRow): DynamicRow => {
    const next: DynamicRow = { id: row.id }
    for (const col of columns) {
      next[col.id] = row[col.id] ?? ""
    }
    return next
  }

  const nextRows: DynamicRow[] = existing.rows.map(normalizeRowToAllColumns)

  for (let i = 0; i < dataRows.length; i++) {
    const values = dataRows[i]
    if (i < nextRows.length) {
      const prev = nextRows[i]
      const merged: DynamicRow = { ...prev }
      for (let j = 0; j < width; j++) {
        const targetId = incomingIndexToTargetId[j]
        if (!targetId) continue
        merged[targetId] = values[j] ?? ""
      }
      nextRows[i] = merged
    } else {
      const row: DynamicRow = { id: createTableRowId() }
      for (const col of columns) {
        row[col.id] = ""
      }
      for (let j = 0; j < width; j++) {
        const targetId = incomingIndexToTargetId[j]
        if (!targetId) continue
        row[targetId] = values[j] ?? ""
      }
      nextRows.push(row)
    }
  }

  return { columns, rows: nextRows }
}

/** 单格编辑：本地 draft，失焦一次性提交，避免千格受控输入导致整表重绘卡顿 */
function TableMatrixCellEditor({
  initialValue,
  onCommit,
}: {
  initialValue: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(initialValue)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const adjust = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(60, el.scrollHeight)}px`
  }, [])

  useLayoutEffect(() => {
    adjust()
  }, [adjust])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [])

  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onInput={adjust}
      onBlur={() => onCommit(draft)}
      spellCheck={false}
      className={cn(
        "w-full min-w-[120px] min-h-[60px] resize-y rounded-sm",
        "border-0 bg-transparent px-2 py-1.5 text-xs leading-relaxed text-slate-800",
        "shadow-none outline-none ring-2 ring-sky-200/80 ring-offset-0 transition-[height]",
        "focus-visible:ring-2 focus-visible:ring-sky-300/90"
      )}
    />
  )
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
    imageUrls: [],
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
  const [editImageUrls, setEditImageUrls] = useState<string[]>([])
  const [isUploadingGalleryImage, setIsUploadingGalleryImage] = useState(false)
  const galleryFileInputRef = useRef<HTMLInputElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState("")
  const [newColumnTags, setNewColumnTags] = useState("all")
  const [showClipboardImport, setShowClipboardImport] = useState(false)
  const [clipboardText, setClipboardText] = useState("")
  const [appendImportedRows, setAppendImportedRows] = useState(false)
  const [editingTagColumnId, setEditingTagColumnId] = useState<string | null>(null)
  const [editingTagValue, setEditingTagValue] = useState("")
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const saveInFlightRef = useRef(false)
  const [baselineFingerprint, setBaselineFingerprint] = useState("")

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
    setEditingCell(null)
    setEditImageUrls([])
    setIsUploadingGalleryImage(false)
    setIsSaving(false)
    saveInFlightRef.current = false
    setBaselineFingerprint("")
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
    setEditImageUrls(normalizeRequirementImageUrls(req.imageUrls))
    setTableFilter("all")
    setEditingCell(null)
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
    setBaselineFingerprint(fingerprintFromRequirement(req))
  }, [open, effectiveRequirement?.id, isNewRequirement, hydrateFieldsFromRequirement])

  const dirtyFingerprint = useMemo(
    () =>
      persistenceFingerprint(
        editTitle,
        editVersion,
        editCategory || availableCategoriesRef.current[0] || "core",
        serializeDescriptionBlocksToContent(editDescriptionBlocks),
        editTableData,
        editImageUrls
      ),
    [editTitle, editVersion, editCategory, editDescriptionBlocks, editTableData, editImageUrls]
  )

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
    setBaselineFingerprint(fingerprintFromRequirement(req))
    setEditingCell(null)
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

  /** 编辑态展示完整列顺序（含重排）；浏览态仍按标签筛选 */
  const matrixColumns = isEditing ? editTableData.columns : visibleColumns

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
  const editListMarkers = useMemo(
    () => computeBlockListMarkers(editDescriptionBlocks),
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

  const moveDescriptionBlock = (index: number, delta: -1 | 1) => {
    setEditDescriptionBlocks((prev) => {
      const j = index + delta
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[j]
      next[j] = tmp
      return next
    })
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
    const deletedId = editTableData.rows[rowIndex]?.id
    if (deletedId && editingCell?.rowId === deletedId) {
      setEditingCell(null)
    }
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
    setEditingCell((cur) => (cur?.colId === columnId ? null : cur))
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

  const handleMoveColumn = (columnId: string, delta: -1 | 1) => {
    setEditTableData((prev) => {
      const idx = prev.columns.findIndex((c) => c.id === columnId)
      if (idx < 0) return prev
      const nextIdx = idx + delta
      if (nextIdx < 0 || nextIdx >= prev.columns.length) return prev
      const cols = [...prev.columns]
      const [moved] = cols.splice(idx, 1)
      cols.splice(nextIdx, 0, moved)
      return { ...prev, columns: cols }
    })
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
    const raw = clipboardText.trim()
    if (!raw) return
    setEditingCell(null)

    if (appendImportedRows) {
      const matrix = cleanPastedTsvMatrix(parseTsvToMatrix(raw))
      if (matrix.length === 0) return
      setEditTableData((prev) => mergeTableDataForAppendByHeader(prev, matrix))
    } else {
      const parsed = parseClipboardTextToTableData(raw)
      if (!parsed) return
      setEditTableData(parsed)
    }
    setClipboardText("")
    setShowClipboardImport(false)
  }

  const removeGalleryImageAt = useCallback((index: number) => {
    setEditImageUrls((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleGalleryFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件")
      return
    }
    const req = latestEffectiveRef.current
    if (!req) return
    if (saveInFlightRef.current) return

    setIsUploadingGalleryImage(true)
    try {
      const scope = storagePathScopeForRequirement(req.id)
      const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^\w]/g, "") || "jpg"
      const objectName = `${scope}/${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`
      const { error } = await supabase.storage.from(REQUIREMENT_IMAGES_BUCKET).upload(objectName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      })
      if (error) throw error
      const { data: pub } = supabase.storage.from(REQUIREMENT_IMAGES_BUCKET).getPublicUrl(objectName)
      if (!pub?.publicUrl) throw new Error("无法生成图片访问地址")
      setEditImageUrls((prev) => [...prev, pub.publicUrl])
    } catch (err: unknown) {
      console.error("Requirement image upload:", stringifyErrorForLog(err))
      toast.error("上传失败", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsUploadingGalleryImage(false)
    }
  }, [])

  const performSaveAndClose = useCallback(async () => {
    const req = latestEffectiveRef.current
    if (!req) {
      onOpenChange(false)
      return
    }
    if (!onSave) {
      onOpenChange(false)
      return
    }
    if (saveInFlightRef.current) return

    if (!editTitle.trim()) {
      toast.error("请填写需求标题后再保存")
      return
    }

    if (dirtyFingerprint === baselineFingerprint) {
      onOpenChange(false)
      return
    }

    saveInFlightRef.current = true
    setIsSaving(true)
    setEditingCell(null)
    try {
      const tableToPersist = stripEmptyRowsFromTableData(editTableData)
      setEditTableData(tableToPersist)
      const updatedRequirement: RequirementDetail = {
        ...req,
        title: editTitle.trim(),
        version: editVersion,
        category: editCategory || req.category,
        description: serializeDescriptionBlocksToContent(editDescriptionBlocks),
        tableData: tableToPersist,
        imageUrls: normalizeRequirementImageUrls(editImageUrls),
      }
      await Promise.resolve(onSave(updatedRequirement))
      onOpenChange(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error("保存失败", { description: msg })
    } finally {
      saveInFlightRef.current = false
      setIsSaving(false)
    }
  }, [
    onSave,
    onOpenChange,
    dirtyFingerprint,
    baselineFingerprint,
    editTitle,
    editVersion,
    editCategory,
    editDescriptionBlocks,
    editTableData,
    editImageUrls,
  ])

  const handleRequirementSheetOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true)
        return
      }
      if (saveInFlightRef.current) {
        toast.info("正在保存，请稍候…")
        return
      }
      void performSaveAndClose()
    },
    [onOpenChange, performSaveAndClose]
  )

  const handleDelete = () => {
    if (saveInFlightRef.current) return
    if (!effectiveRequirement || !onDelete) return
    onDelete(effectiveRequirement.id)
    setDeleteDialogOpen(false)
    onOpenChange(false)
  }

  if (!effectiveRequirement) return null

  const accessibilityTitle = effectiveRequirement.title?.trim() || "新建需求"

  return (
    <Sheet open={open} onOpenChange={handleRequirementSheetOpenChange}>
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
                    className="flex items-start gap-2 bg-slate-50/50 border border-slate-100 rounded-md p-1.5 mb-2"
                  >
                    <span
                      className={cn(
                        "w-7 shrink-0 select-none pt-2",
                        editBlockGlyphClass(block.level)
                      )}
                      aria-hidden
                    >
                      {editListMarkers[index]}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-200 rounded p-1 disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveDescriptionBlock(index, -1)}
                          aria-label="上移"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-200 rounded p-1 disabled:opacity-30"
                          disabled={index === editDescriptionBlocks.length - 1}
                          onClick={() => moveDescriptionBlock(index, 1)}
                          aria-label="下移"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Select
                          value={String(block.level)}
                          onValueChange={(v) =>
                            updateBlockLevel(index, Number(v) as DescriptionBlockLevel)
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              "h-9 w-[4.75rem] shrink-0 px-2 text-xs",
                              descriptionEditControlClass
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 级</SelectItem>
                            <SelectItem value="2">2 级</SelectItem>
                            <SelectItem value="3">3 级</SelectItem>
                            <SelectItem value="4">4 级</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        value={block.text}
                        onChange={(e) => updateBlockText(index, e.target.value)}
                        rows={Math.min(12, Math.max(2, block.text.split("\n").length + 1))}
                        placeholder="输入描述内容…"
                        className={cn(
                          "min-h-11 w-full resize-y py-2",
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
              <div className="flex flex-col">
                {(() => {
                  let l2Counter = 0
                  return browseBlocksWithText.map((b, index) => {
                    const L = Math.min(4, Math.max(1, b.level)) as DescriptionBlockLevel
                    const bodyClass =
                      "min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere] leading-loose"
                    if (L === 1) {
                      l2Counter = 0
                      return (
                        <div
                          key={b.id}
                          className={cn(
                            "mt-6 mb-3 text-lg font-semibold text-slate-900 tracking-tight leading-loose",
                            index === 0 && "!mt-0"
                          )}
                        >
                          {b.text ?? ""}
                        </div>
                      )
                    }
                    const cleanText = cleanViewListBodyText(b.text || "")
                    if (L === 2) {
                      l2Counter += 1
                      return (
                        <div
                          key={b.id}
                          className="mt-3 flex items-start gap-2 text-base leading-loose text-slate-800"
                        >
                          <span
                            className="w-6 shrink-0 self-start select-none text-right tabular-nums text-base leading-loose text-slate-400 font-normal no-underline pt-[2px]"
                            aria-hidden
                          >
                            {l2Counter}.
                          </span>
                          <div className={bodyClass}>{cleanText}</div>
                        </div>
                      )
                    }
                    if (L === 3) {
                      return (
                        <div
                          key={b.id}
                          className="mt-2 ml-7 flex items-start gap-2 text-sm leading-loose text-slate-600"
                        >
                          <span
                            className="w-5 shrink-0 self-start select-none text-center text-sm leading-loose text-slate-400 font-normal pt-[2px]"
                            aria-hidden
                          >
                            •
                          </span>
                          <div className={bodyClass}>{cleanText}</div>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={b.id}
                        className="mt-2 ml-12 flex items-start gap-2 text-sm leading-loose text-slate-500"
                      >
                        <span
                          className="w-5 shrink-0 self-start select-none text-center text-sm leading-loose text-slate-400 font-normal pt-[2px]"
                          aria-hidden
                        >
                          ◦
                        </span>
                        <div className={bodyClass}>{cleanText}</div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </section>
          )}

          {/* 需求配图：浏览态有图才显示 */}
          {!isEditing && normalizeRequirementImageUrls(effectiveRequirement.imageUrls).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-0.5 h-3 bg-amber-500 rounded-full" />
                需求配图
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {normalizeRequirementImageUrls(effectiveRequirement.imageUrls).map((url, i) => (
                  <a
                    key={`${url}-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200/80 transition-shadow hover:shadow-md hover:ring-amber-200/60"
                  >
                    <img
                      src={url}
                      alt=""
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* 需求配图：编辑态 */}
          {isEditing && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-0.5 h-3 bg-amber-500 rounded-full" />
                需求配图
              </h3>
              <input
                ref={galleryFileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleGalleryFileChange}
              />
              <div className="grid grid-cols-2 gap-4">
                {editImageUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200/80"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => removeGalleryImageAt(idx)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white shadow-sm transition-colors hover:bg-rose-600/90 disabled:opacity-40"
                      aria-label="删除图片"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={isSaving || isUploadingGalleryImage}
                  onClick={() => galleryFileInputRef.current?.click()}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 transition-colors hover:border-amber-300 hover:bg-amber-50/50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploadingGalleryImage ? (
                    <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
                  )}
                  <span className="font-medium text-slate-600">上传图片</span>
                </button>
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
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {appendImportedRows ? (
                        <>
                          <span className="font-medium text-slate-700">追加模式：</span>
                          剪贴板<strong>第一行为列名</strong>，与当前表格列名<strong>完全匹配（trim 后）</strong>的列会合并写入同一列；
                          未匹配的列名会在表尾<strong>自动新建列</strong>（标签按列名智能推断，兜底为 all）。从<strong>第二行起</strong>
                          为数据行：第 1 行粘贴数据对齐表格第 1 行并<strong>就地合并</strong>，仅当粘贴行数超过现有行数时才在底部<strong>新增行</strong>；旧行会自动带上新列（空或粘贴值）。
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-slate-700">覆盖模式：</span>
                          请粘贴含表头的矩形区域；系统会将<strong>第一行作为列名</strong>，从第二行起导入为数据，并
                          <strong>替换</strong>当前整张表。
                        </>
                      )}
                    </p>
                    <Textarea
                      value={clipboardText}
                      onChange={(e) => setClipboardText(e.target.value)}
                      onPaste={handleImportAreaPaste}
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

            <div className="rounded-lg border border-slate-200 overflow-hidden flex flex-col min-h-0">
              <div className="max-h-[min(60vh,600px)] overflow-auto min-h-0">
                <table className="w-full text-xs border-collapse">
                  <thead className="border-b border-slate-200">
                    <tr>
                      {matrixColumns.map((col, colIndex) => {
                        const minWidthClass =
                          col.title.trim().length <= 6 ? "min-w-[120px]" : "min-w-[150px]"
                        const isFirstCol = colIndex === 0
                        const isLastCol = colIndex === matrixColumns.length - 1
                        return (
                        <th
                          key={col.id}
                          className={cn(
                            "px-3 py-2 text-left font-medium text-slate-600 whitespace-normal break-words align-top",
                            "sticky top-0 bg-slate-50 shadow-sm",
                            isFirstCol
                              ? "left-0 z-30 border-r border-slate-200 shadow-[2px_2px_4px_-2px_rgba(0,0,0,0.06)]"
                              : "z-20",
                            minWidthClass
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                {isEditing ? (
                                  <>
                                    <div className="flex items-center shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                                        disabled={isFirstCol}
                                        onClick={() => handleMoveColumn(col.id, -1)}
                                        title="左移"
                                      >
                                        <ChevronLeft className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                                        disabled={isLastCol}
                                        onClick={() => handleMoveColumn(col.id, 1)}
                                        title="右移"
                                      >
                                        <ChevronRight className="w-3 h-3" />
                                      </Button>
                                    </div>
                                    <Input
                                      value={col.title}
                                      onChange={(e) => handleColumnTitleChange(col.id, e.target.value)}
                                      className="h-7 text-xs px-2 bg-white border-slate-200 flex-1 min-w-[72px]"
                                    />
                                  </>
                                ) : (
                                  <span className="pt-1">{col.title}</span>
                                )}
                              </div>
                              {isEditing && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 shrink-0 text-slate-300 hover:text-rose-400"
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
                      {isEditing && (
                        <th className="sticky top-0 right-0 z-[25] w-10 px-2 py-2 bg-slate-50 shadow-sm border-l border-slate-200" />
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableDataForRender.rows.map((row, rowIndex) => (
                      <tr
                        key={row.id}
                        className="group/row hover:bg-slate-50/50 transition-colors"
                      >
                        {matrixColumns.map((col, colIndex) => {
                          const cellValue = String(row[col.id] ?? "")
                          const minWidthClass = cellValue.trim().length <= 10 ? "min-w-[120px]" : "min-w-[150px]"
                          return (
                          <td
                            key={`${row.id}-${col.id}`}
                            className={cn(
                              "px-2 py-1.5 align-top whitespace-normal break-words bg-white",
                              minWidthClass,
                              colIndex === 0 &&
                                "sticky left-0 z-10 border-r border-slate-200 group-hover/row:bg-slate-50/50"
                            )}
                          >
                            {isEditing ? (
                              editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                                <TableMatrixCellEditor
                                  key={`${row.id}-${col.id}`}
                                  initialValue={String(row[col.id] ?? "")}
                                  onCommit={(value) => {
                                    handleTableCellEdit(rowIndex, col.id, value)
                                    setEditingCell(null)
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className={cn(
                                    "w-full min-h-[52px] text-left rounded-sm px-2 py-1.5 text-xs leading-relaxed text-slate-800",
                                    "hover:bg-slate-50 cursor-text transition-colors",
                                    "border border-transparent hover:border-slate-200/70"
                                  )}
                                  onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
                                >
                                  <span className="block whitespace-pre-wrap break-words">
                                    {cellValue.trim() === "" ? (
                                      <span className="text-slate-300 select-none">&nbsp;</span>
                                    ) : (
                                      cellValue
                                    )}
                                  </span>
                                </button>
                              )
                            ) : (
                              <span className="whitespace-pre-wrap break-words text-slate-700">
                                {String(row[col.id] ?? "").trim() === "" ? "-" : String(row[col.id] ?? "")}
                              </span>
                            )}
                          </td>
                        )})}
                        {isEditing && (
                          <td className="sticky right-0 z-[15] px-1 py-1 bg-white border-l border-slate-100 group-hover/row:bg-slate-50/50">
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
                      <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                        <Trash2 className="w-5 h-5" />
                        数据安全警告：隐藏此需求
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-600">
                        <div className="space-y-2">
                          <div>
                            确定要删除需求<strong className="text-slate-900">「{effectiveRequirement.title}」</strong>吗？该需求及其关联数据将在界面中<strong className="text-rose-600">永久隐藏</strong>
                            （数据库软删除），列表中不再展示；测试用例与迭代记录仍保留在库中，但无法从本应用查看，直至管理员在数据库中处理。
                          </div>
                          <div className="text-xs text-rose-600">只有点击下方红色按钮才会执行隐藏操作。</div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-slate-600">取消</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        className="bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        确认隐藏需求（软删除）
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
                disabled={isSaving}
                onClick={() => {
                  if (saveInFlightRef.current) return
                  onOpenChange(false)
                }}
                className="text-xs"
              >
                取消
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={() => void performSaveAndClose()}
                disabled={isSaving || !editTitle.trim()}
                className="gap-1.5 text-xs bg-slate-900 hover:bg-slate-800"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    保存
                  </>
                )}
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
