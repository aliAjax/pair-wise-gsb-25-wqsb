// 数据层：纯仓储。只负责唯一键约束、版本追加与持久化，不做任何医学规则判断。
import type {
  ClinicData,
  ExamDoc,
  ExamInput,
  ExamVersion,
  Patient,
} from "./types";

const STORAGE_KEY = "myopia-followup:v1";

export function uid(prefix = "r"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

/** 业务唯一键：患者 + 日期 + 眼别 */
export function businessKey(
  patientId: string,
  date: string,
  eye: string
): string {
  return `${patientId}|${date}|${eye}`;
}

export function docKey(doc: Pick<ExamDoc, "patientId" | "date" | "eye">): string {
  return businessKey(doc.patientId, doc.date, doc.eye);
}

export function findDoc(
  data: ClinicData,
  patientId: string,
  date: string,
  eye: string
): ExamDoc | undefined {
  const key = businessKey(patientId, date, eye);
  return data.exams.find(
    (doc) => docKey(doc) === key
  );
}

export function latestVersion(doc: ExamDoc): ExamVersion {
  return doc.versions[doc.versions.length - 1];
}

export function cloneData(data: ClinicData): ClinicData {
  return JSON.parse(JSON.stringify(data)) as ClinicData;
}

/**
 * 新增复查。若同患者+同日期+同眼别已存在，返回冲突信息（带原值），
 * 不写入任何数据 —— 冲突由页面层提示后引导用户走"修订"流程。
 */
export function addExam(
  data: ClinicData,
  input: ExamInput
): { data: ClinicData; conflict: ExamDoc | null } {
  const existing = findDoc(data, input.patientId, input.date, input.eye);
  if (existing) {
    return { data, conflict: existing };
  }
  const version: ExamVersion = {
    versionId: uid("v"),
    createdAt: new Date().toISOString(),
    reason: input.reason?.trim() ?? "",
    author: input.author?.trim() || "随访台",
    metrics: input.metrics,
    outdoorHours: input.outdoorHours,
    plan: input.plan.trim(),
    note: input.note.trim(),
    keepDraft: input.keepDraft,
  };
  const doc: ExamDoc = {
    id: uid("exam"),
    patientId: input.patientId,
    date: input.date,
    eye: input.eye,
    versions: [version],
  };
  return {
    data: { ...data, exams: [...data.exams, doc] },
    conflict: null,
  };
}

/**
 * 修订已有记录：只能新建一个带原因的版本，旧值在版本链中原样保留。
 * 若未填原因，仓储拒绝修订（null）。
 */
export function reviseExam(
  data: ClinicData,
  docId: string,
  input: ExamInput
): ClinicData | null {
  if (!input.reason || !input.reason.trim()) return null;
  const reason = input.reason.trim();
  let changed = false;
  const exams = data.exams.map((doc) => {
    if (doc.id !== docId) return doc;
    changed = true;
    const version: ExamVersion = {
      versionId: uid("v"),
      createdAt: new Date().toISOString(),
      reason,
      author: input.author?.trim() || "随访台",
      metrics: input.metrics,
      outdoorHours: input.outdoorHours,
      plan: input.plan.trim(),
      note: input.note.trim(),
      keepDraft: input.keepDraft,
    };
    return { ...doc, versions: [...doc.versions, version] };
  });
  return changed ? { ...data, exams } : null;
}

export function addPatient(
  data: ClinicData,
  fields: { name: string; gender?: Patient["gender"]; birthDate?: string }
): { data: ClinicData; patient: Patient } {
  const patient: Patient = {
    id: uid("P"),
    name: fields.name.trim(),
    gender: fields.gender ?? "",
    birthDate: fields.birthDate ?? "",
  };
  return { data: { ...data, patients: [...data.patients, patient] }, patient };
}

export function loadData(fallback: ClinicData): ClinicData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneData(fallback);
    const parsed = JSON.parse(raw) as ClinicData;
    if (!Array.isArray(parsed.patients) || !Array.isArray(parsed.exams)) {
      return cloneData(fallback);
    }
    return parsed;
  } catch {
    return cloneData(fallback);
  }
}

export function saveData(data: ClinicData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 隐私模式 / 配额受限时静默降级：时间线仍在内存中可用
  }
}
