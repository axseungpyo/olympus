import { Router, type Request, type Response } from "express";
import { createLogger } from "../logger";
import {
  getMessages,
  processCommand,
  processApproval,
  saveHistory,
} from "../odin-channel";

export function createOdinRouter(asgardRoot: string): Router {
  const router = Router();
  const log = createLogger({ component: "OdinRoutes" });

  router.get("/api/odin/messages", (req: Request, res: Response) => {
    const limit = parseInt((req.query.limit as string) || "50", 10);
    res.json({ messages: getMessages(limit) });
  });

  router.post("/api/odin/command", async (req: Request, res: Response) => {
    const { content } = (req.body ?? {}) as { content?: string };
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Body must be { content: string }" });
      return;
    }

    try {
      log.info({ content }, "Odin command received");
      const result = await processCommand(content, asgardRoot);
      await saveHistory(asgardRoot);
      res.json(result);
    } catch (err: unknown) {
      log.error({ err }, "Odin command failed");
      res.status(500).json({ error: "Command processing failed" });
    }
  });

  router.post("/api/odin/approve", async (req: Request, res: Response) => {
    const { approvalId, approved } = (req.body ?? {}) as {
      approvalId?: string;
      approved?: boolean;
    };

    if (!approvalId || typeof approved !== "boolean") {
      res.status(400).json({ error: "Body must be { approvalId: string, approved: boolean }" });
      return;
    }

    try {
      log.info({ approvalId, approved }, "Odin approval response");
      const result = await processApproval(approvalId, approved, asgardRoot);
      await saveHistory(asgardRoot);
      res.json(result);
    } catch (err: unknown) {
      log.error({ err }, "Odin approval failed");
      res.status(500).json({ error: "Approval processing failed" });
    }
  });

  return router;
}
