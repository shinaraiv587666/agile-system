"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { RequirementCard } from "@/components/requirement-card"
import { CategoryTabs, Category } from "@/components/category-tabs"
import { RequirementDrawer, RequirementDetail } from "@/components/requirement-drawer"
import { TestExecutionDialog, TestCase } from "@/components/test-execution-dialog"
import { IterationHistoryDialog, IterationRecord } from "@/components/iteration-history-dialog"

interface RequirementListProps {
  projectId: string
  projectCategories: string[]
  completedRequirements: Set<string>
  onCompletedChange: (completed: Set<string>) => void
  onCreateNew: () => void
  createNewRequestId: number
  searchQuery: string
  statusFilter: "all" | "completed" | "incomplete"
  requirements: RequirementDetail[]
  onAddCategory: (name: string) => Promise<void>
  onRenameCategory: (oldName: string, newName: string) => Promise<void>
  onDeleteCategory: (name: string) => Promise<void>
  onVisibleCountChange?: (count: number) => void
  onRequirementsChange: (requirements: RequirementDetail[]) => void | Promise<void>
  onPersistTestCases: (requirementId: string, testCases: TestCase[]) => Promise<void>
  onPersistIterations: (requirementId: string, iterations: IterationRecord[]) => Promise<void>
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
}: RequirementListProps) {
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
    const done = req.testCases.length > 0 && req.testCases.every((tc) => tc.checked)
    if (statusFilter === "completed" && !done) return false
    if (statusFilter === "incomplete" && done) return false
    const text = `${req.title} ${req.description}`.toLowerCase()
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
    }
  }, [])

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

  const handleTestCasesChange = useCallback(async (testCases: TestCase[]) => {
    if (!testingRequirement) return
    try {
      const updated = requirements.map(r =>
        r.id === testingRequirement.id ? { ...r, testCases } : r
      )
      await onRequirementsChange(updated)
      setTestingRequirement(prev => prev ? { ...prev, testCases } : null)
      await onPersistTestCases(testingRequirement.id, testCases)
    } catch (error) {
      console.error("Failed to update test cases:", error instanceof Error ? error.message : String(error))
    }
  }, [testingRequirement, requirements, onRequirementsChange, onPersistTestCases])

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
        // Add new requirement
        await onRequirementsChange([updatedRequirement, ...requirements])
      } else {
        // Update existing requirement
        await onRequirementsChange(
          requirements.map(r => r.id === updatedRequirement.id ? updatedRequirement : r)
        )
      }
      handleDrawerOpenChange(false)
    } catch (error) {
      console.error("Failed to save requirement:", error instanceof Error ? error.message : String(error))
    }
  }, [isNewRequirement, requirements, onRequirementsChange, handleDrawerOpenChange])

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

  const lastCreateReq = useRef(0)
  useEffect(() => {
    if (!createNewRequestId) return
    if (lastCreateReq.current === createNewRequestId) return
    lastCreateReq.current = createNewRequestId
    if (createNewRequestId > 0) {
      handleCreateNew()
    }
  }, [createNewRequestId, handleCreateNew])

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

  const handleIterationHistoryChange = useCallback(async (requirementId: string, iterations: IterationRecord[]) => {
    try {
      await onRequirementsChange(
        requirements.map(r =>
          r.id === requirementId
            ? { ...r, iterationHistory: iterations, iterations: iterations.length || 1 }
            : r
        )
      )
      await onPersistIterations(requirementId, iterations)
    } catch (error) {
      console.error("Failed to save iteration history:", error instanceof Error ? error.message : String(error))
    }
  }, [onPersistIterations, onRequirementsChange, requirements])

  return (
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
            isTestComplete={completedRequirements.has(requirement.id)}
            iterationCount={requirement.iterationHistory.length}
          />
        ))}
      </div>

      {/* Empty state */}
      {visibleRequirements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="text-3xl mb-2">📭</span>
          <p className="text-sm">该分类下暂无需求</p>
          <button 
            onClick={handleCreateNew}
            className="mt-3 text-xs text-sky-500 hover:text-sky-600 transition-colors"
          >
            点击新建需求
          </button>
        </div>
      )}

      {/* Requirement Detail Drawer */}
      <RequirementDrawer
        requirement={selectedRequirement}
        open={drawerOpen}
        availableCategories={projectCategories.length > 0 ? projectCategories : ["core"]}
        newRequirementDefaults={{
          projectId: projectId || "default",
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
        onOpenChange={setTestDialogOpen}
        requirementId={testingRequirement?.id ?? ""}
        requirementTitle={testingRequirement?.title ?? ""}
        testCases={testingRequirement?.testCases ?? []}
        onTestCasesChange={handleTestCasesChange}
        onAllComplete={handleAllComplete}
      />

      <IterationHistoryDialog
        open={iterationSheetOpen}
        onOpenChange={setIterationSheetOpen}
        title={iterationRequirement?.title ?? "迭代历史"}
        iterations={iterationRequirement?.iterationHistory ?? []}
        onIterationsChange={(iterations) => {
          if (!iterationRequirement) return
          handleIterationHistoryChange(iterationRequirement.id, iterations)
          setIterationRequirement((prev) => prev ? { ...prev, iterationHistory: iterations } : prev)
        }}
      />
    </div>
  )
}
