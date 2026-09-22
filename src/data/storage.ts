// ============================================================
// 数据层：localStorage 仓储
// 只负责存取与写入时的结构约束，不含任何风险/界面逻辑：
//   1. 唯一键 = 患者 + 日期 + 眼别，同日同眼只留一条
//   2. 修改不覆盖旧值，只追加带原因的新版本
// ============================================================

import type {
  ConflictInfo,
  Exam,
  ExamDraftInput,
  ExamValues,
  Patient,
  RevisionInput,
} from "../domain/types";
import { seedDb } from "./seed";

const STORAGE_KEY = "myopia-follow-up:v1";

export interface Database {
  patients: Patient[];
  exams: Exam[];
}

export function uniqueKey(patientId: string, date: string, eye: string): string {
  return `${patientId}|${date}|${eye}`;
}

export function examKey(e: Pick<Exam, "patientId" | "date" | "eye">): string {
  return uniqueKey(e.patientId, e.date, e.eye);
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadDb(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (Array.isArray(parsed.patients) && Array.isArray(parsed.exams)) {
        return parsed;
      }
    }
  } catch {
    // 存储损坏时回落到示例数据
  }
  const seeded = seedDb();
  persist(seeded);
  return seeded;
}

export function resetDb(): Database {
  const seeded = seedDb();
  persist(seeded);
  return seeded;
}

function persist(db: Database): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/**
 * 新增复查。
 * 同日同眼已存在时不写入，返回冲突信息（含患者、日期、眼别与原值）。
 */
export function addExam(db: Database, input: ExamDraftInput): { db: Database; conflict: ConflictInfo } | { db: Database; exam: Exam } {
  const conflict = db.exams.find(
    (e) => examKey(e) === uniqueKey(input.patientId, input.date, input.eye)
  );
  if (conflict) {
    const patient = db.patients.find((p) => p.id === input.patientId);
    return {
      db,
      conflict: {
        patientId: input.patientId,
        patientName: patient?.name ?? input.patientId,
        date: input.date,
        eye: input.eye,
        existing: conflict,
      },
    };
  }

  const now = new Date().toISOString();
  const values: ExamValues = {
    sphere: input.sphere,
    cylinder: input.cylinder,
    axialLength: input.axialLength,
  };
  const exam: Exam = {
    id: uid(),
    patientId: input.patientId,
    date: input.date,
    eye: input.eye,
    ...values,
    outdoorHours: input.outdoorHours,
    plan: input.plan?.trim() || undefined,
    versions: [
      {
        version: 1,
        reason: "初次录入",
        createdAt: now,
        ...values,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const next: Database = { ...db, exams: [...db.exams, exam] };
  persist(next);
  return { db: next, exam };
}

/**
 * 修订复查：当前值更新，旧值作为带原因的新版本追加保留。
 * 唯一键（患者/日期/眼别）不允许通过修订改变。
 */
export function reviseExam(db: Database, input: RevisionInput): { db: Database; exam: Exam } {
  const idx = db.exams.findIndex((e) => e.id === input.examId);
  if (idx < 0) throw new Error("待修订的复查记录不存在");

  const old = db.exams[idx];
  const now = new Date().toISOString();
  const merged: Exam = {
    ...old,
    ...input.values,
    outdoorHours: input.outdoorHours,
    plan: input.plan?.trim() || old.plan,
    updatedAt: now,
  };
  const nextVersion = {
    version: old.versions.length + 1,
    reason: input.reason.trim() || "未填写修订原因",
    createdAt: now,
    sphere: merged.sphere,
    cylinder: merged.cylinder,
    axialLength: merged.axialLength,
  };
  const exam: Exam = { ...merged, versions: [...old.versions, nextVersion] };

  const exams = db.exams.slice();
  exams[idx] = exam;
  const next = { ...db, exams };
  persist(next);
  return { db: next, exam };
}
