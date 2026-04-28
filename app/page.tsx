"use client"

import { useState, useEffect, useCallback } from "react"
import { Project, ProjectSidebar } from "@/components/project-sidebar"
import { RequirementList } from "@/components/requirement-list"
import { MatrixTableData, RequirementDetail } from "@/components/requirement-drawer"
import { TestCase } from "@/components/test-execution-dialog"
import { IterationRecord } from "@/components/iteration-history-dialog"
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
  Search, 
  Plus, 
  Filter,
  RotateCcw
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return uuidLike.test(value)
}

function logSupabaseError(scope: string, error: unknown) {
  const maybe = error as { message?: string; details?: string; hint?: string; code?: string }
  console.error(
    `${scope} Supabase Error:`,
    maybe?.message || String(error),
    maybe?.details || "",
    maybe?.hint || "",
    maybe?.code || ""
  )
}

function safeMatrixTableData(value: unknown): MatrixTableData {
  if (Array.isArray(value)) {
    const rowsSource = value as Record<string, unknown>[]
    const keySet = new Set<string>()
    for (const row of rowsSource) {
      Object.keys(row ?? {}).forEach((key) => keySet.add(key))
    }
    const columns = Array.from(keySet).map((key, idx) => ({
      id: `col_${idx + 1}`,
      title: key,
      tags: ["all"],
    }))
    const keyToCol = new Map(columns.map((col, idx) => [col.title, `col_${idx + 1}`]))
    const rows = rowsSource.map((row, idx) => {
      const mapped: { id: string; [key: string]: string } = { id: `row_${idx + 1}` }
      for (const [k, v] of Object.entries(row ?? {})) {
        const colId = keyToCol.get(k)
        if (colId) mapped[colId] = String(v ?? "")
      }
      return mapped
    })
    return { columns, rows }
  }

  if (!value || typeof value !== "object") {
    return { columns: [], rows: [] }
  }
  const maybe = value as Partial<MatrixTableData>
  return {
    columns: Array.isArray(maybe.columns) ? maybe.columns : [],
    rows: Array.isArray(maybe.rows) ? maybe.rows : [],
  }
}

function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return ["core"]
  const cleaned = value.map((item) => String(item).trim()).filter(Boolean)
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : ["core"]
}

const PROJECT_COLOR_POOL = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
]

