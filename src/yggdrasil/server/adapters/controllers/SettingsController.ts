import type { Request, Response } from "express";
import { AUTONOMY_DESCRIPTIONS, type AutonomyLevel } from "../../core/entities/AutonomyLevel";
import type { ISettingsRepository } from "../../core/ports/ISettingsRepository";
import { createLogger } from "../../infra/logger";
import { sendBadRequest, sendServerError } from "./controller-utils";

const VALID_LEVELS = new Set<AutonomyLevel>([1, 2, 3]);

export class SettingsController {
  private readonly log = createLogger({ component: "SettingsController" });

  constructor(private readonly settingsRepository: ISettingsRepository) {}

  getAutonomy(_req: Request, res: Response): void {
    const level = this.settingsRepository.getAutonomyLevel();
    res.json({ level, description: AUTONOMY_DESCRIPTIONS[level] });
  }

  setAutonomy(req: Request, res: Response): void {
    const level = this.parseLevel(req.body?.level);
    if (!level) {
      sendBadRequest(res, "Invalid autonomy level. Must be one of: 1, 2, 3");
      return;
    }

    try {
      const config = this.settingsRepository.setAutonomyLevel(level);
      res.json({
        level: config.level,
        description: AUTONOMY_DESCRIPTIONS[config.level],
        updatedAt: config.updatedAt,
      });
    } catch (err) {
      this.log.error({ err }, "Failed to update autonomy level");
      sendServerError(res, "Failed to update autonomy level");
    }
  }

  private parseLevel(value: unknown): AutonomyLevel | null {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return null;
    }

    return VALID_LEVELS.has(value as AutonomyLevel) ? (value as AutonomyLevel) : null;
  }
}
