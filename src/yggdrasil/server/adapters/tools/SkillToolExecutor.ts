import type { ISkillRegistry } from "../../core/ports/ISkillRegistry";
import type { IToolExecutor, ToolResult } from "../../core/ports/IToolExecutor";
import type { LLMToolCall } from "../../core/ports/ILLMGateway";

const TOOL_TO_SKILL: Record<string, { skill: string; argKeys?: string[] }> = {
  get_status: { skill: "status" },
  create_task: { skill: "plan", argKeys: ["title", "objective", "agent"] },
  validate_task: { skill: "validate", argKeys: ["tp_id", "tpId"] },
};

export class SkillToolExecutor implements IToolExecutor {
  constructor(private readonly skillRegistry: ISkillRegistry) {}

  canHandle(toolName: string): boolean {
    return toolName in TOOL_TO_SKILL;
  }

  async execute(toolCall: LLMToolCall, _projectRoot: string): Promise<ToolResult> {
    const target = TOOL_TO_SKILL[toolCall.name];
    if (!target) {
      return { success: false, output: "", error: `지원하지 않는 도구: ${toolCall.name}` };
    }

    try {
      const args = (target.argKeys ?? [])
        .map((key) => this.readString(toolCall.input, key))
        .filter(Boolean)
        .join(" | ");
      const output = await this.skillRegistry.execute(target.skill, args);
      return {
        success: true,
        output,
        metadata: { skill: target.skill },
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: { skill: target.skill },
      };
    }
  }

  private readString(input: Record<string, unknown>, key: string): string {
    const value = input[key];
    return typeof value === "string" ? value.trim() : "";
  }
}
