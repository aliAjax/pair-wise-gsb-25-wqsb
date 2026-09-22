// 规则层：风险等级与随访状态判定（纯函数）
import type { ExamStatus, RiskLevel } from "../data/types";
import {
  ProgressionResult,
  WATCH_AXIAL_6M,
  WATCH_SE_DROP_6M,
} from "./progression";

/**
 * 风险等级（仅描述进展快慢）：
 * - high：半年眼轴 >0.20mm 或等效球镜下降 >0.50D
 * - watch：到达观察带但未越线
 * - normal：平稳或尚无基线
 */
export function resolveRisk(progression: ProgressionResult): RiskLevel {
  if (!progression.evaluable) return "normal";
  if (progression.hit) return "high";
  const inWatchBand =
    (progression.axialRate6m ?? 0) > WATCH_AXIAL_6M ||
    (progression.seRate6m ?? 0) < -WATCH_SE_DROP_6M;
  return inWatchBand ? "watch" : "normal";
}

/** 重点随访必须补齐的随访字段 */
export function missingFocusFields(ver: {
  outdoorHours: number | null;
  plan: string;
}): ("outdoorHours" | "plan")[] {
  const missing: ("outdoorHours" | "plan")[] = [];
  if (ver.outdoorHours === null) missing.push("outdoorHours");
  if (!ver.plan.trim()) missing.push("plan");
  return missing;
}

/**
 * 随访状态（描述记录工作流）：
 * - 越线且户外时长+处置计划齐全 → focus 重点随访
 * - 越线但必填缺失，或操作者显式存草稿 → draft 草稿
 * - 未越线 → routine 常规随访
 */
export function resolveStatus(
  progression: ProgressionResult,
  ver: { outdoorHours: number | null; plan: string; keepDraft: boolean }
): ExamStatus {
  if (ver.keepDraft) return "draft";
  if (!progression.hit) return "routine";
  return missingFocusFields(ver).length === 0 ? "focus" : "draft";
}

/** 越线原因说明，供页面与重点随访提示复用 */
export function hitReasons(progression: ProgressionResult): string[] {
  const reasons: string[] = [];
  if (progression.axialHit)
    reasons.push(
      `半年眼轴增长 ${(progression.axialRate6m ?? 0).toFixed(2)}mm（>0.20mm）`
    );
  if (progression.seHit)
    reasons.push(
      `半年等效球镜下降 ${Math.abs(progression.seRate6m ?? 0).toFixed(2)}D（>0.50D）`
    );
  return reasons;
}
