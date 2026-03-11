import type { Response } from "express";

export function sendServerError(res: Response, error: string): void {
  res.status(500).json({ error });
}

export function sendBadRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}
