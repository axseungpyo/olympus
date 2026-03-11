import { describe, expect, it } from "vitest";
import {
  buildDependencyGraph,
  detectCycle,
  getExecutionOrder,
  parseDependencies,
  type TPMeta,
} from "../infra/dependency";

describe("dependency helpers", () => {
  it("parses no dependencies when field is missing", () => {
    const input = `# TP-010: Example

## Metadata
- Agent Target: codex
- Complexity: moderate`;

    expect(parseDependencies(input)).toEqual([]);
  });

  it("parses multiple dependencies from metadata", () => {
    const input = `## Metadata
- Depends On: TP-005, tp-006, INVALID, TP-007`;

    expect(parseDependencies(input)).toEqual(["TP-005", "TP-006", "TP-007"]);
  });

  it("returns linear execution order", () => {
    const graph = buildDependencyGraph(makeTpMeta([
      { id: "TP-001", dependsOn: [] },
      { id: "TP-002", dependsOn: ["TP-001"] },
      { id: "TP-003", dependsOn: ["TP-002"] },
    ]));

    expect(getExecutionOrder(graph)).toEqual([["TP-001"], ["TP-002"], ["TP-003"]]);
  });

  it("groups parallel executable nodes by level", () => {
    const graph = buildDependencyGraph(makeTpMeta([
      { id: "TP-001", dependsOn: [] },
      { id: "TP-002", dependsOn: ["TP-001"] },
      { id: "TP-003", dependsOn: ["TP-001"] },
      { id: "TP-004", dependsOn: ["TP-002", "TP-003"] },
    ]));

    expect(getExecutionOrder(graph)).toEqual([
      ["TP-001"],
      ["TP-002", "TP-003"],
      ["TP-004"],
    ]);
  });

  it("detects dependency cycles", () => {
    const graph = buildDependencyGraph(makeTpMeta([
      { id: "TP-001", dependsOn: ["TP-003"] },
      { id: "TP-002", dependsOn: ["TP-001"] },
      { id: "TP-003", dependsOn: ["TP-002"] },
    ]));

    expect(detectCycle(graph)).toEqual(["TP-001", "TP-003", "TP-002", "TP-001"]);
    expect(getExecutionOrder(graph)).toEqual([]);
  });

  it("handles empty graphs", () => {
    const graph = buildDependencyGraph([]);

    expect(graph.nodes.size).toBe(0);
    expect(getExecutionOrder(graph)).toEqual([]);
    expect(detectCycle(graph)).toBeNull();
  });
});

function makeTpMeta(
  items: Array<Pick<TPMeta, "id" | "dependsOn">>
): TPMeta[] {
  return items.map((item) => ({
    id: item.id,
    dependsOn: item.dependsOn,
    status: "draft",
  }));
}
