import fs from "fs/promises";
import path from "path";
import type { IFileSystem, SearchResult } from "../../core/ports/IFileSystem";
import type { IToolExecutor, ToolResult } from "../../core/ports/IToolExecutor";
import type { LLMToolCall } from "../../core/ports/ILLMGateway";

const HANDLED_TOOLS = new Set(["read_file", "write_file", "list_directory", "search_codebase", "review_saga"]);
const BLOCKED_SEGMENTS = new Set(["node_modules", ".git"]);
const MAX_FILE_CONTENT = 10_000;
const MAX_SEARCH_RESULTS = 50;

export class FileSystemToolExecutor implements IToolExecutor {
  constructor(
    private readonly fileSystem: IFileSystem,
    private readonly projectRoot: string,
  ) {}

  canHandle(toolName: string): boolean {
    return HANDLED_TOOLS.has(toolName);
  }

  async execute(toolCall: LLMToolCall, projectRoot: string): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case "read_file":
          return await this.readFile(toolCall.input, projectRoot);
        case "write_file":
          return await this.writeFile(toolCall.input, projectRoot);
        case "list_directory":
          return await this.listDirectory(toolCall.input, projectRoot);
        case "search_codebase":
          return await this.searchCodebase(toolCall.input, projectRoot);
        case "review_saga":
          return await this.reviewSaga(toolCall.input, projectRoot);
        default:
          return { success: false, output: "", error: `지원하지 않는 도구: ${toolCall.name}` };
      }
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async readFile(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const absolutePath = await this.validatePath(this.readString(input, "path"), projectRoot);
    const content = await this.fileSystem.readFile(absolutePath);
    const truncated = content.length > MAX_FILE_CONTENT
      ? `${content.slice(0, MAX_FILE_CONTENT)}\n\n... (truncated)`
      : content;
    return { success: true, output: truncated };
  }

  private async writeFile(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const safeRoot = await this.resolveProjectRoot(projectRoot);
    const absolutePath = await this.validatePath(this.readString(input, "path"), projectRoot, true);
    const content = this.readString(input, "content", false);
    await this.fileSystem.writeFile(absolutePath, content);
    return { success: true, output: `파일 저장 완료: ${path.relative(safeRoot, absolutePath)}` };
  }

  private async listDirectory(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const requestedPath = this.readString(input, "path") || ".";
    const absolutePath = await this.validatePath(requestedPath, projectRoot);
    const entries = await this.fileSystem.listDirectory(absolutePath);
    const output = entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => `${entry.type === "directory" ? "[dir]" : "[file]"} ${entry.name} (${entry.size} bytes)`)
      .join("\n");
    return { success: true, output: output || "(empty directory)" };
  }

  private async searchCodebase(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const pattern = this.readString(input, "pattern");
    const requestedPath = this.readString(input, "path") || ".";
    const safeRoot = await this.resolveProjectRoot(projectRoot);
    const absolutePath = await this.validatePath(requestedPath, projectRoot);
    const glob = this.readString(input, "glob") || undefined;
    const results = await this.fileSystem.searchContent(absolutePath, pattern, glob);
    const limited = results.slice(0, MAX_SEARCH_RESULTS).map((result) => this.formatSearchResult(result, safeRoot));
    const suffix = results.length > MAX_SEARCH_RESULTS ? `\n... ${results.length - MAX_SEARCH_RESULTS} more matches` : "";
    return {
      success: true,
      output: limited.length > 0 ? `${limited.join("\n")}${suffix}` : "검색 결과가 없습니다.",
    };
  }

  private async reviewSaga(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const rpId = this.readString(input, "rp_id").toUpperCase();
    if (!/^RP-\d{3}$/.test(rpId)) {
      throw new Error("유효한 RP ID가 필요합니다. 예: RP-024");
    }

    const absolutePath = await this.validatePath(path.join("artifacts", "handoff", `${rpId}.md`), projectRoot);
    const content = await this.fileSystem.readFile(absolutePath);
    const acMatches = [...content.matchAll(/^- \[(x| )\]\s+(.*)$/gm)];
    const summary = acMatches.length === 0
      ? "Acceptance Criteria 항목을 찾지 못했습니다."
      : acMatches
        .map((match, index) => `${index + 1}. ${match[1] === "x" ? "PASS" : "FAIL"} - ${match[2]}`)
        .join("\n");

    return {
      success: true,
      output: `Saga Review: ${rpId}\n\n${summary}`,
    };
  }

  private formatSearchResult(result: SearchResult, projectRoot: string): string {
    return `${path.relative(projectRoot, result.file)}:${result.line} ${result.content.trim()}`;
  }

  private async validatePath(inputPath: string, projectRoot: string, allowMissing = false): Promise<string> {
    const safeRoot = await this.resolveProjectRoot(projectRoot);
    const requested = path.resolve(safeRoot, inputPath || ".");
    const relative = path.relative(safeRoot, requested);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`접근 거부: 프로젝트 루트 밖의 경로 — ${inputPath}`);
    }

    this.assertNotBlocked(relative, inputPath);

    const existingPath = await this.resolveExistingPath(requested, safeRoot, allowMissing);
    if (existingPath) {
      const existingRelative = path.relative(safeRoot, existingPath);
      if (existingRelative.startsWith("..") || path.isAbsolute(existingRelative)) {
        throw new Error(`접근 거부: 프로젝트 루트 밖의 경로 — ${inputPath}`);
      }
      this.assertNotBlocked(existingRelative, inputPath);
    }

    return requested;
  }

  private async resolveProjectRoot(projectRoot: string): Promise<string> {
    const candidate = path.resolve(projectRoot || this.projectRoot);
    return await this.fileSystem.exists(candidate) ? fs.realpath(candidate) : candidate;
  }

  private async resolveExistingPath(targetPath: string, safeRoot: string, allowMissing: boolean): Promise<string | null> {
    const exists = await this.fileSystem.exists(targetPath);
    if (exists) {
      return fs.realpath(targetPath);
    }

    if (!allowMissing) {
      throw new Error(`경로를 찾을 수 없습니다: ${path.relative(safeRoot, targetPath)}`);
    }

    let current = path.dirname(targetPath);
    while (current.startsWith(safeRoot)) {
      if (await this.fileSystem.exists(current)) {
        return fs.realpath(current);
      }
      if (current === safeRoot) {
        break;
      }
      current = path.dirname(current);
    }

    return null;
  }

  private assertNotBlocked(relativePath: string, originalPath: string): void {
    const segments = relativePath.split(path.sep).filter(Boolean);
    if (segments.some((segment) => BLOCKED_SEGMENTS.has(segment))) {
      throw new Error(`접근 거부: 보호된 경로 — ${originalPath}`);
    }

    const fileName = segments.at(-1) ?? "";
    if (fileName === ".env" || fileName.startsWith(".env.")) {
      throw new Error(`접근 거부: 보호된 경로 — ${originalPath}`);
    }
  }

  private readString(input: Record<string, unknown>, key: string, trim = true): string {
    const value = input[key];
    if (typeof value !== "string") {
      return "";
    }
    return trim ? value.trim() : value;
  }
}
