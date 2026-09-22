// 规则层：近视进展阈值与速率计算（纯函数，所有阈值集中于此）
import type { ExamMetrics } from "../data/types";

export const DAYS_HALF_YEAR = 182.625;
/** 距上次复查不足 30 天时不做进展评价，避免短期波动放大为半年速率 */
export const MIN_REFERENCE_DAYS = 30;

/** 半年眼轴增长 > 0.20mm 触发重点随访 */
export const AXIAL_LIMIT_6M = 0.2;
/** 半年等效球镜下降 > 0.50D（即变化量 < -0.50D）触发重点随访 */
export const SE_DROP_LIMIT_6M = 0.5;

/** 观察带阈值（未越线但需关注） */
export const WATCH_AXIAL_6M = 0.1;
export const WATCH_SE_DROP_6M = 0.25;

export function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/** 把任意间隔内的变化量折算为半年（182.625 天）等效变化量 */
export function ratePerHalfYear(delta: number, days: number): number {
  if (days <= 0) return 0;
  return (delta * DAYS_HALF_YEAR) / days;
}

export interface ProgressionResult {
  evaluable: boolean;
  baselineDate: string | null;
  days: number | null;
  rawAxialDelta: number | null; // 原始眼轴变化 mm
  rawSeDelta: number | null; // 原始等效球镜变化 D
  axialRate6m: number | null; // 半年等效眼轴增长
  seRate6m: number | null; // 半年等效等效球镜变化
  axialHit: boolean; // 眼轴越线
  seHit: boolean; // 等效球镜越线
  hit: boolean; // 任一越线 → 转重点随访
}

const NOT_EVALUABLE: ProgressionResult = {
  evaluable: false,
  baselineDate: null,
  days: null,
  rawAxialDelta: null,
  rawSeDelta: null,
  axialRate6m: null,
  seRate6m: null,
  axialHit: false,
  seHit: false,
  hit: false,
};

export function evaluateProgression(
  currentDate: string,
  current: ExamMetrics,
  baseline: { date: string; metrics: ExamMetrics } | null
): ProgressionResult {
  if (!baseline) return NOT_EVALUABLE;
  const days = daysBetween(baseline.date, currentDate);
  if (!Number.isFinite(days) || days < MIN_REFERENCE_DAYS) return NOT_EVALUABLE;

  const rawAxialDelta = round(current.axialLength - baseline.metrics.axialLength, 3);
  const rawSeDelta = round(current.se - baseline.metrics.se, 3);
  const axialRate6m = round(ratePerHalfYear(rawAxialDelta, days), 2);
  const seRate6m = round(ratePerHalfYear(rawSeDelta, days), 2);

  const axialHit = axialRate6m > AXIAL_LIMIT_6M;
  const seHit = seRate6m < -SE_DROP_LIMIT_6M;

  return {
    evaluable: true,
    baselineDate: baseline.date,
    days,
    rawAxialDelta,
    rawSeDelta,
    axialRate6m,
    seRate6m,
    axialHit,
    seHit,
    hit: axialHit || seHit,
  };
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
