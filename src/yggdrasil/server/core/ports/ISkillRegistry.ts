import type { SkillDefinition, SkillMatch } from "../entities/Skill";

export interface ISkillRegistry {
  match(message: string): SkillMatch | null;
  execute(skill: string, args: string): Promise<string>;
  listSkills(): SkillDefinition[];
}
