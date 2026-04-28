"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { 
  FolderKanban, 
  ChevronRight,
  Plus,
  Pencil,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface Project {
  id: string
  name: string
  color: string
  requirementsCount: number
  categories: string[]
}

interface ProjectSidebarProps {
  selectedProjectId: string
  onSelectProject: (id: string) => void
  projects: Project[]
  onCreateProject: (name: string) => Promise<void>
  onRenameProject: (id: string, name: string) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
}

export function ProjectSidebar({
  selectedProjectId,
  onSelectProject,
  projects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingName, setPendingName] = useState("")

  const openEdit = (project: Project) => {
    setPendingId(project.id)
    setPendingName(project.name)
    setEditOpen(true)
  }

  const openDelete = (project: Project) => {
    setPendingId(project.id)
    setPendingName(project.name)
    setDeleteOpen(true)
  }

  const handleCreate = async () => {
    const name = nameInput.trim()
    if (!name) return
    await onCreateProject(name)
    setNameInput("")
    setCreateOpen(false)
  }

  const handleRename = async () => {
    if (!pendingId || !pendingName.trim()) return
    await onRenameProject(pendingId, pendingName.trim())
    setEditOpen(false)
  }

  const handleDelete = async () => {
    if (!pendingId) return
    await onDeleteProject(pendingId)
    setDeleteOpen(false)
  }

  return (
    <aside className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Projects Section - directly at the top */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300 tracking-wide">项目列表</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
              {projects.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCreateOpen(true)}
              className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              onMouseEnter={() => setHoveredId(project.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                "w-full group flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-300 ease-out",
                selectedProjectId === project.id
                  ? "bg-slate-800/95 shadow-xl shadow-slate-950/70"
                  : "hover:bg-slate-800/50"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full transition-transform duration-200",
                project.color,
                selectedProjectId === project.id && "animate-pulse shadow-[0_0_14px_rgba(56,189,248,0.85)]",
                (hoveredId === project.id || selectedProjectId === project.id) && "scale-125"
              )} />
              <div className="flex-1 text-left min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate transition-colors duration-200",
                  selectedProjectId === project.id ? "text-white" : "text-slate-300"
                )}>
                  {project.name}
                </p>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">
                {project.requirementsCount}
              </span>
              <div className={cn(
                "flex items-center gap-1 transition-all duration-200",
                hoveredId === project.id ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
              )}>
                <span
                  role="button"
                  tabIndex={0}
                  className="h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-sky-300 hover:bg-slate-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(project)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      openEdit(project)
                    }
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className="h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-300 hover:bg-slate-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    openDelete(project)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      openDelete(project)
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </span>
              </div>
              <ChevronRight className={cn(
                "w-3.5 h-3.5 text-slate-600 transition-all duration-200 shrink-0",
                (hoveredId === project.id || selectedProjectId === project.id) 
                  ? "opacity-100 translate-x-0" 
                  : "opacity-0 -translate-x-2"
              )} />
            </button>
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>输入项目名称后即可创建。</DialogDescription>
          </DialogHeader>
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="例如：增长实验平台"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!nameInput.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>修改项目名称</DialogTitle>
            <DialogDescription>仅修改显示名称，不影响历史数据。</DialogDescription>
          </DialogHeader>
          <Input
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder="输入新的项目名称"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleRename} disabled={!pendingName.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目？</AlertDialogTitle>
            <AlertDialogDescription>
              你将删除项目「{pendingName}」。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
