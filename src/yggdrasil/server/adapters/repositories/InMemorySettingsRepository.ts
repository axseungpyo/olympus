import type { AutonomyConfig, AutonomyLevel } from "../../core/entities/AutonomyLevel";
import type { ISettingsRepository } from "../../core/ports/ISettingsRepository";

export class InMemorySettingsRepository implements ISettingsRepository {
  private autonomy: AutonomyConfig = {
    level: 1,
    updatedAt: Date.now(),
  };

  getAutonomyLevel(): AutonomyLevel {
    return this.autonomy.level;
  }

  setAutonomyLevel(level: AutonomyLevel): AutonomyConfig {
    this.autonomy = {
      level,
      updatedAt: Date.now(),
    };

    return this.autonomy;
  }
}
