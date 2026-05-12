"use client"

import { Card, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle2, History, FlaskConical } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { RequirementCardTestPhase } from "@/components/test-cases-important-filter-context"

export interface Requirement {
  id: string
  title: string
  status: "todo" | "in-progress" | "done"
  iterations: number
}

interface RequirementCardProps {
  requirement: Requirement
  index: number
  onClick?: () => void
  onTestClick?: () => void
  onIterationClick?: () => void
  /** 测试红绿灯：noTest 未配置 | inProgress 有目标未全勾 | completed 目标全勾 | idleFilter 有用例但过滤下无目标 */
  testPhase?: RequirementCardTestPhase
  iterationCount?: number
}

const statusDot = {
  "todo": "bg-slate-400",
  "in-progress": "bg-sky-500",
  "done": "bg-emerald-500",
}

export function RequirementCard({ 
  requirement, 
  index, 
  onClick,
  onTestClick,
  onIterationClick,
  testPhase = "inProgress",
  iterationCount = 0,
}: RequirementCardProps) {
  const handleTestIconClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onTestClick?.()
  }

  const handleHistoryIconClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onIterationClick?.()
  }

  return (
    <>
      <Card 
        className={cn(
          "group relative bg-white border transition-all duration-200 ease-out cursor-pointer",
          "hover:shadow-xl hover:shadow-slate-300/40 hover:-translate-y-1",
          testPhase === "completed" && "border-emerald-200 ring-1 ring-emerald-200/90 hover:border-emerald-300",
          testPhase === "inProgress" && "border-sky-100 hover:border-sky-200/80",
          (testPhase === "noTest" || testPhase === "idleFilter") &&
            "border-slate-200 hover:border-slate-300"
        )}
        style={{
          animationDelay: `${index * 20}ms`
        }}
        onClick={onClick}
      >
        <CardHeader className="p-2.5">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {/* Status dot */}
            <div className={cn(
              "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-transform duration-200",
              "group-hover:scale-125",
              statusDot[requirement.status]
            )} />
            
            {/* Title and iteration badge */}
            <div className="flex-1 min-w-0 flex items-start gap-1.5">
              <CardTitle className="text-xs font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-snug line-clamp-2 flex-1 min-w-0">
                {requirement.title}
              </CardTitle>
              
              {iterationCount > 0 && (
                <Badge 
                  variant="secondary"
                  className={cn(
                    "shrink-0 text-[9px] px-1 py-0 h-4 font-normal leading-none",
                    "bg-amber-50 text-amber-600 border-amber-200"
                  )}
                >
                  迭代{iterationCount}
                </Badge>
              )}
            </div>
          </div>
          
          <CardAction>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleHistoryIconClick}
                      className={cn(
                        "shrink-0 p-1 rounded-full hover:bg-slate-100 transition-colors",
                        testPhase === "noTest" ? "text-slate-300" : "text-slate-400 hover:text-slate-700"
                      )}
                    aria-label="查看版本历史"
                  >
                      <History className="w-4 h-4" strokeWidth={2} />
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  查看版本历史
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleTestIconClick}
                      className={cn(
                        "shrink-0 p-1 rounded-full hover:bg-slate-100 transition-colors",
                        testPhase === "completed" && "text-emerald-500",
                        testPhase === "noTest" && "text-slate-300",
                        testPhase === "inProgress" && "text-emerald-500",
                        testPhase === "idleFilter" && "text-slate-400"
                      )}
                      aria-label={
                        testPhase === "completed"
                          ? "查看测试执行（目标已全部完成）"
                          : testPhase === "noTest"
                            ? "未配置用例"
                            : testPhase === "idleFilter"
                              ? "查看测试执行（当前无重点用例）"
                              : "执行测试用例（进行中）"
                      }
                  >
                      {testPhase === "completed" ? (
                        <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                      ) : (
                        <FlaskConical
                          className={cn(
                            "w-4 h-4",
                            testPhase === "noTest" && "text-slate-300",
                            testPhase === "inProgress" && "text-emerald-500",
                            testPhase === "idleFilter" && "text-slate-400"
                          )}
                          strokeWidth={2}
                        />
                      )}
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                    {testPhase === "completed"
                      ? "查看测试执行（目标已全部完成）"
                      : testPhase === "noTest"
                        ? "未配置用例"
                        : testPhase === "idleFilter"
                          ? "查看测试执行（仅看重点：暂无标星用例）"
                          : "点击执行测试用例（进行中）"}
                </TooltipContent>
              </Tooltip>
            </div>
          </CardAction>
        </CardHeader>
      </Card>

    </>
  )
}
