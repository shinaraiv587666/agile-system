"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Inbox, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RequirementCard } from "@/components/requirement-card"
import { CategoryTabs, Category } from "@/components/category-tabs"
import {
  RequirementDrawer,
  RequirementDetail,
  getDescriptionSearchPlainText,
} from "@/components/requirement-drawer"
import { TestExecutionDialog, type TestCase } from "@/components/test-execution-dialog"
import { IterationHistoryDialog, IterationRecord } from "@/components/iteration-history-dialog"
import { stringifyErrorForLog, supabaseErrorMessage } from "@/lib/stringify-error"
import {
  deriveRequirementCardTestPhase,
  deriveRequirementCardTestStatus,
  useTestCasesImportantFilter,
} from "@/components/test-cases-important-filter-context"

interface RequirementListProps {
  projectId: string
  projectCategories: string[]
  completedRequirements: Set<string>
  onCompletedChange: (completed: Set<string>) => void
  onCreateNew: () => void
  createNewRequestId: number
  searchQuery: string
  statusFilter: "all" | "completed" | "incomplete" | "noTest"
  requirements: RequirementDetail[]
  onAddCategory: (name: string) => Promise<void>
  onRenameCategory: (oldName: string, newName: string) => Promise<void>
  onDeleteCategory: (name: string) => Promise<void>
  onVisibleCountChange?: (count: number) => void
  onRequirementsChange: (requirements: RequirementDetail[]) => void | Promise<void>
  onPersistTestCases: (requirementId: string, testCases: TestCase[]) => Promise<void>
  onPersistIterations: (requirementId: string, iterations: IterationRecord[]) => Promise<void>
  /** 持久化成功后由列表调用，用于从数据库重新拉取需求列表（含用例 / 迭代的真实 ID） */
  onRefreshRequirements: () => Promise<void>
  /** 抽屉关闭后由列表调用，用于重置「新建需求」触发器，避免 Strict Mode / 重挂载后误弹新建抽屉 */
  onConsumeCreateNewRequest?: () => void
}

