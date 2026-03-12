import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeFileSystem } from "../adapters/filesystem/NodeFileSystem";
import { FileSystemToolExecutor } from "../adapters/tools/FileSystemToolExecutor";
import { SkillToolExecutor } from "../adapters/tools/SkillToolExecutor";
import type { ISkillRegistry } from "../core/ports/ISkillRegistry";

describe("FileSystemToolExecutor", () => {
  let rootDir: string;
  let executor: FileSystemToolExecutor;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "asgard-tools-"));
    await fs.mkdir(path.join(rootDir, "src", "nested"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "node_modules", "pkg"), { recursive: true });
    await fs.mkdir(path.join(rootDir, ".git"), { recursive: true });
    await fs.mkdir(path.join(rootDir, "artifacts", "handoff"), { recursive: true });
    await fs.writeFile(path.join(rootDir, "src", "nested", "sample.ts"), "export const rune = 'odin';\nconst status = 'ready';\n", "utf-8");
    await fs.writeFile(path.join(rootDir, ".env"), "SECRET=1\n", "utf-8");
    await fs.writeFile(path.join(rootDir, "artifacts", "handoff", "RP-024.md"), "## Acceptance Criteria Check\n- [x] AC 1\n- [ ] AC 2\n", "utf-8");
    executor = new FileSystemToolExecutor(new NodeFileSystem(), rootDir);
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it("blocks paths outside the project root", async () => {
    const result = await executor.execute({ name: "read_file", input: { path: "../outside.txt" } }, rootDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain("프로젝트 루트 밖");
  });

  it("blocks protected paths", async () => {
    const envResult = await executor.execute({ name: "read_file", input: { path: ".env" } }, rootDir);
    const nodeModulesResult = await executor.execute({ name: "list_directory", input: { path: "node_modules" } }, rootDir);
    const gitResult = await executor.execute({ name: "list_directory", input: { path: ".git" } }, rootDir);

    expect(envResult.error).toContain("보호된 경로");
    expect(nodeModulesResult.error).toContain("보호된 경로");
    expect(gitResult.error).toContain("보호된 경로");
  });

  it("reads files within the project root", async () => {
    const result = await executor.execute({ name: "read_file", input: { path: "src/nested/sample.ts" } }, rootDir);
    expect(result.success).toBe(true);
    expect(result.output).toContain("export const rune");
  });

  it("writes files within the project root", async () => {
    const result = await executor.execute(
      { name: "write_file", input: { path: "notes/output.txt", content: "hello asgard" } },
      rootDir,
    );

    expect(result.success).toBe(true);
    await expect(fs.readFile(path.join(rootDir, "notes", "output.txt"), "utf-8")).resolves.toBe("hello asgard");
  });

  it("lists directory contents", async () => {
    const result = await executor.execute({ name: "list_directory", input: { path: "src" } }, rootDir);
    expect(result.success).toBe(true);
    expect(result.output).toContain("[dir] nested");
  });

  it("searches the codebase", async () => {
    const result = await executor.execute(
      { name: "search_codebase", input: { pattern: "status", path: "src", glob: "*.ts" } },
      rootDir,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("src/nested/sample.ts:2");
  });

  it("reviews a saga file", async () => {
    const result = await executor.execute({ name: "review_saga", input: { rp_id: "RP-024" } }, rootDir);
    expect(result.success).toBe(true);
    expect(result.output).toContain("1. PASS");
    expect(result.output).toContain("2. FAIL");
  });

  it("reports supported tools through canHandle", () => {
    expect(executor.canHandle("read_file")).toBe(true);
    expect(executor.canHandle("write_file")).toBe(true);
    expect(executor.canHandle("list_directory")).toBe(true);
    expect(executor.canHandle("search_codebase")).toBe(true);
    expect(executor.canHandle("review_saga")).toBe(true);
    expect(executor.canHandle("delegate_task")).toBe(false);
  });
});

describe("SkillToolExecutor", () => {
  const execute = vi.fn(async (skill: string, args: string) => `${skill}:${args}`);
  const skillRegistry: ISkillRegistry = {
    match() {
      return null;
    },
    execute,
    listSkills() {
      return [];
    },
  };

  beforeEach(() => {
    execute.mockClear();
  });

  it("routes get_status to the status skill", async () => {
    const executor = new SkillToolExecutor(skillRegistry);
    const result = await executor.execute({ name: "get_status", input: {} }, "/tmp/asgard");

    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledWith("status", "");
    expect(result.metadata?.skill).toBe("status");
  });

  it("routes create_task and validate_task to the expected skills", async () => {
    const executor = new SkillToolExecutor(skillRegistry);

    await executor.execute({
      name: "create_task",
      input: { title: "Title", objective: "Objective", agent: "brokkr" },
    }, "/tmp/asgard");
    await executor.execute({
      name: "validate_task",
      input: { tp_id: "TP-024" },
    }, "/tmp/asgard");

    expect(execute).toHaveBeenCalledWith("plan", "Title | Objective | brokkr");
    expect(execute).toHaveBeenCalledWith("validate", "TP-024");
  });

  it("reports supported skill tools through canHandle", () => {
    const executor = new SkillToolExecutor(skillRegistry);
    expect(executor.canHandle("get_status")).toBe(true);
    expect(executor.canHandle("create_task")).toBe(true);
    expect(executor.canHandle("validate_task")).toBe(true);
    expect(executor.canHandle("search_codebase")).toBe(false);
  });
});
