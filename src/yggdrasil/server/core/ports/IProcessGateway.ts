export interface SpawnResult {
  pid: number | null;
  kill(signal?: string): boolean;
  onExit(listener: (code: number | null) => void): void;
  onError(listener: (error: Error) => void): void;
  unref(): void;
}

export interface IProcessGateway {
  spawn(script: string, args: string[], env: Record<string, string>): SpawnResult;
  isAlive(pid: number): boolean;
  kill(pid: number, signal?: string): boolean;
}
