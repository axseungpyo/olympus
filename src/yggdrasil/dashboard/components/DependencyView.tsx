"use client";

import { useMemo } from "react";
import type { DependencyGraphNode, DependencyGraphResponse } from "../lib/types";

interface DependencyViewProps {
  graph: DependencyGraphResponse | null;
}

const STATUS_COLOR: Record<string, string> = {
  done: "#86efac",
  "in-progress": "#f59e0b",
  draft: "#94a3b8",
  blocked: "#ef4444",
  "review-needed": "#d4d4d8",
};

const COLUMN_WIDTH = 220;
const NODE_WIDTH = 172;
const NODE_HEIGHT = 88;
const NODE_GAP = 34;
const COLUMN_GAP = 48;
const PADDING_X = 24;
const PADDING_Y = 24;

export default function DependencyView({ graph }: DependencyViewProps) {
  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return null;

    const layeredOrder = graph.executionOrder.length > 0
      ? graph.executionOrder
      : [graph.nodes.map((node) => node.id).sort((a, b) => a.localeCompare(b))];
    const assigned = new Set(layeredOrder.flat());
    const overflow = graph.nodes
      .map((node) => node.id)
      .filter((id) => !assigned.has(id))
      .sort((a, b) => a.localeCompare(b));
    const columns = overflow.length > 0 ? [...layeredOrder, overflow] : layeredOrder;

    const positions = new Map<string, { x: number; y: number }>();
    const height = Math.max(
      ...columns.map((column) => PADDING_Y * 2 + column.length * NODE_HEIGHT + Math.max(0, column.length - 1) * NODE_GAP),
      180
    );
    const width = Math.max(
      PADDING_X * 2 + columns.length * COLUMN_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP,
      320
    );

    columns.forEach((column, columnIndex) => {
      const totalColumnHeight =
        column.length * NODE_HEIGHT + Math.max(0, column.length - 1) * NODE_GAP;
      const startY = Math.max(PADDING_Y, (height - totalColumnHeight) / 2);
      const x = PADDING_X + columnIndex * (COLUMN_WIDTH + COLUMN_GAP);

      column.forEach((id, rowIndex) => {
        positions.set(id, {
          x,
          y: startY + rowIndex * (NODE_HEIGHT + NODE_GAP),
        });
      });
    });

    return { columns, positions, width, height };
  }, [graph]);

  if (!graph) {
    return (
      <div className="bg-bg-secondary border border-border/60 rounded-lg p-8 text-center">
        <p className="text-slate-500 text-[13px] font-mono">Loading dependency graph...</p>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border/60 rounded-lg p-8 text-center">
        <p className="text-slate-500 text-[13px] font-mono">No TP dependencies declared</p>
      </div>
    );
  }

  const readyIds = new Set(
    graph.nodes
      .filter((node) => node.dependsOn.length === 0 || node.dependsOn.every((dependency) => {
        const dependencyNode = graph.nodes.find((candidate) => candidate.id === dependency);
        return !dependencyNode || dependencyNode.status === "done";
      }))
      .map((node) => node.id)
  );

  return (
    <div className="bg-bg-secondary border border-border/60 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
        <div>
          <h3 className="text-[12px] font-mono font-medium text-slate-400 uppercase tracking-wider">
            Rune DAG
          </h3>
          <p className="mt-1 text-[12px] text-slate-500">
            상태 색상과 실행 가능 TP를 함께 표시합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <Legend label="done" color={STATUS_COLOR.done} />
          <Legend label="in-progress" color={STATUS_COLOR["in-progress"]} />
          <Legend label="draft" color={STATUS_COLOR.draft} />
          <Legend label="blocked" color={STATUS_COLOR.blocked} />
          <span className="rounded-full border border-cyan-400/40 px-2 py-1 text-cyan-300">
            ready
          </span>
        </div>
      </div>

      {graph.hasCycle && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] font-mono text-red-300">
          Cycle detected: {graph.cycle?.join(" -> ") ?? "unknown"}
        </div>
      )}

      <div className="overflow-x-auto p-4">
        <svg
          width={layout?.width ?? 320}
          height={layout?.height ?? 180}
          viewBox={`0 0 ${layout?.width ?? 320} ${layout?.height ?? 180}`}
          className="min-w-full"
          role="img"
          aria-label="TP dependency graph"
        >
          {graph.nodes.map((node) => (
            <DependencyEdges
              key={`edges-${node.id}`}
              node={node}
              positions={layout?.positions}
            />
          ))}

          {graph.nodes.map((node) => {
            const position = layout?.positions.get(node.id);
            if (!position) return null;

            const statusColor = STATUS_COLOR[node.status] ?? "#71717a";
            const isReady = readyIds.has(node.id) && node.status !== "done";

            return (
              <g key={node.id} transform={`translate(${position.x}, ${position.y})`} className="dag-node">
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="16"
                  className="dag-node-bg"
                  stroke={isReady ? "#67e8f9" : statusColor}
                  strokeWidth={isReady ? 2 : 1.25}
                />
                <rect
                  x="0"
                  y="0"
                  width={NODE_WIDTH}
                  height="6"
                  rx="16"
                  fill={statusColor}
                />
                <text x="16" y="28" className="dag-node-sub" fontSize="11" fontFamily="monospace">
                  {node.status}
                </text>
                <text x="16" y="52" className="dag-node-title" fontSize="18" fontFamily="monospace">
                  {node.id}
                </text>
                <text x="16" y="70" className="dag-node-sub" fontSize="11" fontFamily="monospace">
                  {node.dependsOn.length === 0
                    ? "No dependencies"
                    : `Depends on ${node.dependsOn.length}`}
                </text>
                {isReady && (
                  <text x="16" y="82" fill="#67e8f9" fontSize="10" fontFamily="monospace">
                    Ready to run
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function DependencyEdges({
  node,
  positions,
}: {
  node: DependencyGraphNode;
  positions: Map<string, { x: number; y: number }> | undefined;
}) {
  if (!positions) return null;

  return (
    <>
      {node.dependsOn.map((dependencyId) => {
        const from = positions.get(dependencyId);
        const to = positions.get(node.id);
        if (!from || !to) return null;

        const startX = from.x + NODE_WIDTH;
        const startY = from.y + NODE_HEIGHT / 2;
        const endX = to.x;
        const endY = to.y + NODE_HEIGHT / 2;
        const midX = (startX + endX) / 2;

        return (
          <g key={`${dependencyId}-${node.id}`}>
            <path
              d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX - 10} ${endY}`}
              fill="none"
              stroke="#64748b"
              strokeWidth="1.5"
            />
            <path
              d={`M ${endX - 10} ${endY - 5} L ${endX} ${endY} L ${endX - 10} ${endY + 5}`}
              fill="none"
              stroke="#64748b"
              strokeWidth="1.5"
            />
          </g>
        );
      })}
    </>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
