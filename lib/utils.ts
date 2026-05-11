import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 客户端唯一 id（表格行/列、列表 key、临时实体等）。
 * 优先 `crypto.randomUUID()`；否则用时间戳 + 多段随机串，避免同毫秒内批量生成重复。
 */
export function uniqueClientId(prefix: string): string {
  const safePrefix = prefix.replace(/\s+/g, "_") || "id"
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${safePrefix}_${crypto.randomUUID()}`
  }
  const r = () => Math.random().toString(36).slice(2, 11)
  const t = Date.now()
  const perf = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : 0
  return `${safePrefix}_${t}_${perf.toFixed(3)}_${r()}_${r()}_${Math.floor(Math.random() * 1e9)}`
}
