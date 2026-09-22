// 页面层：展示标签与格式化（不含业务规则，只负责把规则层结果转成中文文案）
import type { Eye, ExamStatus, RiskLevel } from "../data/types";

export const EYE_LABEL: Record<Eye, string> = { OD: "右眼", OS: "左眼" };

export const RISK_LABEL: Record<RiskLevel, string> = {
  normal: "平稳",
  watch: "观察",
  high: "高风险",
};

export const STATUS_LABEL: Record<ExamStatus, string> = {
  draft: "草稿",
  routine: "常规随访",
  focus: "重点随访",
};

export function fmtSigned(value: number | null, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

export function fmtMm(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)} mm`;
}

export function fmtAge(birthDate: string, refDate: string): string {
  if (!birthDate) return "—";
  const birth = Date.parse(`${birthDate}T00:00:00Z`);
  const ref = Date.parse(`${refDate}T00:00:00Z`);
  if (Number.isNaN(birth) || Number.isNaN(ref)) return "—";
  const years = (ref - birth) / (365.25 * 86_400_000);
  if (years < 1) return `${Math.max(0, Math.round(years * 12))} 月龄`;
  return `${years.toFixed(1)} 岁`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
