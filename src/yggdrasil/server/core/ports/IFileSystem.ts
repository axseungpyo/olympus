export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export interface IFileSystem {
  readFile(absolutePath: string): Promise<string>;
  writeFile(absolutePath: string, content: string): Promise<void>;
  listDirectory(absolutePath: string): Promise<FileEntry[]>;
  exists(absolutePath: string): Promise<boolean>;
  searchContent(rootPath: string, pattern: string, glob?: string): Promise<SearchResult[]>;
}
