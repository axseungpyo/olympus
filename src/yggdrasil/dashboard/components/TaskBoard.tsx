"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskStatus } from "../lib/types";
import { TASK_STATUS_CONFIG } from "../lib/constants";
import { authFetch } from "../lib/auth";
import TaskEditor from "./TaskEditor";

interface TaskBoardProps {
  tasks: Task[];
  onDocClick?: (type: "tp" | "rp", id: string) => void;
}

interface TaskDetail {
  id: string;
  title: string;
  agent: string;
  status: TaskStatus;
  content: string;
  rpContent?: string;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "in-progress", label: "In Progress" },
  { status: "review-needed", label: "Review" },
  { status: "done", label: "Done" },
];

function TaskCard({
  task,
  onStatusChange,
  onViewDetail,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onViewDetail: (id: string) => void;
}) {
  const statusConfig = TASK_STATUS_CONFIG[task.status];

  // Determine next logical status
  const nextStatus: Partial<Record<TaskStatus, { label: string; target: TaskStatus }>> = {
    draft: { label: "Assign", target: "in-progress" },
    "in-progress": { label: "Review", target: "review-needed" },
    "review-needed": { label: "Done", target: "done" },
  };
  const next = nextStatus[task.status];

  return (
    <div className="bg-bg-primary border border-border/50 rounded-lg p-3 hover:border-slate-600/60 transition group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono text-slate-500">{task.id}</span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ color: statusConfig.color, backgroundColor: `${statusConfig.color}15` }}
        >
          {statusConfig.label}
        </span>
      </div>

      <button
        onClick={() => onViewDetail(task.id)}
        className="text-[13px] text-slate-200 text-left hover:text-slate-100 transition leading-snug w-full"
      >
        {task.title}
      </button>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] font-mono text-slate-600">{task.agent}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {next && (
            <button
              onClick={() => onStatusChange(task.id, next.target)}
              className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition"
            >
              {next.label} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskBoard({ tasks, onDocClick }: TaskBoardProps) {
  const [showEditor, setShowEditor] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [localTasks, setLocalTasks] = useState(tasks);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const handleStatusChange = useCallback(async (id: string, status: TaskStatus) => {
    try {
      await authFetch(`/api/tasks/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // Optimistic update
      setLocalTasks(prev =>
        status === "done"
          ? prev.filter(t => t.id !== id)
          : prev.map(t => (t.id === id ? { ...t, status } : t))
      );
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  }, []);

  const handleViewDetail = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/tasks/${id}`);
      const data = await res.json();
      setSelectedTask(data);
    } catch {
      // Fallback: open via onDocClick
      const num = id.replace("TP-", "");
      onDocClick?.("tp", num);
    }
  }, [onDocClick]);

  const handleTaskCreated = useCallback(async () => {
    setShowEditor(false);
    // Refresh tasks
    try {
      const res = await authFetch("/api/tasks");
      const data = await res.json();
      if (data.active) setLocalTasks(data.active);
    } catch { /* ignore */ }
  }, []);

  // Group tasks by status
  const grouped: Record<TaskStatus, Task[]> = {
    draft: [],
    "in-progress": [],
    "review-needed": [],
    done: [],
    blocked: [],
  };
  for (const task of localTasks) {
    if (grouped[task.status]) {
      grouped[task.status].push(task);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-mono font-medium text-slate-400 uppercase tracking-[0.15em]">
          Task Board
        </h2>
        <button
          onClick={() => setShowEditor(true)}
          className="px-3 py-1.5 text-[12px] font-mono rounded-md border border-border bg-bg-secondary text-slate-300 hover:border-slate-500 hover:text-slate-100 transition"
        >
          + New Rune
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map(({ status, label }) => {
          const colTasks = grouped[status] ?? [];
          const statusConfig = TASK_STATUS_CONFIG[status];
          return (
            <div key={status} className="bg-bg-secondary/50 border border-border/40 rounded-lg p-3 min-h-[120px]">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: statusConfig.color }}
                />
                <span className="text-[12px] font-mono text-slate-400">
                  {label}
                </span>
                <span className="text-[10px] font-mono text-slate-600 ml-auto">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-2">
                {colTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onViewDetail={handleViewDetail}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="text-[11px] font-mono text-slate-600 text-center py-4">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Blocked tasks (if any) */}
      {grouped.blocked.length > 0 && (
        <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
          <div className="text-[12px] font-mono text-red-400 mb-2">Blocked ({grouped.blocked.length})</div>
          <div className="space-y-2">
            {grouped.blocked.map(task => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onViewDetail={handleViewDetail} />
            ))}
          </div>
        </div>
      )}

      {/* Task Editor Modal */}
      {showEditor && (
        <TaskEditor onClose={() => setShowEditor(false)} onCreated={handleTaskCreated} />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm" onClick={() => setSelectedTask(null)} />
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-bg-primary p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-mono text-slate-500">{selectedTask.id}</span>
                <h3 className="text-lg font-mono text-slate-100">{selectedTask.title}</h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-500 hover:text-slate-300 transition text-lg"
              >
                ✕
              </button>
            </div>

            {/* TP Content */}
            <div className="mb-4">
              <div className="text-[11px] font-mono text-slate-500 uppercase mb-2">Rune (TP)</div>
              <pre className="text-[12px] text-slate-300 whitespace-pre-wrap font-mono bg-bg-secondary/50 rounded-lg p-4 border border-border/30 max-h-[300px] overflow-y-auto">
                {selectedTask.content || "No content"}
              </pre>
            </div>

            {/* RP Content (if exists) */}
            {selectedTask.rpContent && (
              <div>
                <div className="text-[11px] font-mono text-slate-500 uppercase mb-2">Saga (RP)</div>
                <pre className="text-[12px] text-slate-300 whitespace-pre-wrap font-mono bg-bg-secondary/50 rounded-lg p-4 border border-border/30 max-h-[300px] overflow-y-auto">
                  {selectedTask.rpContent}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border/40">
              {selectedTask.status === "review-needed" && selectedTask.rpContent && (
                <button
                  onClick={async () => {
                    await handleStatusChange(selectedTask.id, "done");
                    setSelectedTask(null);
                  }}
                  className="px-4 py-2 text-[12px] font-mono rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                >
                  Approve
                </button>
              )}
              {selectedTask.status === "draft" && (
                <button
                  onClick={async () => {
                    await handleStatusChange(selectedTask.id, "in-progress");
                    setSelectedTask(null);
                  }}
                  className="px-4 py-2 text-[12px] font-mono rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                >
                  Assign
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
