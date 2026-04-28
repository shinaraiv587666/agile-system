"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { 
  FlaskConical, 
  CheckCircle2, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Save,
  ChevronDown,
  ListChecks
} from "lucide-react"

// 5-field test case structure
export interface TestCase {
  id: string
  number: string       // 编号
  title: string        // 标题
  precondition: string // 前置条件
  steps: string        // 步骤
  expected: string     // 预期结果
  checked: boolean
}

interface TestExecutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requirementId: string
  requirementTitle: string
  testCases: TestCase[]
  onTestCasesChange: (testCases: TestCase[]) => void
  onAllComplete: (allComplete: boolean) => void
}

export function TestExecutionDialog({
  open,
  onOpenChange,
  requirementId,
  requirementTitle,
  testCases,
  onTestCasesChange,
  onAllComplete,
}: TestExecutionDialogProps) {
  const [localCases, setLocalCases] = useState<TestCase[]>(testCases)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Omit<TestCase, "id" | "checked">>({
    number: "", title: "", precondition: "", steps: "", expected: ""
  })
  const [isAdding, setIsAdding] = useState(false)
  const [addForm, setAddForm] = useState<Omit<TestCase, "id" | "checked">>({
    number: "", title: "", precondition: "", steps: "", expected: ""
  })
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  // Store onAllComplete in a ref to avoid triggering effects on callback change
  const onAllCompleteRef = useRef(onAllComplete)
  onAllCompleteRef.current = onAllComplete

  // Track previous completion status to avoid redundant calls
  const prevAllCompleteRef = useRef<boolean | null>(null)

  // Sync with props
  useEffect(() => {
    setLocalCases(testCases)
  }, [testCases])

  // Derive completion status using useMemo (NOT useState + useEffect)
  const allComplete = useMemo(() => {
    return localCases.length > 0 && localCases.every(tc => tc.checked)
  }, [localCases])

  // Notify parent only when completion status actually changes
  useEffect(() => {
    if (prevAllCompleteRef.current !== allComplete) {
      prevAllCompleteRef.current = allComplete
      onAllCompleteRef.current(allComplete)
    }
  }, [allComplete])

  const handleToggle = (id: string) => {
    if (editingId) return
    const updated = localCases.map(tc =>
      tc.id === id ? { ...tc, checked: !tc.checked } : tc
    )
    setLocalCases(updated)
    onTestCasesChange(updated)
  }

  const handleEdit = (tc: TestCase, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(tc.id)
    setEditForm({
      number: tc.number,
      title: tc.title,
      precondition: tc.precondition,
      steps: tc.steps,
      expected: tc.expected
    })
    setIsAdding(false)
    // Expand this item
    if (!expandedItems.includes(tc.id)) {
      setExpandedItems([...expandedItems, tc.id])
    }
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const updated = localCases.map(tc =>
      tc.id === editingId ? { ...tc, ...editForm } : tc
    )
    setLocalCases(updated)
    onTestCasesChange(updated)
    setEditingId(null)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = localCases.filter(tc => tc.id !== id)
    setLocalCases(updated)
    onTestCasesChange(updated)
  }

  const handleAddNew = () => {
    if (!addForm.title.trim()) return
    const newCase: TestCase = {
      id: `${requirementId}-tc-new-${Date.now()}`,
      number: addForm.number || `TC-${String(localCases.length + 1).padStart(3, "0")}`,
      title: addForm.title,
      precondition: addForm.precondition,
      steps: addForm.steps,
      expected: addForm.expected,
      checked: false
    }
    const updated = [...localCases, newCase]
    setLocalCases(updated)
    onTestCasesChange(updated)
    setIsAdding(false)
    setAddForm({ number: "", title: "", precondition: "", steps: "", expected: "" })
  }

  const completedCount = localCases.filter(tc => tc.checked).length

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95vw] sm:max-w-4xl overflow-hidden flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="p-6 pb-5 border-b border-slate-100 shrink-0">
          <SheetTitle className="sr-only">{requirementTitle || "测试用例"}</SheetTitle>
          <div className="flex items-center justify-between text-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-sm">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-semibold">测试执行</span>
                <p className="text-sm text-slate-500 font-normal mt-0.5 line-clamp-1">{requirementTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-sm px-3 py-1",
                  allComplete 
                    ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200" 
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {completedCount} / {localCases.length}
              </Badge>
              {!isAdding && !editingId && (
                <Button
                  size="sm"
                  onClick={() => setIsAdding(true)}
                  className="gap-1.5 text-sm h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  新增用例
                </Button>
              )}
            </div>
          </div>
          <SheetDescription className="sr-only">
            {requirementTitle}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Add new form */}
          {isAdding && (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5 mb-5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-semibold text-violet-700">新增测试用例</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => { setIsAdding(false); setAddForm({ number: "", title: "", precondition: "", steps: "", expected: "" }) }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">编号</label>
                  <Input
                    value={addForm.number}
                    onChange={(e) => setAddForm({ ...addForm, number: e.target.value })}
                    placeholder="TC-001"
                    className="h-9 text-sm bg-white/80 border-violet-200 focus:border-violet-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">标题 *</label>
                  <Input
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    placeholder="测试用例标题..."
                    className="h-9 text-sm bg-white/80 border-violet-200 focus:border-violet-400"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">前置条件</label>
                  <textarea
                    value={addForm.precondition}
                    onChange={(e) => setAddForm({ ...addForm, precondition: e.target.value })}
                    placeholder="执行该测试用例所需的前置条件..."
                    className="w-full h-16 p-3 text-sm border border-violet-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white/80 transition-all duration-200"
                  />
                </div>
                <div className="col-span-3 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">测试步骤</label>
                    <textarea
                      value={addForm.steps}
                      onChange={(e) => setAddForm({ ...addForm, steps: e.target.value })}
                      placeholder="1. 步骤一&#10;2. 步骤二..."
                      className="w-full h-24 p-3 text-sm border border-violet-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white/80 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">预期结果</label>
                    <textarea
                      value={addForm.expected}
                      onChange={(e) => setAddForm({ ...addForm, expected: e.target.value })}
                      placeholder="1. 预期结果一&#10;2. 预期结果二..."
                      className="w-full h-24 p-3 text-sm border border-violet-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 bg-white/80 transition-all duration-200"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-violet-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsAdding(false); setAddForm({ number: "", title: "", precondition: "", steps: "", expected: "" }) }}
                  className="h-9 text-sm px-4"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNew}
                  disabled={!addForm.title.trim()}
                  className="h-9 text-sm px-4 gap-1.5 bg-slate-900 hover:bg-slate-800"
                >
                  <Save className="w-4 h-4" />
                  保存用例
                </Button>
              </div>
            </div>
          )}

          {/* Test case list */}
          <Accordion
            type="multiple" 
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="space-y-3"
          >
            {localCases.map((tc) => (
              <AccordionItem 
                key={tc.id} 
                value={tc.id}
                className={cn(
                  "group/item rounded-xl overflow-hidden transition-all duration-300 border shadow-sm",
                  "hover:shadow-md hover:-translate-y-0.5",
                  tc.checked 
                    ? "border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-green-50/30" 
                    : "border-slate-200 bg-slate-50 hover:border-slate-300",
                  editingId === tc.id && "ring-2 ring-violet-500/30 shadow-lg"
                )}
              >
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Checkbox */}
                  <Checkbox
                    checked={tc.checked}
                    onCheckedChange={() => handleToggle(tc.id)}
                    disabled={!!editingId}
                    className={cn(
                      "shrink-0 w-5 h-5 transition-all duration-200",
                      tc.checked && "border-emerald-500 bg-emerald-500"
                    )}
                  />
                  
                  {/* Main trigger area */}
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(tc.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "shrink-0 text-xs px-2 py-0.5 font-mono font-medium transition-colors",
                          tc.checked ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50"
                        )}
                      >
                        {tc.number}
                      </Badge>
                      <span className={cn(
                        "text-sm font-medium truncate transition-colors",
                        tc.checked ? "text-slate-400 line-through" : "text-slate-700"
                      )}>
                        {tc.title}
                      </span>
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {tc.checked && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-1" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-violet-600 hover:bg-violet-50 opacity-0 group-hover/item:opacity-100 transition-all duration-200"
                      onClick={(e) => handleEdit(tc, e)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover/item:opacity-100 transition-all duration-200"
                      onClick={(e) => handleDelete(tc.id, e)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(tc.id)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-slate-200/70"
                    >
                      <ChevronDown className={cn("w-5 h-5 text-slate-500 transition-transform duration-200", expandedItems.includes(tc.id) && "rotate-180")} />
                    </button>
                  </div>
                </div>

                <AccordionContent className="px-4 pb-4 pt-0">
                  {editingId === tc.id ? (
                    /* Edit mode */
                    <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 mt-3 space-y-4 border border-slate-100">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">编号</label>
                          <Input
                            value={editForm.number}
                            onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">标题</label>
                          <Input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">前置条件</label>
                        <textarea
                          value={editForm.precondition}
                          onChange={(e) => setEditForm({ ...editForm, precondition: e.target.value })}
                          className="w-full h-16 p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">测试步骤</label>
                          <textarea
                            value={editForm.steps}
                            onChange={(e) => setEditForm({ ...editForm, steps: e.target.value })}
                            className="w-full h-24 p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1.5 block">预期结果</label>
                          <textarea
                            value={editForm.expected}
                            onChange={(e) => setEditForm({ ...editForm, expected: e.target.value })}
                            className="w-full h-24 p-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-200"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="h-9 text-sm px-4"
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          className="h-9 text-sm px-4 gap-1.5 bg-slate-900 hover:bg-slate-800"
                        >
                          <Save className="w-4 h-4" />
                          保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 mt-3 space-y-4 border border-slate-100">
                      {/* Precondition */}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-2 block uppercase tracking-wide">前置条件</label>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{tc.precondition || "无"}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        {/* Steps */}
                        <div>
                          <label className="text-xs font-semibold text-slate-500 mb-2 block uppercase tracking-wide">测试步骤</label>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{tc.steps || "无"}</p>
                        </div>
                        
                        {/* Expected */}
                        <div>
                          <label className="text-xs font-semibold text-slate-500 mb-2 block uppercase tracking-wide">预期结果</label>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{tc.expected || "无"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {localCases.length === 0 && !isAdding && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <ListChecks className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-base text-slate-500 mb-4">暂无测试用例</p>
              <Button
                size="sm"
                onClick={() => setIsAdding(true)}
                className="gap-2 text-sm h-10 px-5 bg-slate-900 hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" />
                添加第一个用例
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {allComplete && localCases.length > 0 && (
          <div className="shrink-0 p-5 border-t border-slate-100 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-base font-semibold text-emerald-800">所有测试用例已通过</p>
                <p className="text-sm text-emerald-600">该需求测试已完成，可关闭此窗口</p>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
