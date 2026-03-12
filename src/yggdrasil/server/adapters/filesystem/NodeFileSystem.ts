import fs from "fs/promises";
import path from "path";
import type { Dirent } from "fs";
import type { FileEntry, IFileSystem, SearchResult } from "../../core/ports/IFileSystem";

export class NodeFileSystem implements IFileSystem {
  async readFile(absolutePath: string): Promise<string> {
    return fs.readFile(absolutePath, "utf-8");
  }

  async writeFile(absolutePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf-8");
  }

  async listDirectory(absolutePath: string): Promise<FileEntry[]> {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    return Promise.all(entries.map(async (entry) => this.toFileEntry(absolutePath, entry)));
  }

  async exists(absolutePath: string): Promise<boolean> {
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async searchContent(rootPath: string, pattern: string, glob?: string): Promise<SearchResult[]> {
    const files = await this.collectFiles(rootPath, glob);
    const regex = new RegExp(pattern, "i");
    const results: SearchResult[] = [];

    for (const file of files) {
      const content = await fs.readFile(file, "utf-8").catch(() => "");
      if (!content) {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (regex.test(lines[index])) {
          results.push({
            file,
            line: index + 1,
            content: lines[index],
          });
        }
      }
    }

    return results;
  }

  private async toFileEntry(parentPath: string, entry: Dirent): Promise<FileEntry> {
    const fullPath = path.join(parentPath, entry.name);
    const stat = await fs.stat(fullPath);
    return {
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      size: stat.size,
    };
  }

  private async collectFiles(rootPath: string, glob?: string): Promise<string[]> {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.collectFiles(fullPath, glob));
        continue;
      }

      if (entry.isFile() && this.matchesGlob(entry.name, glob)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private matchesGlob(fileName: string, glob?: string): boolean {
    if (!glob?.trim()) {
      return true;
    }

    const pattern = glob
      .split("*")
      .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");

    return new RegExp(`^${pattern}$`, "i").test(fileName);
  }
}
