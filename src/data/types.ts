// 数据层：领域类型定义
// 业务唯一键：患者 + 日期 + 眼别（同日同眼只留一条逻辑记录，修改以版本追加）

export type Eye = "OD" | "OS"; // OD=右眼 OS=左眼

/** 风险等级（由规则层根据进展速率推导，不持久化在录入数据里） */
export type RiskLevel = "normal" | "watch" | "high";

/** 随访状态：草稿 / 常规随访 / 重点随访 */
export type ExamStatus = "draft" | "routine" | "focus";

export interface Patient {
  id: string;
  name: string;
  gender: "男" | "女" | "";
  birthDate: string; // YYYY-MM-DD，可为空
}

/** 一次验光的核心测量值 */
export interface ExamMetrics {
  sphere: number; // 球镜 DS
  cylinder: number; // 柱镜 DC
  axis: number | null; // 轴位 °
  se: number; // 等效球镜 D = 球镜 + 柱镜/2
  axialLength: number; // 眼轴 mm
}

/**
 * 不可变版本：任何修改都新建一条版本，旧版本原样保留。
 * v1（首次录入）reason 为空；之后版本必须带修改原因。
 */
export interface ExamVersion {
  versionId: string;
  createdAt: string; // ISO 时间
  reason: string; // 修改原因，首版为 ""
  author: string;
  metrics: ExamMetrics;
  outdoorHours: number | null; // 日均户外时长（小时）
  plan: string; // 处置计划
  note: string;
  keepDraft: boolean; // 操作者显式要求存为草稿
}

/** 一条逻辑复查记录：患者+日期+眼别唯一，内含版本链 */
export interface ExamDoc {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  eye: Eye;
  versions: ExamVersion[]; // 按时间先后，最后一条为当前版本
}

export interface ClinicData {
  patients: Patient[];
  exams: ExamDoc[];
}

/** 录入 / 修订表单提交给数据层的载荷 */
export interface ExamInput {
  patientId: string;
  date: string;
  eye: Eye;
  metrics: ExamMetrics;
  outdoorHours: number | null;
  plan: string;
  note: string;
  keepDraft: boolean;
  reason?: string;
  author?: string;
}
