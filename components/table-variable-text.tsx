"use client"

import { useMemo } from "react"
import type { MatrixTableData } from "@/components/requirement-drawer"
import { cn } from "@/lib/utils"
import { parseTextWithTableTokens, resolveCellValue } from "@/lib/table-variable-binding"

interface TableVariableTextProps {
  text: string
  tableData?: MatrixTableData
  className?: string
  emptyLabel?: string
}

export function TableVariableText({
  text,
  tableData,
  className,
  emptyLabel = "无",
}: TableVariableTextProps) {
  const parts = useMemo(() => parseTextWithTableTokens(text), [text])

  if (!text.trim()) {
    return <span className={cn("text-slate-400", className)}>{emptyLabel}</span>
  }

  return (
    <span className={cn("whitespace-pre-wrap leading-relaxed", className)}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.value}</span>
        }

        if (part.type === "not_found") {
          return (
            <span
              key={index}
              className="text-rose-500 text-xs font-medium"
              title={`未找到匹配 ${part.raw}`}
            >
              {"{{"}
              {part.rowName}::{part.colName}
              {"}}"}
            </span>
          )
        }

        const resolved = resolveCellValue(tableData, part.rowId, part.colId)
        if (resolved === null) {
          return (
            <span
              key={index}
              className="text-rose-500 line-through text-xs font-medium"
              title={`已失效引用 ${part.raw}`}
            >
              已失效参数
            </span>
          )
        }

        return (
          <span
            key={index}
            className="inline-flex items-center px-1 py-0.5 mx-0.5 bg-blue-50 text-blue-600 rounded text-xs font-mono align-baseline"
            title={`表格引用 ${part.raw}`}
          >
            {resolved || "(空)"}
          </span>
        )
      })}
    </span>
  )
}
