"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, uniqueClientId } from "@/lib/utils"
import { GitCommit, Loader2, Plus, Pencil, Trash2, X, Save } from "lucide-react"
import { toast } from "sonner"
import { stringifyErrorForLog, supabaseErrorMessage } from "@/lib/stringify-error"

export interface IterationRecord {
  id: string
  version: string
  changes: string
}

interface IterationHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requirementId: string
  title: string
  iterations: IterationRecord[]
  onCommitIterations?: (requirementId: string, iterations: IterationRecord[]) => Promise<void> | void
}

export function IterationHistoryDialog({
  open,
  onOpenChange,
  requirementId,
  title,
  iterations,
  onCommitIterations,
}: IterationHistoryDialogProps) {
  const [localIterations, setLocalIterations] = useState<IterationRecord[]>(iterations)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ version: "", changes: "" })
  const [isAdding, setIsAdding] = useState(false)
  const [addForm, setAddForm] = useState({ version: "", changes: "" })
  const [isSavingOnClose, setIsSavingOnClose] = useState(false)
  const snapshot = (rows: IterationRecord[]) =>
    JSON.stringify(rows.map((r) => ({ id: r.id, version: r.version, changes: r.changes })))
  const [initialSnapshot, setInitialSnapshot] = useState<string>(snapshot(iterations))
  const hasUnsavedChanges = useMemo(
    () => snapshot(localIterations) !== initialSnapshot,
    [localIterations, initialSnapshot]
  )

  // 抽屉打开时按外部迭代记录内容强制同步（指纹避免仅数组引用不变时漏刷新）
  const externalIterationsFingerprint = snapshot(iterations)
  useEffect(() => {
    if (!open) return
    setLocalIterations(iterations.map((r) => ({ ...r })))
    setInitialSnapshot(snapshot(iterations))
    setEditingId(null)
    setIsAdding(false)
    setAddForm({ version: "", changes: "" })
  }, [open, externalIterationsFingerprint])

  const handleEdit = (record: IterationRecord) => {
    setEditingId(record.id)
    setEditForm({ version: record.version, changes: record.changes })
    setIsAdding(false)
  }

  const handleSaveEdit = () => {
    if (editingId === null) return
    const updated = localIterations.map(r =>
      r.id === editingId
        ? { ...r, version: editForm.version, changes: editForm.changes }
        : r
    )
    setLocalIterations(updated)
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    const updated = localIterations.filter(r => r.id !== id)
    setLocalIterations(updated)
  }

  const handleAddNew = () => {
    if (!addForm.version.trim()) return
    const newRecord: IterationRecord = {
      id: uniqueClientId("tmp-iter"),
      version: addForm.version.trim(),
      changes: addForm.changes || "无详细变更内容",
    }
    const updated = [newRecord, ...localIterations]
    setLocalIterations(updated)
    setIsAdding(false)
    setAddForm({ version: "", changes: "" })
  }

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!open || !hasUnsavedChanges) return
      e.preventDefault()
      e.returnValue = "您有未保存的更改，确定要离开吗？"
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [open, hasUnsavedChanges])

  const localIterationsRef = useRef(localIterations)
  const initialSnapshotRef = useRef(initialSnapshot)
  useEffect(() => {
    localIterationsRef.current = localIterations
    initialSnapshotRef.current = initialSnapshot
  }, [localIterations, initialSnapshot])

  const performDismiss = useCallback(() => {
    const rid = requirementId
    const rowsCopy = localIterationsRef.current.map((r) => ({ ...r }))
    const dirty = snapshot(rowsCopy) !== initialSnapshotRef.current

    if (dirty) {
      const ok = window.confirm(
        "有未保存的更改。确定关闭？将尝试在后台自动保存；若失败会弹出提示，您可稍后重新打开再试。"
      )
      if (!ok) return
    }

    onOpenChange(false)

    if (dirty && rid && onCommitIterations) {
      void Promise.resolve(onCommitIterations(rid, rowsCopy)).catch((err: unknown) => {
        console.error("Iteration history background save failed:", stringifyErrorForLog(err))
        toast.error("保存失败", {
          description: supabaseErrorMessage(err),
        })
      })
    }
  }, [requirementId, onOpenChange, onCommitIterations])

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true)
        return
      }
      performDismiss()
    },
    [onOpenChange, performDismiss]
  )

  const handleSaveAndClose = useCallback(async () => {
    if (!requirementId) {
      toast.error("无法保存", { description: "缺少需求 ID" })
      onOpenChange(false)
      return
    }
    if (!hasUnsavedChanges) {
      onOpenChange(false)
      return
    }
    if (!onCommitIterations) {
      onOpenChange(false)
      return
    }
    setIsSavingOnClose(true)
    try {
      await onCommitIterations(requirementId, localIterations)
      setInitialSnapshot(snapshot(localIterations))
      onOpenChange(false)
    } catch (err: unknown) {
      console.error("Iteration history save failed:", stringifyErrorForLog(err))
      toast.error("保存失败", {
        description: supabaseErrorMessage(err),
      })
    } finally {
      setIsSavingOnClose(false)
    }
  }, [requirementId, hasUnsavedChanges, localIterations, onCommitIterations, onOpenChange])

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        side="right"
        className={cn("w-[95vw] sm:max-w-4xl p-0 overflow-hidden flex flex-col", isSavingOnClose && "opacity-90")}
      >
        <SheetHeader className="pb-4 border-b border-slate-100 shrink-0">
          <SheetTitle className="sr-only">{title || "迭代历史"}</SheetTitle>
          <div className="flex items-center justify-between text-slate-800 px-4 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg shadow-sm">
                <GitCommit className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold">迭代历史</span>
            </div>
            <div className="flex items-center gap-2">
              {!isAdding && (
                <Button
                  size="sm"
                  onClick={() => { setIsAdding(true); setEditingId(null) }}
                  disabled={isSavingOnClose}
                  className="gap-1.5 text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增记录
                </Button>
              )}
              {isSavingOnClose && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  保存中...
                </div>
              )}
            </div>
          </div>
          <SheetDescription className="text-slate-500 line-clamp-1 mt-1 px-4">
            {title}
          </SheetDescription>
        </SheetHeader>
        
        {/* Add new record form */}
        {isAdding && (
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-sky-700">新增迭代记录</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => { setIsAdding(false); setAddForm({ version: "", changes: "" }) }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <Input
                value={addForm.version}
                onChange={(e) => setAddForm({ ...addForm, version: e.target.value })}
                placeholder="版本号，例如：v1.2.0"
                className="h-9 text-sm bg-white/80 border-sky-200 focus:border-sky-400"
              />
              <textarea
                value={addForm.changes}
                onChange={(e) => setAddForm({ ...addForm, changes: e.target.value })}
                placeholder="详细变更内容..."
                className="w-full h-20 p-3 text-sm border border-sky-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 bg-white/80 transition-all duration-200"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsAdding(false); setAddForm({ version: "", changes: "" }) }}
                  className="h-8 text-sm px-4"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNew}
                  disabled={!addForm.version.trim()}
                  className="h-8 text-sm px-4 gap-1.5 bg-slate-900 hover:bg-slate-800"
                >
                  <Save className="w-3.5 h-3.5" />
                  保存
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Timeline */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2 mt-4 px-4">
          <div className="relative pl-10 pb-2 pr-2">
            {/* Timeline line - thinner, lighter */}
            <div className="absolute left-[11px] top-4 bottom-4 w-[1px] bg-gradient-to-b from-sky-300 via-slate-200 to-slate-100" />
            
            {localIterations.map((record, index) => (
              <div 
                key={record.id}
                className={cn(
                  "group/card relative mb-5 last:mb-0",
                  "animate-in fade-in slide-in-from-left-2 duration-300"
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Timeline dot - enhanced */}
                <div className={cn(
                  "absolute -left-8 top-3 flex items-center justify-center transition-all duration-300",
                  index === 0 ? "scale-100" : "scale-90"
                )}>
                  {index === 0 ? (
                    // Latest - solid with glow effect
                    <div className="relative">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 shadow-md flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-sky-400/40 blur-md animate-pulse" />
                    </div>
                  ) : (
                    // Older versions - hollow dot
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white transition-all duration-200 group-hover/card:border-slate-400 group-hover/card:scale-110" />
                  )}
                </div>
                
                {/* Content card - enhanced with hover effects */}
                <div className={cn(
                  "rounded-xl p-6 border transition-all duration-300",
                  "hover:shadow-lg hover:-translate-y-0.5",
                  index === 0 
                    ? "bg-gradient-to-br from-sky-50 to-blue-50/50 border-sky-200 shadow-sm" 
                    : "bg-gray-50 border-slate-200 hover:border-slate-300 hover:bg-white",
                  editingId === record.id && "ring-2 ring-sky-500/30 shadow-md"
                )}>
                  {editingId === record.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">版本号</label>
                        <Input
                          value={editForm.version}
                          onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                          placeholder="版本号，例如：v1.2.0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-500 uppercase mb-1 block">详细变更内容</label>
                        <textarea
                          value={editForm.changes}
                          onChange={(e) => setEditForm({ ...editForm, changes: e.target.value })}
                          placeholder="详细变更内容..."
                          className="w-full h-20 p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="h-8 text-sm px-4"
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          className="h-8 text-sm px-4 gap-1.5 bg-slate-900 hover:bg-slate-800"
                        >
                          <Save className="w-3.5 h-3.5" />
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-slate-800">
                          {record.version?.trim() ? record.version : "未设置版本"}
                        </div>
                      </div>
                      
                      {/* Changes */}
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {record.changes}
                      </p>

                      {/* Action buttons - hover to show */}
                      <div className={cn(
                        "flex items-center justify-end gap-1 mt-3 pt-3 border-t border-slate-100",
                        "opacity-0 group-hover/card:opacity-100 transition-opacity duration-200"
                      )}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-400 hover:text-sky-600 hover:bg-sky-50 gap-1.5 transition-all duration-200"
                          onClick={() => handleEdit(record)}
                        >
                          <Pencil className="w-3 h-3" />
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-50 gap-1.5 transition-all duration-200"
                          onClick={() => handleDelete(record.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {localIterations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                  <GitCommit className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500 mb-3">暂无迭代记录</p>
                <Button
                  size="sm"
                  onClick={() => setIsAdding(true)}
                  className="gap-1.5 text-sm h-9 px-4 bg-slate-900 hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  添加首条记录
                </Button>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t border-slate-100 bg-white shrink-0 flex flex-row flex-wrap items-center justify-end gap-2 px-4 py-3 mt-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={performDismiss}
          >
            关闭
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white"
            disabled={isSavingOnClose || !hasUnsavedChanges || !onCommitIterations}
            onClick={() => void handleSaveAndClose()}
          >
            {isSavingOnClose ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            保存并关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
