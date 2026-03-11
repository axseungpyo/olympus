import type { Request, Response } from "express";
import type { IMessageRepository } from "../../core/ports/IMessageRepository";
import { ProcessApprovalUseCase } from "../../core/use-cases/odin/ProcessApprovalUseCase";
import { ProcessCommandUseCase } from "../../core/use-cases/odin/ProcessCommandUseCase";
import { createLogger } from "../../infra/logger";
import { sendBadRequest, sendServerError } from "./controller-utils";

export class OdinController {
  private readonly log = createLogger({ component: "OdinController" });

  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly processCommandUseCase: ProcessCommandUseCase,
    private readonly processApprovalUseCase: ProcessApprovalUseCase,
  ) {}

  getMessages(req: Request, res: Response): void {
    const limit = parseInt((req.query.limit as string) || "50", 10);
    res.json({ messages: this.messageRepository.getMessages(limit) });
  }

  async command(req: Request, res: Response): Promise<void> {
    const content = typeof req.body?.content === "string" ? req.body.content : null;
    if (!content) return sendBadRequest(res, "Body must be { content: string }");
    try { const result = await this.processCommandUseCase.execute(content); await this.messageRepository.saveHistory(); res.json(result); } catch (err) { this.fail(res, err, "Command processing failed"); }
  }

  async approve(req: Request, res: Response): Promise<void> {
    const approvalId = typeof req.body?.approvalId === "string" ? req.body.approvalId : null;
    const approved = typeof req.body?.approved === "boolean" ? req.body.approved : null;
    if (!approvalId || approved === null) return sendBadRequest(res, "Body must be { approvalId: string, approved: boolean }");
    try { const result = await this.processApprovalUseCase.execute({ approvalId, approved }); await this.messageRepository.saveHistory(); res.json(result); } catch (err) { this.fail(res, err, "Approval processing failed"); }
  }

  private fail(res: Response, err: unknown, message: string): void {
    this.log.error({ err }, message);
    sendServerError(res, message);
  }
}
