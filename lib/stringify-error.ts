/**
 * 将 unknown 错误序列化为可读 JSON（避免 console 里出现 [object Object] 或 Error 被 JSON.stringify 成 {}）
 */
export function stringifyErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify(
      { name: error.name, message: error.message, stack: error.stack },
      null,
      2
    )
  }
  try {
    return JSON.stringify(error, null, 2)
  } catch {
    return String(error)
  }
}

export function supabaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  const o = error as { message?: unknown }
  if (typeof o?.message === "string" && o.message.trim().length > 0) return o.message
  return stringifyErrorForLog(error)
}
