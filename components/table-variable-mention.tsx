"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react"
import { createPortal } from "react-dom"
import type { MatrixTableData } from "@/components/requirement-drawer"
import { cn } from "@/lib/utils"
import {
  buildTableMentionOptions,
  createTableVariableToken,
  detectMentionContext,
  filterTableMentionOptions,
  type TableMentionOption,
} from "@/lib/table-variable-binding"
import { Database } from "lucide-react"

interface MentionEngineOptions {
  value: string
  onChange: (value: string) => void
  tableData?: MatrixTableData
  disabled?: boolean
  getCursor: () => number
  setCursor: (pos: number) => void
  focusInput: () => void
}

function useTableVariableMention({
  value,
  onChange,
  tableData,
  disabled = false,
  getCursor,
  setCursor,
  focusInput,
}: MentionEngineOptions) {
  const anchorRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionQuery, setMentionQuery] = useState("")
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 280 })

  const allOptions = useMemo(() => buildTableMentionOptions(tableData), [tableData])
  const filteredOptions = useMemo(
    () => filterTableMentionOptions(allOptions, mentionQuery),
    [allOptions, mentionQuery]
  )
  const hasTableData = allOptions.length > 0

  const closeMention = useCallback(() => {
    setMentionOpen(false)
    setMentionQuery("")
    setHighlightIndex(0)
  }, [])

  const updateMenuPosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 300),
    })
  }, [])

  const syncMentionFromCursor = useCallback(
    (text: string, cursor: number) => {
      if (!hasTableData || disabled) {
        closeMention()
        return
      }
      const ctx = detectMentionContext(text, cursor)
      if (!ctx) {
        closeMention()
        return
      }
      setMentionOpen(true)
      setMentionStart(ctx.start)
      setMentionQuery(ctx.query)
      setHighlightIndex(0)
      requestAnimationFrame(updateMenuPosition)
    },
    [closeMention, disabled, hasTableData, updateMenuPosition]
  )

  const insertMention = useCallback(
    (option: TableMentionOption) => {
      const cursor = getCursor()
      const token = createTableVariableToken(option.rowId, option.colId)
      const before = value.slice(0, mentionStart)
      const after = value.slice(cursor)
      const nextValue = before + token + after
      const nextCursor = before.length + token.length

      onChange(nextValue)
      closeMention()

      requestAnimationFrame(() => {
        focusInput()
        setCursor(nextCursor)
      })
    },
    [closeMention, getCursor, mentionStart, onChange, setCursor, focusInput, value]
  )

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!mentionOpen || filteredOptions.length === 0) return false

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) => (prev + 1) % filteredOptions.length)
      return true
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length)
      return true
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      insertMention(filteredOptions[highlightIndex])
      return true
    }
    if (e.key === "Escape") {
      e.preventDefault()
      closeMention()
      return true
    }
    return false
  }

  useEffect(() => {
    if (!mentionOpen) return
    updateMenuPosition()
    const onScrollOrResize = () => updateMenuPosition()
    window.addEventListener("scroll", onScrollOrResize, true)
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [mentionOpen, mentionQuery, updateMenuPosition])

  useEffect(() => {
    if (!mentionOpen) return
    const onDocMouseDown = (ev: MouseEvent) => {
      const target = ev.target as Node
      if (anchorRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMention()
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [closeMention, mentionOpen])

  useEffect(() => {
    if (highlightIndex >= filteredOptions.length) {
      setHighlightIndex(0)
    }
  }, [filteredOptions.length, highlightIndex])

  return {
    anchorRef,
    menuRef,
    mentionOpen,
    mentionQuery,
    highlightIndex,
    setHighlightIndex,
    filteredOptions,
    hasTableData,
    menuPos,
    closeMention,
    syncMentionFromCursor,
    insertMention,
    handleKeyDown,
  }
}

function TableVariableMentionMenu({
  open,
  menuRef,
  menuPos,
  mentionQuery,
  filteredOptions,
  highlightIndex,
  setHighlightIndex,
  insertMention,
}: {
  open: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  menuPos: { top: number; left: number; width: number }
  mentionQuery: string
  filteredOptions: TableMentionOption[]
  highlightIndex: number
  setHighlightIndex: (index: number) => void
  insertMention: (option: TableMentionOption) => void
}) {
  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] bg-white shadow-xl rounded-md border border-slate-200 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
      style={{
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
      }}
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-3 py-2">
        <p className="text-[11px] font-medium text-slate-700">选择表格变量</p>
        {mentionQuery ? (
          <p className="text-[10px] text-slate-400 mt-0.5">
            筛选：<span className="font-mono text-slate-500">@{mentionQuery}</span>
          </p>
        ) : null}
      </div>

      {filteredOptions.length === 0 ? (
        <div className="px-3 py-4 text-xs text-slate-400 text-center">无匹配的单元格</div>
      ) : (
        <ul className="py-1">
          {filteredOptions.map((opt, index) => (
            <li key={`${opt.rowId}::${opt.colId}`}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-xs transition-colors",
                  index === highlightIndex
                    ? "bg-violet-50 text-violet-900"
                    : "hover:bg-slate-50 text-slate-700"
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(opt)
                }}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                <span className="font-medium text-slate-800">{opt.rowLabel}</span>
                <span className="text-slate-400 mx-1.5">&gt;</span>
                <span className="text-slate-600">{opt.colLabel}</span>
                <span className="ml-2 font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {opt.cellValue.trim() || "(空)"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  )
}

function MentionHint() {
  return (
    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
      <Database className="w-3 h-3 shrink-0" />
      输入 <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[9px]">@</kbd>{" "}
      引用表格单元格；Excel 批量粘贴可用{" "}
      <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[9px]">
        {"{{行名::列名}}"}
      </kbd>
    </p>
  )
}

interface TableVariableMentionInputProps {
  value: string
  onChange: (value: string) => void
  tableData?: MatrixTableData
  className?: string
  placeholder?: string
  disabled?: boolean
  /** 标题字段略宽样式 */
  variant?: "default" | "title"
  showMentionHint?: boolean
}

export function TableVariableMentionInput({
  value,
  onChange,
  tableData,
  className,
  placeholder,
  disabled = false,
  variant = "default",
  showMentionHint = false,
}: TableVariableMentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const engine = useTableVariableMention({
    value,
    onChange,
    tableData,
    disabled,
    getCursor: () => inputRef.current?.selectionStart ?? value.length,
    setCursor: (pos) => inputRef.current?.setSelectionRange(pos, pos),
    focusInput: () => inputRef.current?.focus(),
  })

  useEffect(() => {
    ;(engine.anchorRef as React.MutableRefObject<HTMLElement | null>).current = inputRef.current
  })

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    const cursor = e.target.selectionStart ?? next.length
    onChange(next)
    engine.syncMentionFromCursor(next, cursor)
  }

  const variantClass =
    variant === "title"
      ? "h-9 text-sm bg-white/80 border border-slate-200 rounded-lg focus-visible:ring-2 focus-visible:ring-violet-500/20 focus-visible:border-violet-400"
      : "h-9 text-sm bg-white/80 border border-slate-200 rounded-lg focus-visible:ring-2 focus-visible:ring-violet-500/20 focus-visible:border-violet-400"

  return (
    <div className="relative isolate">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          engine.handleKeyDown(e)
        }}
        onClick={(e) =>
          engine.syncMentionFromCursor(value, e.currentTarget.selectionStart ?? value.length)
        }
        onKeyUp={(e) =>
          engine.syncMentionFromCursor(value, e.currentTarget.selectionStart ?? value.length)
        }
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full outline-none transition-colors disabled:opacity-50",
          variantClass,
          className
        )}
      />
      {showMentionHint && engine.hasTableData ? <MentionHint /> : null}
      <TableVariableMentionMenu
        open={engine.mentionOpen}
        menuRef={engine.menuRef}
        menuPos={engine.menuPos}
        mentionQuery={engine.mentionQuery}
        filteredOptions={engine.filteredOptions}
        highlightIndex={engine.highlightIndex}
        setHighlightIndex={engine.setHighlightIndex}
        insertMention={engine.insertMention}
      />
    </div>
  )
}

