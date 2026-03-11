import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { NextFunction, Request, Response } from "express";
import { createLogger } from "./logger";

const ASGARD_ROOT = path.resolve(process.cwd(), "../..");
const TOKEN_FILE = path.join(ASGARD_ROOT, "artifacts", ".yggdrasil-token");

const log = createLogger({ component: "Auth" });

let cachedToken: string | null = null;

function isAuthDisabled(): boolean {
  return process.env.YGGDRASIL_AUTH === "false";
}

function loadOrCreateToken(): string {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const existing = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
    if (existing) {
      cachedToken = existing;
      return cachedToken;
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.error({ err, tokenFile: TOKEN_FILE }, "Failed to read auth token file");
      throw err;
    }
  }

  cachedToken = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, `${cachedToken}\n`, "utf-8");
  log.info({ tokenFile: TOKEN_FILE }, "Created auth token file");
  return cachedToken;
}

export function getToken(): string {
  return loadOrCreateToken();
}

export function validateToken(token: string): boolean {
  if (isAuthDisabled()) {
    return true;
  }

  if (!token) {
    return false;
  }

  return token.trim() === getToken();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isAuthDisabled()) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    log.warn({ path: req.path }, "Missing bearer token");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!validateToken(token)) {
    log.warn({ path: req.path }, "Invalid bearer token");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
