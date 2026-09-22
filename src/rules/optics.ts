// ============================================================
// 规则层：眼视光计算（纯函数）
// ============================================================

import type { ExamValues } from "../domain/types";

/**
 * 等效球镜 SE = 球镜 + 1/2 柱镜（单位 D）。
 * 保留两位小数，规避浮点误差。
 */
export function sphericalEquivalent(v: Pick<ExamValues, "sphere" | "cylinder">): number {
  return round2(v.sphere + v.cylinder / 2);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 球镜格式化，如 -2.75D / +0.50D */
export function formatDiopter(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${round2(n).toFixed(2)}D`;
}

/** 眼轴格式化，如 23.45mm */
export function formatMm(n: number): string {
  return `${round2(n).toFixed(2)}mm`;
}
