import type { AutonomyConfig, AutonomyLevel } from "../entities/AutonomyLevel";

export interface ISettingsRepository {
  getAutonomyLevel(): AutonomyLevel;
  setAutonomyLevel(level: AutonomyLevel): AutonomyConfig;
}
