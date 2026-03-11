import { describe, it, expect } from "vitest";
import { parseIndex } from "../domain/tasks/task-parser";

describe("parseIndex", () => {
  const VALID_INDEX = `# Asgard Chronicle

Last updated: 2026-03-09

## Active Tasks

| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | 공개 배포 구조 | codex | done | 2026-03-06 | 2026-03-06 |
| TP-002 | Dashboard UI | codex | in-progress | 2026-03-09 | 2026-03-09 |
| TP-003 | 인증 API | gemini | blocked | 2026-03-09 | 2026-03-09 |
| TP-004 | UI 클론 | gemini | review-needed | 2026-03-09 | 2026-03-09 |
| TP-005 | API 문서 | codex | draft | 2026-03-09 | 2026-03-09 |
`;

  it("parses all tasks from valid INDEX.md", () => {
    const tasks = parseIndex(VALID_INDEX);
    expect(tasks).toHaveLength(5);
  });

  it("extracts correct fields", () => {
    const tasks = parseIndex(VALID_INDEX);
    expect(tasks[0]).toEqual({
      id: "TP-001",
      title: "공개 배포 구조",
      agent: "codex",
      status: "done",
      created: "2026-03-06",
      updated: "2026-03-06",
    });
  });

  it("handles all valid statuses", () => {
    const tasks = parseIndex(VALID_INDEX);
    const statuses = tasks.map((t) => t.status);
    expect(statuses).toEqual(["done", "in-progress", "blocked", "review-needed", "draft"]);
  });

  it("falls back to draft for unknown status", () => {
    const input = `| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | Test | codex | unknown-status | 2026-01-01 | 2026-01-01 |`;
    const tasks = parseIndex(input);
    expect(tasks[0].status).toBe("draft");
  });

  it("returns empty array for empty input", () => {
    expect(parseIndex("")).toEqual([]);
  });

  it("returns empty array for non-table content", () => {
    expect(parseIndex("# Just a heading\nSome text")).toEqual([]);
  });

  it("ignores rows with fewer than 6 columns", () => {
    const input = `| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | Test | codex |`;
    expect(parseIndex(input)).toEqual([]);
  });

  it("stops parsing when table ends", () => {
    const input = `| ID | Title | Agent | Status | Created | Updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | Test | codex | done | 2026-01-01 | 2026-01-01 |

Some other content
| not | a | table |`;
    const tasks = parseIndex(input);
    expect(tasks).toHaveLength(1);
  });

  it("handles case-insensitive header detection", () => {
    const input = `| id | title | agent | status | created | updated |
|----|-------|-------|--------|---------|---------|
| TP-001 | Test | codex | done | 2026-01-01 | 2026-01-01 |`;
    expect(parseIndex(input)).toHaveLength(1);
  });
});
