import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authMiddleware, getToken, validateToken } from "../infra/auth";
import { createRouter } from "../routes";

interface DispatchResult {
  status: number;
  body: string;
}

async function dispatchRequest(
  app: express.Express,
  url: string,
  init: { method?: string; headers?: Record<string, string> } = {}
): Promise<DispatchResult> {
  const headers = Object.fromEntries(
    Object.entries(init.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );

  return await new Promise((resolve, reject) => {
    const req = Object.assign(Object.create(app.request), {
      app,
      method: init.method ?? "GET",
      url,
      originalUrl: url,
      headers,
      socket: {},
      connection: {},
      get(name: string) {
        return headers[name.toLowerCase()];
      },
    });

    const responseHeaders = new Map<string, unknown>();
    const chunks: string[] = [];

    const res = Object.assign(Object.create(app.response), {
      app,
      req,
      locals: {},
      statusCode: 200,
      setHeader(name: string, value: unknown) {
        responseHeaders.set(name.toLowerCase(), value);
      },
      getHeader(name: string) {
        return responseHeaders.get(name.toLowerCase());
      },
      getHeaderNames() {
        return [...responseHeaders.keys()];
      },
      removeHeader(name: string) {
        responseHeaders.delete(name.toLowerCase());
      },
      write(chunk: unknown) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : String(chunk));
        }
        return true;
      },
      end(chunk?: unknown) {
        if (chunk) {
          this.write(chunk);
        }
        resolve({ status: this.statusCode, body: chunks.join("") });
        return this;
      },
    });

    req.res = res;
    res.req = req;

    (app as express.Express & {
      handle: (req: unknown, res: unknown, done: (err?: unknown) => void) => void;
    }).handle(req, res, (err: unknown) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({ status: res.statusCode, body: chunks.join("") });
    });
  });
}

describe("auth", () => {
  let rootDir: string;

  beforeEach(async () => {
    process.env.YGGDRASIL_AUTH = "true";

    rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "yggdrasil-auth-"));
    await fs.promises.mkdir(path.join(rootDir, "artifacts", "handoff"), { recursive: true });
    await fs.promises.writeFile(path.join(rootDir, "artifacts", "INDEX.md"), "", "utf-8");
  });

  afterEach(async () => {
    delete process.env.YGGDRASIL_AUTH;
    await fs.promises.rm(rootDir, { recursive: true, force: true });
  });

  it("authenticates requests with the correct bearer token", async () => {
    const app = express();
    app.get("/protected", authMiddleware, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const token = getToken();
    const response = await dispatchRequest(app, "/protected", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(validateToken(token)).toBe(true);
  });

  it("rejects requests with the wrong bearer token", async () => {
    const app = express();
    app.get("/protected", authMiddleware, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await dispatchRequest(app, "/protected", {
      headers: { authorization: "Bearer wrong-token" },
    });

    expect(response.status).toBe(401);
    expect(validateToken("wrong-token")).toBe(false);
  });

  it("rejects requests without a bearer token and keeps /api/health public", async () => {
    const app = express();
    app.use(createRouter(rootDir));

    const statusResponse = await dispatchRequest(app, "/api/status");
    const healthResponse = await dispatchRequest(app, "/api/health");

    expect(statusResponse.status).toBe(401);
    expect(healthResponse.status).toBe(200);
  });

  it("bypasses authentication when YGGDRASIL_AUTH=false", async () => {
    process.env.YGGDRASIL_AUTH = "false";

    const app = express();
    app.get("/protected", authMiddleware, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await dispatchRequest(app, "/protected");

    expect(response.status).toBe(200);
    expect(validateToken("")).toBe(true);
  });
});
