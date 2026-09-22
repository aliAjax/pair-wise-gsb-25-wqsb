// ============================================================
// 数据层：示例数据（3+1 名儿童，覆盖重点 / 草稿 / 常规 / 基线 / 版本链）
// ============================================================

import type { Exam, ExamValues, Eye, Patient } from "../domain/types";
import type { Database } from "./storage";

const patients: Patient[] = [
  { id: "P01", name: "李小宇", gender: "男", age: 9 },
  { id: "P02", name: "王芷晴", gender: "女", age: 11 },
  { id: "P03", name: "张乐乐", gender: "男", age: 7 },
  { id: "P04", name: "陈一一", gender: "女", age: 6 },
];

interface SeedExam {
  patientId: string;
  date: string;
  eye: Eye;
  values: ExamValues;
  outdoorHours?: number;
  plan?: string;
  /** 旧版本（修订原因 + 旧值），按时间顺序追加 */
  history?: { reason: string; values: ExamValues }[];
}

const seedExams: SeedExam[] = [
  // ---- P01 李小宇：半年内眼轴与 SE 双双越限，已填处置 → 重点随访 ----
  {
    patientId: "P01",
    date: "2026-03-18",
    eye: "OD",
    values: { sphere: -1.25, cylinder: -0.5, axialLength: 23.65 },
  },
  {
    patientId: "P01",
    date: "2026-03-18",
    eye: "OS",
    values: { sphere: -1.0, cylinder: -0.5, axialLength: 23.52 },
  },
  {
    patientId: "P01",
    date: "2026-09-15",
    eye: "OD",
    values: { sphere: -2.0, cylinder: -0.5, axialLength: 23.95 },
    outdoorHours: 1.5,
    plan: "低浓度阿托品 0.01% 每晚一次 + 多点离焦眼镜，3 个月后复查眼轴",
  },
  {
    patientId: "P01",
    date: "2026-09-15",
    eye: "OS",
    values: { sphere: -1.75, cylinder: -0.5, axialLength: 23.82 },
    outdoorHours: 1.5,
    plan: "低浓度阿托品 0.01% 每晚一次 + 多点离焦眼镜，3 个月后复查眼轴",
  },

  // ---- P02 王芷晴：进展平稳 → 常规随访；最近一条有一次勘误修订 ----
  {
    patientId: "P02",
    date: "2025-09-20",
    eye: "OD",
    values: { sphere: -0.75, cylinder: -0.25, axialLength: 24.1 },
  },
  {
    patientId: "P02",
    date: "2026-03-22",
    eye: "OD",
    values: { sphere: -1.0, cylinder: -0.25, axialLength: 24.2 },
  },
  {
    patientId: "P02",
    // 当前值为 -1.00；首版误录 -1.25，已带原因修订并保留旧值
    date: "2026-09-16",
    eye: "OD",
    values: { sphere: -1.0, cylinder: -0.25, axialLength: 24.26 },
    history: [
      { reason: "复查单誊录错误，按原始验光单核回球镜", values: { sphere: -1.25, cylinder: -0.25, axialLength: 24.26 } },
    ],
  },
  {
    patientId: "P02",
    date: "2025-09-20",
    eye: "OS",
    values: { sphere: -0.5, cylinder: -0.25, axialLength: 23.98 },
  },
  {
    patientId: "P02",
    date: "2026-03-22",
    eye: "OS",
    values: { sphere: -0.75, cylinder: -0.25, axialLength: 24.06 },
  },
  {
    patientId: "P02",
    date: "2026-09-16",
    eye: "OS",
    values: { sphere: -0.75, cylinder: -0.25, axialLength: 24.11 },
  },

  // ---- P03 张乐乐：3 个月眼轴猛涨，未填户外与处置 → 草稿待补全 ----
  {
    patientId: "P03",
    date: "2026-06-20",
    eye: "OD",
    values: { sphere: 0.5, cylinder: 0, axialLength: 22.4 },
  },
  {
    patientId: "P03",
    date: "2026-09-18",
    eye: "OD",
    values: { sphere: 0.25, cylinder: 0, axialLength: 22.7 },
  },
  {
    patientId: "P03",
    date: "2026-06-20",
    eye: "OS",
    values: { sphere: 0.5, cylinder: 0, axialLength: 22.36 },
  },
  {
    patientId: "P03",
    date: "2026-09-18",
    eye: "OS",
    values: { sphere: 0.25, cylinder: 0, axialLength: 22.62 },
  },

  // ---- P04 陈一一：首条基线复查 ----
  {
    patientId: "P04",
    date: "2026-09-10",
    eye: "OD",
    values: { sphere: 0.75, cylinder: -0.25, axialLength: 22.18 },
  },
  {
    patientId: "P04",
    date: "2026-09-10",
    eye: "OS",
    values: { sphere: 0.75, cylinder: 0, axialLength: 22.12 },
  },
];

function buildExam(s: SeedExam, index: number): Exam {
  const base = `2026-01-01T0${(index % 9) + 1}:00:00.000Z`;
  const first = {
    version: 1,
    reason: "初次录入",
    createdAt: base,
    ...(s.history?.[0]?.values ?? s.values),
  };
  const extra = (s.history ?? []).map((h, i) => ({
    version: i + 2,
    reason: h.reason,
    createdAt: new Date(new Date(base).getTime() + (i + 1) * 60_000).toISOString(),
    ...s.values,
  }));
  // 当存在 history 时，first 取旧值、末版取当前值
  const versions = s.history ? [first, ...extra] : [first];
  return {
    id: `seed-${index + 1}`,
    patientId: s.patientId,
    date: s.date,
    eye: s.eye,
    ...s.values,
    outdoorHours: s.outdoorHours,
    plan: s.plan,
    versions,
    createdAt: base,
    updatedAt: versions[versions.length - 1].createdAt,
  };
}

export function seedDb(): Database {
  return { patients, exams: seedExams.map(buildExam) };
}
