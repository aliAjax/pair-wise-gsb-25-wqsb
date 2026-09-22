// 数据层：演示种子数据。时间戳固定，保证首次加载与重置结果可复现。
import type { ClinicData, ExamDoc, ExamMetrics, ExamVersion, Patient } from "./types";

interface SeedVersion {
  createdAt: string;
  reason?: string;
  author: string;
  m: ExamMetrics;
  outdoorHours?: number | null;
  plan?: string;
  note?: string;
  keepDraft?: boolean;
}

let seedSeq = 0;

function v(seed: SeedVersion): ExamVersion {
  seedSeq += 1;
  return {
    versionId: `seed-v-${String(seedSeq).padStart(3, "0")}`,
    createdAt: seed.createdAt,
    reason: seed.reason ?? "",
    author: seed.author,
    metrics: seed.m,
    outdoorHours: seed.outdoorHours ?? null,
    plan: seed.plan ?? "",
    note: seed.note ?? "",
    keepDraft: seed.keepDraft ?? false,
  };
}

function exam(
  id: string,
  patientId: string,
  date: string,
  eye: "OD" | "OS",
  versions: SeedVersion[]
): ExamDoc {
  return { id, patientId, date, eye, versions: versions.map(v) };
}

export function makeSeed(): ClinicData {
  seedSeq = 0;
  const patients: Patient[] = [
    { id: "P-032", name: "李晓宝", gender: "男", birthDate: "2016-05-12" },
    { id: "P-081", name: "王小明", gender: "女", birthDate: "2018-09-03" },
    { id: "P-144", name: "赵朵朵", gender: "女", birthDate: "2015-01-20" },
    { id: "P-210", name: "陈乐乐", gender: "男", birthDate: "2019-11-08" },
  ];

  const doctor = "复查医生 周岚";
  const optometrist = "验光师 高宁";

  const exams: ExamDoc[] = [
    // —— 李晓宝：半年复查，眼轴增长超阈值，重点随访；左眼含一次订正版本 ——
    exam("seed-032-od-1", "P-032", "2025-12-20", "OD", [
      {
        createdAt: "2025-12-20T02:10:00.000Z",
        author: optometrist,
        m: { sphere: -1.5, cylinder: -0.5, axis: 175, se: -1.75, axialLength: 23.6 },
        note: "初次建档，足矫",
      },
    ]),
    exam("seed-032-od-2", "P-032", "2026-06-22", "OD", [
      {
        createdAt: "2026-06-22T02:15:00.000Z",
        author: doctor,
        m: { sphere: -2.0, cylinder: -0.5, axis: 175, se: -2.25, axialLength: 23.95 },
        outdoorHours: 0.5,
        plan: "改用多点离焦镜片；每日户外不少于2小时；3个月后复查眼轴",
        note: "眼轴半年+0.35mm，转重点随访",
      },
    ]),
    exam("seed-032-os-1", "P-032", "2025-12-20", "OS", [
      {
        createdAt: "2025-12-20T02:12:00.000Z",
        author: optometrist,
        m: { sphere: -1.0, cylinder: -0.5, axis: 10, se: -1.25, axialLength: 23.4 },
        note: "原始单据球镜誊写错误",
      },
      {
        createdAt: "2025-12-21T01:30:00.000Z",
        reason: "按验光单原件订正：球镜 -1.00DS → -1.25DS",
        author: doctor,
        m: { sphere: -1.25, cylinder: -0.5, axis: 10, se: -1.5, axialLength: 23.4 },
        note: "原始单据球镜誊写错误",
      },
    ]),
    exam("seed-032-os-2", "P-032", "2026-06-22", "OS", [
      {
        createdAt: "2026-06-22T02:18:00.000Z",
        author: doctor,
        m: { sphere: -1.75, cylinder: -0.5, axis: 10, se: -2.0, axialLength: 23.66 },
        outdoorHours: 1,
        plan: "与右眼同方案：多点离焦镜片+户外2小时/日，3个月复查",
      },
    ]),

    // —— 王小明：右眼观察带；左眼等效球镜下降超阈值但资料未补齐 → 草稿 ——
    exam("seed-081-od-1", "P-081", "2025-11-10", "OD", [
      {
        createdAt: "2025-11-10T06:40:00.000Z",
        author: optometrist,
        m: { sphere: -0.75, cylinder: -0.25, axis: 160, se: -0.875, axialLength: 22.8 },
      },
    ]),
    exam("seed-081-od-2", "P-081", "2026-05-15", "OD", [
      {
        createdAt: "2026-05-15T06:45:00.000Z",
        author: doctor,
        m: { sphere: -1.0, cylinder: -0.25, axis: 160, se: -1.125, axialLength: 23.0 },
        outdoorHours: 1.5,
        plan: "单光镜片足矫，寒暑假复测",
      },
    ]),
    exam("seed-081-os-1", "P-081", "2025-11-10", "OS", [
      {
        createdAt: "2025-11-10T06:42:00.000Z",
        author: optometrist,
        m: { sphere: -0.5, cylinder: -0.5, axis: 20, se: -0.75, axialLength: 22.7 },
      },
    ]),
    exam("seed-081-os-2", "P-081", "2026-05-15", "OS", [
      {
        createdAt: "2026-05-15T06:48:00.000Z",
        author: doctor,
        m: { sphere: -1.25, cylinder: -0.5, axis: 20, se: -1.5, axialLength: 22.95 },
        note: "等效球镜半年-0.75D，已约家长补问户外时长并定处置计划",
      },
    ]),

    // —— 赵朵朵：外院转来，仅有单次基线 ——
    exam("seed-144-od-1", "P-144", "2026-03-08", "OD", [
      {
        createdAt: "2026-03-08T03:05:00.000Z",
        author: optometrist,
        m: { sphere: -2.5, cylinder: -0.75, axis: 5, se: -2.875, axialLength: 24.2 },
        outdoorHours: 1,
        plan: "角膜塑形镜验配评估中",
      },
    ]),
    exam("seed-144-os-1", "P-144", "2026-03-08", "OS", [
      {
        createdAt: "2026-03-08T03:08:00.000Z",
        author: optometrist,
        m: { sphere: -2.25, cylinder: -0.75, axis: 175, se: -2.625, axialLength: 24.05 },
        outdoorHours: 1,
        plan: "角膜塑形镜验配评估中",
      },
    ]),

    // —— 陈乐乐：首诊建档，尚无基线可比 ——
    exam("seed-210-od-1", "P-210", "2026-09-10", "OD", [
      {
        createdAt: "2026-09-10T08:00:00.000Z",
        author: optometrist,
        m: { sphere: 0, cylinder: 0, axis: null, se: 0, axialLength: 22.1 },
        outdoorHours: 2,
        plan: "建立屈光发育档案，半年后复查",
      },
    ]),
    exam("seed-210-os-1", "P-210", "2026-09-10", "OS", [
      {
        createdAt: "2026-09-10T08:03:00.000Z",
        author: optometrist,
        m: { sphere: 0, cylinder: 0, axis: null, se: 0, axialLength: 22.05 },
        outdoorHours: 2,
        plan: "建立屈光发育档案，半年后复查",
      },
    ]),
  ];

  return { patients, exams };
}