interface TableVariableMentionTextareaProps {
  value: string
  onChange: (value: string) => void
  tableData?: MatrixTableData
  className?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
  showMentionHint?: boolean
}

export function TableVariableMentionTextarea({
  value,
  onChange,
  tableData,
  className,
  placeholder,
  rows = 4,
  disabled = false,
  showMentionHint = false,
}: TableVariableMentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  const engine = useTableVariableMention({
    value,
    onChange,
    tableData,
    disabled,
    getCursor: () => textareaRef.current?.selectionStart ?? value.length,
    setCursor: (pos) => textareaRef.current?.setSelectionRange(pos, pos),
    focusInput: () => textareaRef.current?.focus(),
  })

  useEffect(() => {
    ;(engine.anchorRef as React.MutableRefObject<HTMLElement | null>).current = anchorRef.current
  })

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    const cursor = e.target.selectionStart ?? next.length
    onChange(next)
    engine.syncMentionFromCursor(next, cursor)
  }

  return (
    <div className="relative isolate">
      <div ref={anchorRef}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => {
            engine.handleKeyDown(e)
          }}
          onClick={(e) =>
            engine.syncMentionFromCursor(value, e.currentTarget.selectionStart ?? value.length)
          }
          onKeyUp={(e) =>
            engine.syncMentionFromCursor(value, e.currentTarget.selectionStart ?? value.length)
          }
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn(
            "w-full p-3 text-sm border rounded-lg resize-none",
            "focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400",
            "transition-all duration-200 bg-white/80",
            className
          )}
        />
      </div>
      {showMentionHint && engine.hasTableData ? <MentionHint /> : null}
      <TableVariableMentionMenu
        open={engine.mentionOpen}
        menuRef={engine.menuRef}
        menuPos={engine.menuPos}
        mentionQuery={engine.mentionQuery}
        filteredOptions={engine.filteredOptions}
        highlightIndex={engine.highlightIndex}
        setHighlightIndex={engine.setHighlightIndex}
        insertMention={engine.insertMention}
      />
    </div>
  )
}
