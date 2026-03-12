export type AutonomyLevel = 1 | 2 | 3;

export interface AutonomyConfig {
  level: AutonomyLevel;
  updatedAt: number;
}

export const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  1: "Manual — 매 단계마다 사용자 승인",
  2: "Semi-Auto — 계획 승인 후 실행 자동, 에러 시 중단",
  3: "Full-Auto — 자율 실행, 위험 작업만 승인",
};
