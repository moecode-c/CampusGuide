import type { GpaPlugin } from "@/lib/gpa/types";
import { midtermOnlyPlugin } from "@/lib/gpa/plugins/midtermOnly";
import { midterm40BestPlugin, midterm40WorstPlugin } from "@/lib/gpa/plugins/midterm40";

const plugins: Record<string, GpaPlugin> = {
  [midtermOnlyPlugin.id]: midtermOnlyPlugin,
  [midterm40BestPlugin.id]: midterm40BestPlugin,
  [midterm40WorstPlugin.id]: midterm40WorstPlugin,
};

export function getGpaPlugin(id: string): GpaPlugin {
  return plugins[id] ?? midtermOnlyPlugin;
}

export { midtermOnlyPlugin };
export { midterm40BestPlugin, midterm40WorstPlugin };
export type { MidtermInput, GradeResult, GpaSummary, GpaPlugin } from "@/lib/gpa/types";
