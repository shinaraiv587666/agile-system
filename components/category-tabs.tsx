"use client"

import { useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  LayoutGrid,
  Globe,
  Zap,
  Sparkles,
  Rocket,
  Flame,
  Compass,
  Box,
  Layers,
  Cpu,
  Orbit,
  CircuitBoard,
  Satellite,
  Radar,
  Telescope,
  Atom,
  Hexagon,
  FlaskConical,
  Shield,
  Database,
  Network,
  User,
  CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface Category {
  id: string
  name: string
  count: number
  icon?: string
}

interface CategoryTabsProps {
  categories: Category[]
  activeId: string
  onSelect: (id: string) => void
  onAddCategory?: (name: string) => Promise<void>
  onRenameCategory?: (oldName: string, newName: string) => Promise<void>
  onDeleteCategory?: (name: string) => Promise<void>
}

export function CategoryTabs({
  categories,
  activeId,
  onSelect,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener("resize", checkScroll)
    return () => window.removeEventListener("resize", checkScroll)
  }, [])

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      })
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return
    await onAddCategory(newCategoryName.trim())
    setNewCategoryName("")
    setIsAdding(false)
  }

  const startEditingCategory = (name: string) => {
    setEditingName(name)
    setEditingValue(name)
  }

  const handleRenameCategory = async () => {
    if (!editingName || !editingValue.trim() || !onRenameCategory) return
    await onRenameCategory(editingName, editingValue.trim())
    setEditingName(null)
    setEditingValue("")
  }

  const handleDeleteCategory = async (name: string) => {
    if (!onDeleteCategory) return
    await onDeleteCategory(name)
    if (editingName === name) {
      setEditingName(null)
      setEditingValue("")
    }
  }

  // Stable pseudo-random icon pick (no flicker between renders)
  const ICON_POOL: any[] = [
    Zap,
    Sparkles,
    Rocket,
    Flame,
    Compass,
    Box,
    Layers,
    Cpu,
    Orbit,
    CircuitBoard,
    Satellite,
    Radar,
    Telescope,
    Atom,
    Hexagon,
    FlaskConical,
    Shield,
    Database,
    Network,
    User,
    CreditCard,
    // fallback icons (still deterministic) to ensure enough variety
    Globe,
    LayoutGrid,
  ]

  const hashAsciiSum = (s: string) => {
    let sum = 0
    const str = String(s ?? "")
    for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i)
    return sum
  }

  const getCategoryIcon = (id: string, name: string) => {
    // "All" is fixed icon
    if (id === "all") return LayoutGrid
    const key = `${id}::${name}`
    const idx = hashAsciiSum(key) % ICON_POOL.length
    return ICON_POOL[idx]
  }

  return (
    <div className="relative group/tabs rounded-xl bg-slate-50/60 border border-slate-200/70 p-1.5">
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all opacity-0 group-hover/tabs:opacity-100"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Tabs container */}
      <div className="flex items-center gap-2">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-2 overflow-x-auto whitespace-nowrap scroll-smooth px-1 py-1 flex-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-1 shrink-0 group/item">
              {editingName === category.name ? (
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="h-7 w-36 text-xs border-0 shadow-none px-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameCategory()
                      if (e.key === "Escape") {
                        setEditingName(null)
                        setEditingValue("")
                      }
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleRenameCategory}>
                    <Check className="w-3 h-3 text-emerald-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setEditingName(null)
                      setEditingValue("")
                    }}
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(category.id)}
                    className={cn(
                      "relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap min-w-[110px]",
                      "transition-all duration-200 ease-out shrink-0",
                      activeId === category.id
                        ? "bg-white text-slate-900 font-medium shadow-sm border border-slate-200"
                        : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70"
                    )}
                  >
                    {(() => {
                      const Icon = getCategoryIcon(category.id, category.name)
                      return <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                    })()}
                    <span>{category.name}</span>
                    <span className={cn(
                      "min-w-5 h-5 rounded-full text-[10px] flex items-center justify-center",
                      activeId === category.id
                        ? "bg-slate-100 text-slate-600"
                        : "bg-transparent text-slate-400"
                    )}>
                      {category.count}
                    </span>
                    {category.id !== "all" && (
                      <span className="flex items-center gap-0.5 ml-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <span
                          role="button"
                          tabIndex={0}
                          className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditingCategory(category.name)
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 hover:text-rose-600"
                          onClick={async (e) => {
                            e.stopPropagation()
                            await handleDeleteCategory(category.name)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        {isAdding ? (
          <div className="flex items-center gap-1 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="h-7 w-32 text-xs border-0 shadow-none px-1"
              placeholder="分类名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory()
                if (e.key === "Escape") {
                  setIsAdding(false)
                  setNewCategoryName("")
                }
              }}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAddCategory}>
              <Check className="w-3 h-3 text-emerald-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                setIsAdding(false)
                setNewCategoryName("")
              }}
            >
              <X className="w-3 h-3 text-slate-500" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs gap-1 shrink-0 text-slate-400 hover:text-slate-800"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-3 h-3" />
            新建
          </Button>
        )}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all opacity-0 group-hover/tabs:opacity-100"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Gradient masks */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />
      )}

    </div>
  )
}
