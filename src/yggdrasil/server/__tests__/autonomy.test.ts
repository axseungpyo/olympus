import express from "express";
import { describe, expect, it } from "vitest";
import { SettingsController } from "../adapters/controllers/SettingsController";
import { InMemorySettingsRepository } from "../adapters/repositories/InMemorySettingsRepository";
import { createSettingsRouter } from "../routes/settings.routes";

interface DispatchResult {
  status: number;
  body: string;
}

async function dispatchRequest(
  app: express.Express,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {}
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
      body: init.body ? JSON.parse(init.body) : undefined,
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

describe("autonomy settings", () => {
  it("defaults to autonomy level 1", async () => {
    const repository = new InMemorySettingsRepository();

    expect(repository.getAutonomyLevel()).toBe(1);
  });

  it("stores and returns updated autonomy levels", async () => {
    const repository = new InMemorySettingsRepository();

    repository.setAutonomyLevel(3);

    expect(repository.getAutonomyLevel()).toBe(3);
  });

  it("rejects invalid autonomy levels", async () => {
    const repository = new InMemorySettingsRepository();
    const app = express();
    app.use(express.json());
    app.use(createSettingsRouter(new SettingsController(repository)));

    const response = await dispatchRequest(app, "/api/settings/autonomy", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level: 9 }),
    });

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "Invalid autonomy level. Must be one of: 1, 2, 3",
    });
  });

  it("serves current autonomy level through the settings route", async () => {
    const repository = new InMemorySettingsRepository();
    const app = express();
    app.use(express.json());
    app.use(createSettingsRouter(new SettingsController(repository)));

    const response = await dispatchRequest(app, "/api/settings/autonomy");

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      level: 1,
      description: expect.any(String),
    });
  });
});
