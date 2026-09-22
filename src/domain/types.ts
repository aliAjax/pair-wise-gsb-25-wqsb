// ============================================================
// 领域类型：儿童近视进展随访
// 数据层 / 规则层 / 页面层共用的纯类型定义，不含任何实现
// ============================================================

/** 眼别 */
export type Eye = "OD" | "OS";

/**
 * 随访状态
 * - normal  常规随访（半年进展未越限）
 * - focus   重点随访（半年眼轴增长 > 0.20mm 或等效球镜下降 > 0.50D，
 *             且户外时长与处置计划已填）
 * - draft   草稿（触发重点随访但户外时长 / 处置计划未填全）
 */
export type FollowUpStatus = "normal" | "focus" | "draft";

/** 患者 */
export interface Patient {
  id: string;
  name: string;
  gender: "男" | "女";
  age: number;
}

/** 一次验光记录的测量值（按患者 + 日期 + 眼别唯一） */
export interface ExamValues {
  /** 球镜（D，近视记负数） */
  sphere: number;
  /** 柱镜（D，散光，默认 0） */
  cylinder: number;
  /** 眼轴长度（mm） */
  axialLength: number;
}

/** 修订版本：每次修改新建一条，旧值原样保留 */
export interface ExamVersion extends ExamValues {
  /** 版本序号，从 1 开始 */
  version: number;
  /** 修订原因（首个版本为“初次录入”） */
  reason: string;
  createdAt: string;
}

/**
 * 一次复查（同一患者、同一日期、同一眼别只允许一条）。
 * 状态不入库保存，由规则层依据版本链随时重算，保证刷新后一致。
 */
export interface Exam extends ExamValues {
  id: string;
  patientId: string;
  /** 复查日期 ISO（yyyy-mm-dd） */
  date: string;
  eye: Eye;
  /** 每日户外时长（小时），重点随访必填 */
  outdoorHours?: number;
  /** 处置计划，重点随访必填 */
  plan?: string;
  /** 版本链，末尾为当前值；旧值只追加、不覆盖 */
  versions: ExamVersion[];
  createdAt: string;
  updatedAt: string;
}

/** 规则层计算出的两次复查之间的半年化进展 */
export interface ProgressionDelta {
  prevDate: string;
  days: number;
  /** 眼轴实测增量（mm） */
  axialDelta: number;
  /** 眼轴半年（182.625 天）化增量（mm） */
  axialPerHalfYear: number;
  /** 等效球镜实测变化（D，负数表示加深） */
  seDelta: number;
  /** 等效球镜半年化变化（D） */
  sePerHalfYear: number;
}

/** 单眼单次复查的风险评估结果 */
export interface ExamRisk {
  status: FollowUpStatus;
  /** 越限原因，用于界面说明 */
  reasons: string[];
  delta: ProgressionDelta | null;
  /** 处置资料是否缺失（触发重点随访时才有意义） */
  missingFields: string[];
}

/** 患者汇总 */
export interface PatientSummary {
  patient: Patient;
  exams: Exam[];
  /** 取双眼最新状态中的最高风险 */
  status: FollowUpStatus;
  latestReasons: string[];
}

/** 录入新复查时表单提交的载荷 */
export interface ExamDraftInput {
  patientId: string;
  date: string;
  eye: Eye;
  sphere: number;
  cylinder: number;
  axialLength: number;
  outdoorHours?: number;
  plan?: string;
}

/** 修订载荷 */
export interface RevisionInput {
  examId: string;
  reason: string;
  values: Partial<ExamValues>;
  outdoorHours?: number;
  plan?: string;
}

/** 同日同眼唯一键冲突信息（含原值，供冲突界面展示） */
export interface ConflictInfo {
  patientId: string;
  patientName: string;
  date: string;
  eye: Eye;
  existing: Exam;
}
