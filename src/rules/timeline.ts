// 规则层：时间线、风险等级与统计指标的统一推导入口。
// 页面只读这里的派生结果 —— 刷新后重算，保证时间线 / 风险 / 版本链一致。
import type {
  ClinicData,
  Eye,
  Patient,
  ExamDoc,
  ExamMetrics,
  ExamStatus,
  RiskLevel,
} from "../data/types";
import { latestVersion } from "../data/repository";
import {
  evaluateProgression,
  ProgressionResult,
} from "./progression";
import {
  hitReasons,
  missingFocusFields,
  resolveRisk,
  resolveStatus,
} from "./status";

export interface TimelineEntry {
  docId: string;
  patientId: string;
  date: string;
  eye: Eye;
  versionNo: number; // 当前版本号（从 1 开始）
  versionCount: number; // 版本链长度
  metrics: ExamMetrics;
  outdoorHours: number | null;
  plan: string;
  note: string;
  keepDraft: boolean;
  status: ExamStatus;
  risk: RiskLevel;
  progression: ProgressionResult;
  alerts: string[]; // 越线原因
  missingFields: ("outdoorHours" | "plan")[]; // 重点随访待补字段
}

export interface EyeSeries {
  eye: Eye;
  entries: TimelineEntry[]; // 日期升序
}

export interface PatientTimeline {
  patient: Patient;
  series: EyeSeries[]; // OD 在前
  latestRisk: RiskLevel; // 该患者最高/最近风险
  draftCount: number;
  focusCount: number;
}

export interface OverviewMetrics {
  patientCount: number;
  examCount: number;
  focusCount: number; // 重点随访条数（当前版本）
  draftCount: number; // 草稿条数
  highRiskChildren: number; // 含高风险当前记录的患儿数
}

type Baseline = { date: string; metrics: ExamMetrics } | null;

function deriveEntry(doc: ExamDoc, baseline: Baseline): TimelineEntry {
  const cur = latestVersion(doc);
  const progression = evaluateProgression(doc.date, cur.metrics, baseline);
  const status = resolveStatus(progression, cur);
  const missing = status === "draft" && progression.hit ? missingFocusFields(cur) : [];
  return {
    docId: doc.id,
    patientId: doc.patientId,
    date: doc.date,
    eye: doc.eye,
    versionNo: doc.versions.length,
    versionCount: doc.versions.length,
    metrics: cur.metrics,
    outdoorHours: cur.outdoorHours,
    plan: cur.plan,
    note: cur.note,
    keepDraft: cur.keepDraft,
    status,
    risk: resolveRisk(progression),
    progression,
    alerts: hitReasons(progression),
    missingFields: missing,
  };
}

const RISK_ORDER: Record<RiskLevel, number> = { normal: 0, watch: 1, high: 2 };

function buildSeries(docs: ExamDoc[]): EyeSeries[] {
  return (["OD", "OS"] as Eye[]).map((eye) => {
    const eyeDocs = docs
      .filter((doc) => doc.eye === eye)
      .sort((a, b) => a.date.localeCompare(b.date));

    let baseline: Baseline = null;
    // 时间升序单遍推导：每条记录以最近一条非草稿记录为基线，
    // 草稿（含"越线但户外时长/处置计划未补齐"）不能作为后续基线。
    const entries = eyeDocs.map((doc) => {
      const entry = deriveEntry(doc, baseline);
      if (entry.status !== "draft") {
        baseline = { date: doc.date, metrics: latestVersion(doc).metrics };
      }
      return entry;
    });

    return { eye, entries };
  });
}

export function buildPatientTimeline(
  data: ClinicData,
  patient: Patient
): PatientTimeline {
  const docs = data.exams.filter((doc) => doc.patientId === patient.id);
  const series = buildSeries(docs);
  const all = series.flatMap((s) => s.entries);
  let latestRisk: RiskLevel = "normal";
  for (const entry of all) {
    if (RISK_ORDER[entry.risk] > RISK_ORDER[latestRisk]) latestRisk = entry.risk;
  }
  return {
    patient,
    series,
    latestRisk,
    draftCount: all.filter((e) => e.status === "draft").length,
    focusCount: all.filter((e) => e.status === "focus").length,
  };
}

export function buildOverview(data: ClinicData): {
  metrics: OverviewMetrics;
  timelines: PatientTimeline[];
} {
  const timelines = data.patients.map((patient) =>
    buildPatientTimeline(data, patient)
  );
  const entries = timelines.flatMap((t) => t.series.flatMap((s) => s.entries));
  const metrics: OverviewMetrics = {
    patientCount: data.patients.length,
    examCount: data.exams.length,
    focusCount: entries.filter((e) => e.status === "focus").length,
    draftCount: entries.filter((e) => e.status === "draft").length,
    highRiskChildren: timelines.filter((t) => t.latestRisk === "high").length,
  };
  return { metrics, timelines };
}

/**
 * 为表单实时预览计算一次"假设提交"的状态：不写入任何数据。
 * excludeDocId 用于修订时排除自身（修订不能拿自己当基线）。
 */
export function previewEntry(
  data: ClinicData,
  candidate: {
    patientId: string;
    date: string;
    eye: Eye;
    metrics: ExamMetrics;
    outdoorHours: number | null;
    plan: string;
    keepDraft: boolean;
  },
  excludeDocId?: string
): { entry: TimelineEntry; baselineDate: string | null } {
  const sameEye = data.exams
    .filter(
      (doc) =>
        doc.patientId === candidate.patientId &&
        doc.eye === candidate.eye &&
        doc.id !== excludeDocId
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  // 基线池：排除草稿与未来/同日记录
  let baseline: Baseline = null;
  for (const doc of sameEye) {
    if (doc.date >= candidate.date) continue;
    const ver = latestVersion(doc);
    const prog = evaluateProgression(doc.date, ver.metrics, baseline);
    const status = resolveStatus(prog, ver);
    if (status === "draft") continue;
    baseline = { date: doc.date, metrics: ver.metrics };
  }

  const progression = evaluateProgression(
    candidate.date,
    candidate.metrics,
    baseline
  );
  const status = resolveStatus(progression, {
    outdoorHours: candidate.outdoorHours,
    plan: candidate.plan,
    keepDraft: candidate.keepDraft,
  });
  const missing =
    status === "draft" && progression.hit
      ? missingFocusFields({
          outdoorHours: candidate.outdoorHours,
          plan: candidate.plan,
        })
      : [];

  const entry: TimelineEntry = {
    docId: excludeDocId ?? "preview",
    patientId: candidate.patientId,
    date: candidate.date,
    eye: candidate.eye,
    versionNo: 1,
    versionCount: 1,
    metrics: candidate.metrics,
    outdoorHours: candidate.outdoorHours,
    plan: candidate.plan,
    note: "",
    keepDraft: candidate.keepDraft,
    status,
    risk: resolveRisk(progression),
    progression,
    alerts: hitReasons(progression),
    missingFields: missing,
  };
  return { entry, baselineDate: baseline?.date ?? null };
}
