import type { TaskStatus } from "../dashboard/lib/types";

export interface TPMeta {
  id: string;
  status: TaskStatus;
  dependsOn: string[];
}

export interface DependencyGraph {
  nodes: Map<string, string[]>;
}

export function parseDependencies(tpContent: string): string[] {
  const match = tpContent.match(/^- Depends On:\s*(.*)$/im);
  if (!match) return [];

  const rawValue = match[1].trim();
  if (!rawValue) return [];

  return rawValue
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^TP-\d{3}$/.test(value));
}

export function buildDependencyGraph(tpFiles: TPMeta[]): DependencyGraph {
  const nodes = new Map<string, string[]>();

  for (const tp of tpFiles) {
    nodes.set(tp.id, [...tp.dependsOn]);
  }

  return { nodes };
}

export function getExecutionOrder(graph: DependencyGraph): string[][] {
  if (graph.nodes.size === 0) return [];

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const [node, dependencies] of graph.nodes.entries()) {
    indegree.set(node, dependencies.filter((dependency) => graph.nodes.has(dependency)).length);
    dependents.set(node, []);
  }

  for (const [node, dependencies] of graph.nodes.entries()) {
    for (const dependency of dependencies) {
      if (!graph.nodes.has(dependency)) continue;
      dependents.get(dependency)!.push(node);
    }
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([node]) => node)
    .sort((a, b) => a.localeCompare(b));

  const executionOrder: string[][] = [];
  let visited = 0;

  while (queue.length > 0) {
    const level = [...queue];
    queue.length = 0;
    executionOrder.push(level);

    for (const node of level) {
      visited += 1;
      const nextNodes = [...(dependents.get(node) ?? [])].sort((a, b) => a.localeCompare(b));
      for (const dependent of nextNodes) {
        const nextDegree = (indegree.get(dependent) ?? 0) - 1;
        indegree.set(dependent, nextDegree);
        if (nextDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    queue.sort((a, b) => a.localeCompare(b));
  }

  return visited === graph.nodes.size ? executionOrder : [];
}

export function detectCycle(graph: DependencyGraph): string[] | null {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      return cycleStart >= 0 ? [...stack.slice(cycleStart), node] : [node, node];
    }

    if (visited.has(node)) return null;

    visiting.add(node);
    stack.push(node);

    for (const dependency of graph.nodes.get(node) ?? []) {
      if (!graph.nodes.has(dependency)) continue;
      const cycle = dfs(dependency);
      if (cycle) return cycle;
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of [...graph.nodes.keys()].sort((a, b) => a.localeCompare(b))) {
    const cycle = dfs(node);
    if (cycle) return cycle;
  }

  return null;
}
