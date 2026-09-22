// ============================================================
// 规则层：近视进展与随访等级规则（纯函数，可单测）
//
// 阈值（临床半年随访口径）：
//   - 半年眼轴增长 > 0.20 mm      → 重点随访
//   - 半年等效球镜下降 > 0.50 D    → 重点随访
// 不足半年的复查间隔按比例换算为半年当量后再判定。
// 触发重点随访时，户外时长与处置计划必须填写，否则该条记录为草稿。
// ============================================================

import type {
  Exam,
  ExamRisk,
  FollowUpStatus,
  ProgressionDelta,
} from "../domain/types";
import { round2, sphericalEquivalent } from "./optics";

export const AXIAL_THRESHOLD_MM = 0.2;
export const SE_THRESHOLD_D = 0.5;
export const HALF_YEAR_DAYS = 182.625;

const RISK_ORDER: Record<FollowUpStatus, number> = {
  normal: 0,
  draft: 1,
  focus: 2,
};

/** 取两个状态中风险更高者（草稿在看板上需要优先补全） */
export function higherStatus(a: FollowUpStatus, b: FollowUpStatus): FollowUpStatus {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / 86_400_000;
}

/** 计算某条复查相对上一条复查（同眼）的半年化进展；首条返回 null */
export function progressionOf(
  current: Exam,
  prev: Exam | undefined
): ProgressionDelta | null {
  if (!prev) return null;
  const days = daysBetween(prev.date, current.date);
  if (days <= 0) return null;

  const axialDelta = round2(current.axialLength - prev.axialLength);
  const seDelta = round2(
    sphericalEquivalent(current) - sphericalEquivalent(prev)
  );
  // 半年当量 = 实测增量 × (182.625 / 实际间隔天数)
  const factor = HALF_YEAR_DAYS / days;

  return {
    prevDate: prev.date,
    days: Math.round(days),
    axialDelta,
    axialPerHalfYear: round2(axialDelta * factor),
    seDelta,
    sePerHalfYear: round2(seDelta * factor),
  };
}

/** 越限判定：严格大于阈值才算进展过快 */
export function isFastProgression(delta: ProgressionDelta): {
  axial: boolean;
  se: boolean;
} {
  return {
    axial: delta.axialPerHalfYear > AXIAL_THRESHOLD_MM,
    // SE 半年化变化为负值表示近视加深，下降幅度 = -sePerHalfYear
    se: -delta.sePerHalfYear > SE_THRESHOLD_D,
  };
}

/** 触发重点随访后必须填全的处置资料 */
export function missingCareFields(exam: Pick<Exam, "outdoorHours" | "plan">): string[] {
  const missing: string[] = [];
  if (exam.outdoorHours === undefined || Number.isNaN(exam.outdoorHours)) {
    missing.push("户外时长");
  }
  if (!exam.plan || !exam.plan.trim()) {
    missing.push("处置计划");
  }
  return missing;
}

/**
 * 单条复查风险评估（不保存，时间线随时重算）。
 * @param current  当前复查
 * @param prev     同眼上一条复查（日期升序中的前一条）
 */
export function evaluateExam(current: Exam, prev: Exam | undefined): ExamRisk {
  const delta = progressionOf(current, prev);

  if (!delta) {
    return { status: "normal", reasons: ["首条基线复查，暂无进展可比对"], delta, missingFields: [] };
  }

  const hit = isFastProgression(delta);
  const reasons: string[] = [];
  if (hit.axial) {
    reasons.push(
      `眼轴半年增长 ${delta.axialPerHalfYear.toFixed(2)}mm（阈值 ${AXIAL_THRESHOLD_MM.toFixed(2)}mm）`
    );
  }
  if (hit.se) {
    reasons.push(
      `等效球镜半年下降 ${(-delta.sePerHalfYear).toFixed(2)}D（阈值 ${SE_THRESHOLD_D.toFixed(2)}D）`
    );
  }

  const fast = hit.axial || hit.se;
  if (!fast) {
    return {
      status: "normal",
      reasons: [
        `近 ${delta.days} 天眼轴 +${delta.axialDelta.toFixed(2)}mm、SE ${
          delta.seDelta > 0 ? "+" : ""
        }${delta.seDelta.toFixed(2)}D，半年当量未越限`,
      ],
      delta,
      missingFields: [],
    };
  }

  const missingFields = missingCareFields(current);
  return {
    status: missingFields.length > 0 ? "draft" : "focus",
    reasons,
    delta,
    missingFields,
  };
}

export const STATUS_LABEL: Record<FollowUpStatus, string> = {
  normal: "常规随访",
  focus: "重点随访",
  draft: "草稿待补全",
};
