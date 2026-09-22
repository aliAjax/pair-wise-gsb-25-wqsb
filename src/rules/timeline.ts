// ============================================================
// 规则层：时间线与风险汇总（纯函数派生，刷新后与数据严格一致）
// ============================================================

import type {
  Exam,
  ExamRisk,
  Eye,
  Patient,
  PatientSummary,
} from "../domain/types";
import { evaluateExam, higherStatus } from "./risk";

export interface TimelineEntry {
  exam: Exam;
  risk: ExamRisk;
}

export interface EyeTimeline {
  eye: Eye;
  entries: TimelineEntry[]; // 日期升序
}

/** 同眼按日期升序排列，并逐条带上相对前一条的风险评估 */
export function eyeTimeline(exams: Exam[], eye: Eye): EyeTimeline {
  const ordered = exams
    .filter((e) => e.eye === eye)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const entries: TimelineEntry[] = ordered.map((exam, i) => ({
    exam,
    risk: evaluateExam(exam, ordered[i - 1]),
  }));
  return { eye, entries };
}

/** 患者双眼时间线 */
export function patientTimelines(exams: Exam[]): Record<Eye, EyeTimeline> {
  return {
    OD: eyeTimeline(exams, "OD"),
    OS: eyeTimeline(exams, "OS"),
  };
}

/** 某患者汇总：最新状态 = 双眼各最新一条中的最高风险 */
export function summarizePatient(patient: Patient, exams: Exam[]): PatientSummary {
  const timelines = patientTimelines(exams);
  let status: PatientSummary["status"] = "normal";
  const latestReasons: string[] = [];

  (Object.values(timelines) as EyeTimeline[]).forEach((tl) => {
    const last = tl.entries[tl.entries.length - 1];
    if (last) {
      status = higherStatus(status, last.risk.status);
      latestReasons.push(
        `${last.exam.eye === "OD" ? "右眼" : "左眼"}：${last.risk.reasons.join("；")}`
      );
    }
  });

  return { patient, exams, status, latestReasons };
}

export function summarizeAll(patients: Patient[], exams: Exam[]): PatientSummary[] {
  return patients.map((p) =>
    summarizePatient(
      p,
      exams.filter((e) => e.patientId === p.id)
    )
  );
}

/** 取一条复查在其同眼时间线中的风险（用于列表徽标） */
export function riskOfExam(allExams: Exam[], exam: Exam): ExamRisk {
  const tl = eyeTimeline(
    allExams.filter((e) => e.patientId === exam.patientId),
    exam.eye
  );
  return tl.entries.find((t) => t.exam.id === exam.id)?.risk ?? evaluateExam(exam, undefined);
}
