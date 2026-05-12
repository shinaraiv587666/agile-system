"use client"

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { TestCase } from "@/components/test-execution-dialog"

const STORAGE_KEY = "rqm:testCasesShowImportantOnly"

function readStored(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function writeStored(value: boolean) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false")
  } catch {
    /* ignore quota / private mode */
  }
}

/** 当前模式下的目标用例集合（与卡片红绿灯逻辑一致） */
export function getTargetTestCases(
  testCases: TestCase[],
  showImportantOnly: boolean
): TestCase[] {
  if (testCases.length === 0) return []
  return showImportantOnly ? testCases.filter((tc) => tc.isImportant) : testCases
}

/**
 * 需求卡片红绿灯：A 未配置 | B 进行中（有目标未全勾）| C 完美完成（有目标且全勾）| idleFilter 有测试但过滤下无目标
 */
export type RequirementCardTestPhase = "noTest" | "inProgress" | "completed" | "idleFilter"

export function deriveRequirementCardTestPhase(
  testCases: TestCase[],
  showImportantOnly: boolean
): RequirementCardTestPhase {
  if (testCases.length === 0) return "noTest"
  const target = getTargetTestCases(testCases, showImportantOnly)
  if (target.length === 0) return "idleFilter"
  if (!target.every((tc) => tc.checked)) return "inProgress"
  return "completed"
}

/** 抽屉统计与 allComplete：与目标集合严格一致（无标星 + 仅看重点 → 不算完成） */
export function computeTestCasesCompletion(
  testCases: TestCase[],
  importantOnly: boolean
): { completed: boolean; importantCount: number; importantChecked: number } {
  if (testCases.length === 0) {
    return { completed: false, importantCount: 0, importantChecked: 0 }
  }
  const target = getTargetTestCases(testCases, importantOnly)
  const importantCount = target.length
  const importantChecked = target.filter((tc) => tc.checked).length
  if (importantCount === 0) {
    return { completed: false, importantCount: 0, importantChecked: 0 }
  }
  return {
    completed: target.every((tc) => tc.checked),
    importantCount,
    importantChecked,
  }
}

/** @deprecated 使用 deriveRequirementCardTestPhase；保留别名供筛选桶映射 */
export function deriveRequirementCardTestStatus(
  testCases: TestCase[],
  showImportantOnly: boolean
): "completed" | "incomplete" | "noTest" {
  const phase = deriveRequirementCardTestPhase(testCases, showImportantOnly)
  if (phase === "noTest") return "noTest"
  if (phase === "completed") return "completed"
  return "incomplete"
}

type Ctx = {
  showImportantOnly: boolean
  setShowImportantOnly: (next: boolean | ((prev: boolean) => boolean)) => void
}

const TestCasesImportantFilterContext = createContext<Ctx | null>(null)

export function TestCasesImportantFilterProvider({ children }: { children: ReactNode }) {
  const [showImportantOnly, setShowImportantOnlyState] = useState(false)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    setShowImportantOnlyState(readStored())
    setReady(true)
  }, [])

  useLayoutEffect(() => {
    if (!ready) return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      setShowImportantOnlyState(e.newValue === "true")
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [ready])

  const setShowImportantOnly = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setShowImportantOnlyState((prev) => {
      const resolved = typeof next === "function" ? (next as (p: boolean) => boolean)(prev) : next
      writeStored(resolved)
      return resolved
    })
  }, [])

  const value = useMemo(
    () => ({ showImportantOnly, setShowImportantOnly }),
    [showImportantOnly, setShowImportantOnly]
  )

  return (
    <TestCasesImportantFilterContext.Provider value={value}>
      {children}
    </TestCasesImportantFilterContext.Provider>
  )
}

export function useTestCasesImportantFilter(): Ctx {
  const ctx = useContext(TestCasesImportantFilterContext)
  if (!ctx) {
    throw new Error("useTestCasesImportantFilter must be used within TestCasesImportantFilterProvider")
  }
  return ctx
}