export function RequirementList({ 
  projectId, 
  projectCategories,
  completedRequirements,
  onCompletedChange,
  onCreateNew: _onCreateNew,
  createNewRequestId,
  searchQuery,
  statusFilter,
  requirements,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onVisibleCountChange,
  onRequirementsChange,
  onPersistTestCases,
  onPersistIterations,
  onRefreshRequirements,
  onConsumeCreateNewRequest,
}: RequirementListProps) {
  const { showImportantOnly } = useTestCasesImportantFilter()
  const [activeCategory, setActiveCategory] = useState("all")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRequirement, setSelectedRequirement] = useState<RequirementDetail | null>(null)
  const [isNewRequirement, setIsNewRequirement] = useState(false)
  
  // Test execution dialog state
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testingRequirement, setTestingRequirement] = useState<RequirementDetail | null>(null)
  const [iterationSheetOpen, setIterationSheetOpen] = useState(false)
  const [iterationRequirement, setIterationRequirement] = useState<RequirementDetail | null>(null)

  // Filter requirements by active category
  const filteredRequirements = activeCategory === "all" 
    ? requirements 
    : requirements.filter(r => r.category === activeCategory)

  const visibleRequirements = filteredRequirements.filter((req) => {
    const testStatus = deriveRequirementCardTestStatus(req.testCases, showImportantOnly)

    if (statusFilter !== "all" && statusFilter !== testStatus) return false
    const descSearch = getDescriptionSearchPlainText(req.description)
    const text = `${req.title} ${descSearch}`.toLowerCase()
    if (searchQuery.trim() && !text.includes(searchQuery.trim().toLowerCase())) return false
    return true
  })

  useEffect(() => {
    onVisibleCountChange?.(visibleRequirements.length)
  }, [onVisibleCountChange, visibleRequirements.length])

  const handleDrawerOpenChange = useCallback((next: boolean) => {
    setDrawerOpen(next)
    if (!next) {
      setSelectedRequirement(null)
      setIsNewRequirement(false)
      onConsumeCreateNewRequest?.()
    }
  }, [onConsumeCreateNewRequest])

  const handleCardClick = useCallback((requirement: RequirementDetail) => {
    setTestDialogOpen(false)
    setIterationSheetOpen(false)
    setSelectedRequirement(requirement)
    setIsNewRequirement(false)
    setDrawerOpen(true)
  }, [])

  const handleTestIconClick = useCallback((requirement: RequirementDetail) => {
    setDrawerOpen(false)
    setIterationSheetOpen(false)
    setTestingRequirement(requirement)
    setTestDialogOpen(true)
  }, [])

  const handleIterationClick = useCallback((requirement: RequirementDetail) => {
    setDrawerOpen(false)
    setTestDialogOpen(false)
    setIterationRequirement(requirement)
    setIterationSheetOpen(true)
  }, [])

  const handleCommitTestCases = useCallback(
    async (requirementId: string, testCases: TestCase[]) => {
      if (!requirementId) return
      try {
        await onPersistTestCases(requirementId, testCases)
        await onRefreshRequirements()
      } catch (err: unknown) {
        console.error("handleCommitTestCases Supabase Error:", stringifyErrorForLog(err))
        throw err instanceof Error ? err : new Error(supabaseErrorMessage(err))
      }
    },
    [onPersistTestCases, onRefreshRequirements]
  )

  const handleAllComplete = useCallback((allComplete: boolean) => {
    if (!testingRequirement) return
    const next = new Set(completedRequirements)
    if (allComplete) {
      next.add(testingRequirement.id)
    } else {
      next.delete(testingRequirement.id)
    }
    onCompletedChange(next)
  }, [testingRequirement, completedRequirements, onCompletedChange])

  const handleSaveRequirement = useCallback(async (updatedRequirement: RequirementDetail) => {
    try {
      if (isNewRequirement) {
        await onRequirementsChange([updatedRequirement, ...requirements])
      } else {
        await onRequirementsChange(
          requirements.map(r => r.id === updatedRequirement.id ? updatedRequirement : r)
        )
      }
    } catch (error) {
      console.error("Failed to save requirement:", error instanceof Error ? error.message : String(error))
      throw error
    }
  }, [isNewRequirement, requirements, onRequirementsChange])

  const handleDeleteRequirement = useCallback(async (requirementId: string) => {
    try {
      await onRequirementsChange(requirements.filter(r => r.id !== requirementId))
      // Also remove from completed set
      const next = new Set(completedRequirements)
      next.delete(requirementId)
      onCompletedChange(next)
    } catch (error) {
      console.error("Failed to delete requirement:", error instanceof Error ? error.message : String(error))
    }
  }, [requirements, onRequirementsChange, completedRequirements, onCompletedChange])

  const handleCreateNew = useCallback(() => {
    setTestDialogOpen(false)
    setIterationSheetOpen(false)
    setSelectedRequirement(null)
    setIsNewRequirement(true)
    setDrawerOpen(true)
  }, [])

  const lastProcessedCreateRequestId = useRef(0)
  const handleCreateNewRef = useRef(handleCreateNew)
  handleCreateNewRef.current = handleCreateNew

  useEffect(() => {
    if (!createNewRequestId) return
    if (lastProcessedCreateRequestId.current === createNewRequestId) return
    lastProcessedCreateRequestId.current = createNewRequestId
    handleCreateNewRef.current()
  }, [createNewRequestId])

  const knownCategories: Record<string, { name: string; icon: string }> = {
    core: { name: "核心功能", icon: "⚡" },
    ads: { name: "广告配置", icon: "📺" },
    notification: { name: "消息通知", icon: "🔔" },
    analytics: { name: "数据埋点", icon: "📊" },
    user: { name: "用户体系", icon: "👤" },
    payment: { name: "支付系统", icon: "💳" },
    security: { name: "安全策略", icon: "🔒" },
    performance: { name: "性能优化", icon: "🚀" },
    i18n: { name: "多语言", icon: "🌍" },
    accessibility: { name: "无障碍", icon: "♿" },
  }

  const dynamicCategories: Category[] = projectCategories.map((id) => {
    const meta = knownCategories[id]
    return {
      id,
      name: meta?.name ?? id,
      icon: meta?.icon ?? "📁",
      count: requirements.filter(r => r.category === id).length,
    }
  })

  const categoriesWithCounts: Category[] = [
    { id: "all", name: "全部", count: requirements.length, icon: "📋" },
    ...dynamicCategories,
  ]

  useEffect(() => {
    if (activeCategory !== "all" && !projectCategories.includes(activeCategory)) {
      setActiveCategory("all")
    }
  }, [activeCategory, projectCategories])

  const handleCommitIterations = useCallback(async (requirementId: string, iterations: IterationRecord[]) => {
    try {
      await onPersistIterations(requirementId, iterations)
      await onRefreshRequirements()
    } catch (err: unknown) {
      console.error("handleCommitIterations Supabase Error:", stringifyErrorForLog(err))
      throw err instanceof Error ? err : new Error(supabaseErrorMessage(err))
    }
  }, [onPersistIterations, onRefreshRequirements])

  return (
    <>
      {requirements.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[min(520px,calc(100vh-11rem))] gap-5 px-6 text-center rounded-xl border border-dashed border-slate-200 bg-white/60">
          <Inbox className="w-20 h-20 text-slate-300" strokeWidth={1} aria-hidden />
          <p className="text-base text-slate-600 font-medium">该项目下暂无需求</p>
          <p className="text-xs text-slate-400 max-w-xs">创建第一条需求后即可在此查看卡片、配置测试用例与迭代记录。</p>
          <Button
            type="button"
            onClick={handleCreateNew}
            className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建需求
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Category Tabs */}
          <CategoryTabs 
            categories={categoriesWithCounts}
            activeId={activeCategory}
            onSelect={setActiveCategory}
            onAddCategory={onAddCategory}
            onRenameCategory={onRenameCategory}
            onDeleteCategory={onDeleteCategory}
          />

          {/* Requirements Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 animate-in fade-in duration-300">
            {visibleRequirements.map((requirement, index) => (
              <RequirementCard 
                key={requirement.id} 
                requirement={{
                  id: requirement.id,
                  title: requirement.title,
                  status: requirement.status,
                  iterations: requirement.iterations,
                }} 
                index={index}
                onClick={() => handleCardClick(requirement)}
                onTestClick={() => handleTestIconClick(requirement)}
                onIterationClick={() => handleIterationClick(requirement)}
                testPhase={deriveRequirementCardTestPhase(requirement.testCases, showImportantOnly)}
                iterationCount={requirement.iterationHistory.length}
              />
            ))}
          </div>

          {/* Empty state (filters / category) */}
          {visibleRequirements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-3xl mb-2">📭</span>
              <p className="text-sm">该分类下暂无需求</p>
              <button 
                type="button"
                onClick={handleCreateNew}
                className="mt-3 text-xs text-sky-500 hover:text-sky-600 transition-colors"
              >
                点击新建需求
              </button>
            </div>
          )}
        </div>
      )}

      {/* Requirement Detail Drawer */}
      <RequirementDrawer
        requirement={selectedRequirement}
        open={drawerOpen}
        availableCategories={projectCategories.length > 0 ? projectCategories : ["core"]}
        newRequirementDefaults={{
          projectId,
          category: activeCategory === "all" ? (projectCategories[0] || "core") : activeCategory,
        }}
        onOpenChange={handleDrawerOpenChange}
        onSave={handleSaveRequirement}
        onDelete={handleDeleteRequirement}
        isNewRequirement={isNewRequirement}
      />

      {/* Test Execution Dialog */}
      <TestExecutionDialog
        open={testDialogOpen}
        onOpenChange={(next) => {
          setTestDialogOpen(next)
          if (!next) {
            setTestingRequirement(null)
          }
        }}
        requirementId={testingRequirement?.id ?? ""}
        requirementTitle={testingRequirement?.title ?? ""}
        testCases={testingRequirement?.testCases ?? []}
        onCommitTestCases={handleCommitTestCases}
        onAllComplete={handleAllComplete}
      />

      <IterationHistoryDialog
        open={iterationSheetOpen}
        onOpenChange={(next) => {
          setIterationSheetOpen(next)
          if (!next) {
            setIterationRequirement(null)
          }
        }}
        requirementId={iterationRequirement?.id ?? ""}
        title={iterationRequirement?.title ?? "迭代历史"}
        iterations={iterationRequirement?.iterationHistory ?? []}
        onCommitIterations={handleCommitIterations}
      />
    </>
  )
}
