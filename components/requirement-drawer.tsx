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
import { Input } from "@/components/ui/input"
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
import { History, ChevronRight, Pencil, X, Plus, Trash2, Save, Columns3 } from "lucide-react"
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
  const [editDescription, setEditDescription] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [tableFilter, setTableFilter] = useState("all")
  const [editTableData, setEditTableData] = useState<MatrixTableData>({ columns: [], rows: [] })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState("")
  const [newColumnTags, setNewColumnTags] = useState("all")

  const resetFormState = () => {
    setIsEditing(false)
    setEditTitle("")
    setEditVersion("")
    setEditDescription("")
    setEditCategory("")
    setTableFilter("all")
    setEditTableData(emptyTableData())
    setDeleteDialogOpen(false)
    setNewColumnTitle("")
    setNewColumnTags("all")
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
    setEditDescription(req.description)
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

  const handleTableCellEdit = (rowIndex: number, columnId: string, value: string) => {
    setEditTableData((prev) => {
      const rows = [...prev.rows]
      rows[rowIndex] = { ...rows[rowIndex], [columnId]: value }
      return { ...prev, rows }
    })
  }

  const handleAddTableRow = () => {
    setEditTableData((prev) => {
      const rowId = `row_${Date.now()}`
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
    const id = `col_${Date.now()}`
    const tags = newColumnTags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
    const normalizedTags = tags.length > 0 ? tags : ["all"]

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

  const handleSave = () => {
    if (!effectiveRequirement || !onSave) return
    const updatedRequirement: RequirementDetail = {
      ...effectiveRequirement,
      title: editTitle,
      version: editVersion,
      category: editCategory || effectiveRequirement.category,
      description: editDescription,
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
          {/* Description Section */}
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
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full min-h-32 p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-y"
                placeholder="输入需求详情..."
              />
            ) : (
              <div className="prose prose-sm prose-slate max-w-none">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {effectiveRequirement.description}
                </p>
              </div>
            )}
          </section>

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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                  <Button size="sm" onClick={handleAddTableColumn} className="h-8 text-xs gap-1.5">
                    <Plus className="w-3 h-3" />
                    添加列
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {visibleColumns.map((col) => (
                        <th key={col.id} className="px-3 py-2 text-left font-medium text-slate-600">
                          <div className="flex items-center justify-between gap-2">
                            <span>{col.title}</span>
                            {isEditing && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-slate-400 hover:text-rose-500"
                                onClick={() => handleDeleteTableColumn(col.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">{col.tags.join(", ")}</div>
                        </th>
                      ))}
                      {isEditing && <th className="px-2 py-2 w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableDataForRender.rows.map((row, rowIndex) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        {visibleColumns.map((col) => (
                          <td key={`${row.id}-${col.id}`} className="px-2 py-1.5">
                            {isEditing ? (
                              <Input
                                value={row[col.id] ?? ""}
                                onChange={(e) => handleTableCellEdit(rowIndex, col.id, e.target.value)}
                                className="h-8 text-xs px-2 bg-white"
                              />
                            ) : (
                              <span className="text-slate-700">{row[col.id] ?? "-"}</span>
                            )}
                          </td>
                        ))}
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
