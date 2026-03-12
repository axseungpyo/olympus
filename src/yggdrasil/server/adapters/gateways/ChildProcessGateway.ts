import { spawn } from "child_process";
import path from "path";
import type { IProcessGateway, SpawnResult } from "../../core/ports/IProcessGateway";

class ChildProcessSpawnResult implements SpawnResult {
  constructor(private readonly child: ReturnType<typeof spawn>) {}

  get pid(): number | null {
    return this.child.pid ?? null;
  }

  kill(signal?: string): boolean {
    return this.child.kill(signal as NodeJS.Signals | number | undefined);
  }

  onExit(listener: (code: number | null) => void): void {
    this.child.on("exit", listener);
  }

  onError(listener: (error: Error) => void): void {
    this.child.on("error", listener);
  }

  onStdout(listener: (data: string) => void): void {
    this.child.stdout?.on("data", (chunk: Buffer | string) => {
      listener(chunk.toString());
    });
  }

  unref(): void {
    this.child.unref();
  }
}

export class ChildProcessGateway implements IProcessGateway {
  constructor(private readonly asgardRoot: string) {}

  spawn(script: string, args: string[], env: Record<string, string>): SpawnResult {
    const child = spawn("bash", [path.join(this.asgardRoot, script), ...args], {
      cwd: this.asgardRoot,
      env: {
        ...process.env,
        ...env,
      },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    return new ChildProcessSpawnResult(child);
  }

  isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err: unknown) {
      return (err as NodeJS.ErrnoException).code === "EPERM";
    }
  }

  kill(pid: number, signal?: string): boolean {
    process.kill(pid, (signal ?? "SIGTERM") as NodeJS.Signals);
    return true;
  }
}