export default function Home() {
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsDbEnabled, setProjectsDbEnabled] = useState(false)
  const [completedRequirements, setCompletedRequirements] = useState<Set<string>>(new Set())
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [requirements, setRequirements] = useState<RequirementDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "incomplete">("all")
  const [createNewRequestId, setCreateNewRequestId] = useState(0)
  const [supportsProjectId, setSupportsProjectId] = useState(true)
  const [visibleRequirementCount, setVisibleRequirementCount] = useState(0)

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) {
      console.warn("Failed to load projects table, fallback to default list:", error.message)
      const fallback = [{ id: "default", name: "默认项目", color: "bg-sky-500", requirementsCount: 0, categories: ["core"] }]
      setProjects(fallback)
      setProjectsDbEnabled(false)
      setSelectedProjectId(prev => prev || fallback[0].id)
      return
    }
    const mapped: Project[] = (data ?? []).map((project, index) => ({
      id: String(project.id),
      name: String(project.name ?? `项目 ${index + 1}`),
      color: PROJECT_COLOR_POOL[index % PROJECT_COLOR_POOL.length],
      requirementsCount: 0,
      categories: normalizeCategories((project as { categories?: unknown }).categories),
    }))
    const safeProjects = mapped.length > 0
      ? mapped
      : [{ id: "default", name: "默认项目", color: "bg-sky-500", requirementsCount: 0, categories: ["core"] }]
    setProjects(safeProjects)
    setProjectsDbEnabled(true)
    setSelectedProjectId(prev => prev || safeProjects[0].id)
  }, [])

  const fetchAllData = useCallback(async () => {
    if (!selectedProjectId) {
      setRequirements([])
      setCompletedRequirements(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    let reqRows: Record<string, unknown>[] | null = null
    if (supportsProjectId && isUuid(selectedProjectId)) {
      const { data, error } = await supabase
        .from("requirements")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false })
      if (error) {
        const msg = error.message || ""
        const missingProjectColumn = msg.includes("project_id") && msg.includes("schema cache")
        if (missingProjectColumn) {
          setSupportsProjectId(false)
          const fallback = await supabase
            .from("requirements")
            .select("*")
            .order("created_at", { ascending: false })
          if (fallback.error) throw fallback.error
          reqRows = fallback.data as Record<string, unknown>[]
        } else {
          throw error
        }
      } else {
        reqRows = data as Record<string, unknown>[]
      }
    } else {
      const { data, error } = await supabase
        .from("requirements")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      reqRows = data as Record<string, unknown>[]
    }

    const requirementIds = (reqRows ?? []).map((r) => String((r as { id?: string }).id ?? ""))

    let testRows: Record<string, unknown>[] = []
    let iterationRows: Record<string, unknown>[] = []

    if (requirementIds.length > 0) {
      const [{ data: tcData, error: tcError }, { data: itData, error: itError }] = await Promise.all([
        supabase
          .from("test_cases")
          .select("*")
          .in("requirement_id", requirementIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("iterations")
          .select("*")
          .in("requirement_id", requirementIds)
          .order("modified_at", { ascending: false }),
      ])
      if (tcError) throw tcError
      if (itError) throw itError
      testRows = (tcData ?? []) as Record<string, unknown>[]
      iterationRows = (itData ?? []) as Record<string, unknown>[]
    }

    const testMap = new Map<string, TestCase[]>()
    for (const row of testRows) {
      const reqId = String(row.requirement_id)
      const list = testMap.get(reqId) ?? []
      list.push({
        id: String(row.id),
        number: String(row.case_no ?? ""),
        title: String(row.title ?? ""),
        precondition: String(row.preconditions ?? ""),
        steps: String(row.steps ?? ""),
        expected: String(row.expected_result ?? ""),
        checked: Boolean(row.is_checked),
      })
      testMap.set(reqId, list)
    }

    const iterMap = new Map<string, IterationRecord[]>()
    for (const row of iterationRows) {
      const reqId = String(row.requirement_id)
      const list = iterMap.get(reqId) ?? []
      list.push({
        id: String(row.id),
        version: String(row.version ?? "1"),
        changes: String(row.change_log ?? ""),
      })
      iterMap.set(reqId, list)
    }

    const mapped: RequirementDetail[] = (reqRows ?? []).map(r => {
      const reqId = String((r as { id?: string }).id ?? "")
      const iterationHistory = iterMap.get(reqId) ?? []
      return {
        id: reqId,
        projectId: String((r as { project_id?: string }).project_id ?? selectedProjectId),
        category: String((r as { category?: string }).category ?? "core"),
        title: String((r as { name?: string }).name ?? ""),
        version: String((r as { version?: string }).version ?? ""),
        status: "todo",
        iterations: Math.max(iterationHistory.length, 1),
        description: String((r as { content?: string }).content ?? ""),
        testCases: testMap.get(reqId) ?? [],
        iterationHistory,
        imageUrl: (r as { image_urls?: string[] }).image_urls?.[0],
        tableData: safeMatrixTableData((r as { table_data?: unknown }).table_data),
      }
    })

    setRequirements(mapped)
    setProjects(prev =>
      prev.map(p => ({
        ...p,
        requirementsCount: p.id === selectedProjectId ? mapped.length : p.requirementsCount,
      }))
    )
    setCompletedRequirements(
      new Set(
        mapped
          .filter(r => r.testCases.length > 0 && r.testCases.every(tc => tc.checked))
          .map(r => r.id)
      )
    )
    setLoading(false)
  }, [selectedProjectId, supportsProjectId])

  useEffect(() => {
    fetchProjects().catch((error) => {
      logSupabaseError("Failed to load projects", error)
    })
  }, [fetchProjects])

  useEffect(() => {
    fetchAllData().catch((error) => {
      logSupabaseError("Failed to load data from", error)
      setLoading(false)
    })
  }, [fetchAllData])

  const handleResetAllTests = async () => {
    try {
      if (!selectedProjectId) return

      let requirementIds: string[] = []
      if (supportsProjectId && isUuid(selectedProjectId)) {
        const { data, error } = await supabase
          .from("requirements")
          .select("id")
          .eq("project_id", selectedProjectId)
        if (error) throw error
        requirementIds = (data ?? []).map((r: { id: string }) => r.id).filter(isUuid)
      } else {
        requirementIds = requirements.map((r) => r.id).filter(isUuid)
      }

      if (requirementIds.length > 0) {
        const { error } = await supabase
          .from("test_cases")
          .update({ is_checked: false })
          .in("requirement_id", requirementIds)
        if (error) throw error
      }

      setResetDialogOpen(false)
      await fetchAllData()
    } catch (error) {
      logSupabaseError("Reset tests failed", error)
    }
  }

  const handleCreateNew = useCallback(() => {
    setCreateNewRequestId(Date.now())
  }, [])

  const testedCount = completedRequirements.size

  const persistRequirementList = useCallback(async (nextRequirements: RequirementDetail[]) => {
    const currentMap = new Map(requirements.map(r => [r.id, r]))
    const nextMap = new Map(nextRequirements.map(r => [r.id, r]))

    for (const [id, req] of nextMap) {
      const payload: Record<string, unknown> = {
        category: req.category,
        name: req.title,
        content: req.description,
        version: req.version ?? "",
        table_data: req.tableData ?? { columns: [], rows: [] },
        image_urls: req.imageUrl ? [req.imageUrl] : [],
      }
      if (supportsProjectId && isUuid(req.projectId || selectedProjectId)) {
        payload.project_id = req.projectId || selectedProjectId
      }
      if (isUuid(id)) {
        const { error } = await supabase.from("requirements").update(payload).eq("id", id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("requirements").insert(payload).select("id").single()
        if (error) throw error
        if (data?.id) req.id = data.id
      }
    }

    const deletedIds = requirements.filter(r => !nextMap.has(r.id) && isUuid(r.id)).map(r => r.id)
    if (deletedIds.length > 0) {
      const { error } = await supabase.from("requirements").delete().in("id", deletedIds)
      if (error) throw error
    }

    setRequirements(nextRequirements)
    setCompletedRequirements(prev => {
      const updated = new Set<string>()
      for (const id of prev) {
        if (nextMap.has(id)) updated.add(id)
      }
      return updated
    })
    if (Array.from(nextMap.keys()).some(id => !currentMap.has(id) || !isUuid(id))) {
      await fetchAllData()
    }
  }, [fetchAllData, requirements, selectedProjectId, supportsProjectId])

  const persistTestCases = useCallback(async (requirementId: string, nextCases: TestCase[]) => {
    const current = requirements.find(r => r.id === requirementId)?.testCases ?? []
    const currentIds = new Set(current.map(tc => tc.id).filter(isUuid))
    const nextIds = new Set(nextCases.map(tc => tc.id).filter(isUuid))
    const deleted = Array.from(currentIds).filter(id => !nextIds.has(id))
    if (deleted.length > 0) {
      const { error } = await supabase.from("test_cases").delete().in("id", deleted)
      if (error) throw error
    }

    for (const tc of nextCases) {
      const payload = {
        requirement_id: requirementId,
        case_no: tc.number,
        title: tc.title,
        preconditions: tc.precondition,
        steps: tc.steps,
        expected_result: tc.expected,
        is_checked: tc.checked,
      }
      if (isUuid(tc.id)) {
        const { error } = await supabase.from("test_cases").update(payload).eq("id", tc.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("test_cases").insert(payload)
        if (error) throw error
      }
    }
    await fetchAllData()
  }, [fetchAllData, requirements])

  const persistIterations = useCallback(async (requirementId: string, nextIterations: IterationRecord[]) => {
    const current = requirements.find(r => r.id === requirementId)?.iterationHistory ?? []
    const currentIds = new Set(current.map(item => item.id).filter(isUuid))
    const nextIds = new Set(nextIterations.map(item => item.id).filter(isUuid))
    const deleted = Array.from(currentIds).filter(id => !nextIds.has(id))
    if (deleted.length > 0) {
      const { error } = await supabase.from("iterations").delete().in("id", deleted)
      if (error) throw error
    }

    for (const iteration of nextIterations) {
      const payload = {
        requirement_id: requirementId,
        version: iteration.version,
        change_log: iteration.changes,
        modified_at: new Date().toISOString(),
      }
      if (isUuid(iteration.id)) {
        const { error } = await supabase.from("iterations").update(payload).eq("id", iteration.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("iterations").insert(payload)
        if (error) throw error
      }
    }
    await fetchAllData()
  }, [fetchAllData, requirements])

  const handleCreateProject = useCallback(async (name: string) => {
    if (!projectsDbEnabled) {
      const localProject: Project = {
        id: `local-${Date.now()}`,
        name,
        color: PROJECT_COLOR_POOL[(projects.length + 1) % PROJECT_COLOR_POOL.length],
        requirementsCount: 0,
        categories: ["core"],
      }
      setProjects(prev => [localProject, ...prev])
      setSelectedProjectId(localProject.id)
      return
    }
    const payload = { name, categories: ["core"] }
    const { data, error } = await supabase.from("projects").insert(payload).select("id,name,categories").single()
    if (error) {
      logSupabaseError("Create project failed", error)
      return
    }
    const newProject: Project = {
      id: data.id,
      name: data.name,
      color: PROJECT_COLOR_POOL[(projects.length + 1) % PROJECT_COLOR_POOL.length],
      requirementsCount: 0,
      categories: normalizeCategories((data as { categories?: unknown }).categories),
    }
    setProjects(prev => [newProject, ...prev])
    setSelectedProjectId(newProject.id)
  }, [projects.length, projectsDbEnabled])

  const handleRenameProject = useCallback(async (id: string, name: string) => {
    if (id === "default") return
    if (!projectsDbEnabled) {
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, name } : p)))
      return
    }
    const { error } = await supabase.from("projects").update({ name }).eq("id", id)
    if (error) {
      logSupabaseError("Rename project failed", error)
      return
    }
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, name } : p)))
  }, [projectsDbEnabled])

  const handleDeleteProject = useCallback(async (id: string) => {
    if (id === "default") return
    if (!projectsDbEnabled) {
      setProjects(prev => {
        const next = prev.filter(p => p.id !== id)
        if (next.length > 0 && selectedProjectId === id) {
          setSelectedProjectId(next[0].id)
        } else if (next.length === 0) {
          setSelectedProjectId("")
        }
        return next
      })
      return
    }
    const { error } = await supabase.from("projects").delete().eq("id", id)
    if (error) {
      logSupabaseError("Delete project failed", error)
      return
    }
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length > 0 && selectedProjectId === id) {
        setSelectedProjectId(next[0].id)
      } else if (next.length === 0) {
        setSelectedProjectId("")
      }
      return next
    })
  }, [projectsDbEnabled, selectedProjectId])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const activeCategories = selectedProject?.categories ?? ["core"]

  const syncProjectCategories = useCallback(async (projectId: string, categories: string[]) => {
    const normalized = Array.from(new Set(categories.map((x) => x.trim()).filter(Boolean)))
    const safe = normalized.length > 0 ? normalized : ["core"]
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, categories: safe } : p)))
    if (projectsDbEnabled && isUuid(projectId)) {
      const { error } = await supabase.from("projects").update({ categories: safe }).eq("id", projectId)
      if (error) logSupabaseError("Update categories failed", error)
    }
  }, [projectsDbEnabled])

  const handleAddCategory = useCallback(async (name: string) => {
    if (!selectedProjectId) return
    await syncProjectCategories(selectedProjectId, [...activeCategories, name])
  }, [activeCategories, requirements, selectedProjectId, syncProjectCategories])

  const handleRenameCategory = useCallback(async (oldName: string, newName: string) => {
    if (!selectedProjectId) return
    await syncProjectCategories(
      selectedProjectId,
      activeCategories.map((cat) => (cat === oldName ? newName : cat))
    )
    setRequirements((prev) => prev.map((req) => (req.category === oldName ? { ...req, category: newName } : req)))
    const ids = requirements.filter((req) => req.category === oldName && isUuid(req.id)).map((req) => req.id)
    if (ids.length > 0) {
      const { error } = await supabase.from("requirements").update({ category: newName }).in("id", ids)
      if (error) logSupabaseError("Rename category in requirements failed", error)
    }
  }, [activeCategories, requirements, selectedProjectId, syncProjectCategories])

  const handleDeleteCategory = useCallback(async (name: string) => {
    if (!selectedProjectId) return
    const remaining = activeCategories.filter((cat) => cat !== name)
    const fallback = remaining[0] || "core"
    await syncProjectCategories(selectedProjectId, remaining)
    setRequirements((prev) => prev.map((req) => (req.category === name ? { ...req, category: fallback } : req)))
    const ids = requirements.filter((req) => req.category === name && isUuid(req.id)).map((req) => req.id)
    if (ids.length > 0) {
      const { error } = await supabase.from("requirements").update({ category: fallback }).in("id", ids)
      if (error) logSupabaseError("Delete category remap requirements failed", error)
    }
  }, [activeCategories, selectedProjectId, syncProjectCategories])

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <ProjectSidebar 
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        projects={projects}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索需求点..." 
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 h-8 text-xs border rounded-md px-2 border-slate-200 bg-white text-slate-600">
            <Filter className="w-3 h-3" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "completed" | "incomplete")}>
              <SelectTrigger className="h-7 w-[120px] border-0 shadow-none px-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="incomplete">未完成</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {visibleRequirementCount}
            </Badge>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Reset all tests button */}
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 transition-colors"
              disabled={!selectedProjectId}
              >
                <RotateCcw className="w-3 h-3" />
                重置测试
                {testedCount > 0 && (
                  <Badge className="ml-1 bg-rose-100 text-rose-600 border-rose-200 text-[9px] px-1 py-0 h-4">
                    {testedCount}
                  </Badge>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-slate-800">
                  <RotateCcw className="w-5 h-5 text-rose-500" />
                  确认重置所有测试？
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500">
                  此操作将把<strong className="text-slate-700">当前项目</strong>下所有测试用例的勾选状态强制清空为未勾选。
                  <br />
                  <span className="text-rose-500 text-xs mt-2 block">此操作无法撤销。</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-slate-600">取消</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleResetAllTests}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  确认重置
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* New requirement button */}
          <Button 
            size="sm" 
            onClick={handleCreateNew}
            className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 shadow-sm h-8 text-xs"
          >
            <Plus className="w-3 h-3" />
            新建需求
          </Button>
        </div>

        {/* Content Area with Tabs and Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-sm text-slate-500">正在从 Supabase 加载数据...</div>
          ) : (
          <RequirementList 
            projectId={selectedProjectId}
            projectCategories={activeCategories}
            completedRequirements={completedRequirements}
            onCompletedChange={setCompletedRequirements}
            onCreateNew={handleCreateNew}
            createNewRequestId={createNewRequestId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            requirements={requirements}
            onAddCategory={handleAddCategory}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            onVisibleCountChange={setVisibleRequirementCount}
            onRequirementsChange={persistRequirementList}
            onPersistTestCases={persistTestCases}
            onPersistIterations={persistIterations}
          />
          )}
        </div>
      </main>
    </div>
  )
}
