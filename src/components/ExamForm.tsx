import { useMemo, useState } from "react";
import type { Exam, ExamDraftInput, Eye, Patient, RevisionInput } from "../domain/types";
import { evaluateExam } from "../rules/risk";
import { round2, sphericalEquivalent } from "../rules/optics";
import type { EyeTimeline } from "../rules/timeline";
import { StatusBadge } from "./StatusBadge";

interface CommonProps {
  patients: Patient[];
  timelinesByPatient: Map<string, Record<Eye, EyeTimeline>>;
  onSubmitted: () => void;
}

interface AddProps extends CommonProps {
  mode: "add";
  defaultPatientId: string;
  onAddAction: (input: ExamDraftInput) => void;
}

interface ReviseProps extends CommonProps {
  mode: "revise";
  exam: Exam;
  reason: string;
  onReasonChange: (v: string) => void;
  onReviseAction: (input: RevisionInput) => void;
  onCancelRevise: () => void;
}

export type ExamFormProps = AddProps | ReviseProps;

interface FormState {
  patientId: string;
  date: string;
  eye: Eye;
  sphere: string;
  cylinder: string;
  axialLength: string;
  outdoorHours: string;
  plan: string;
}

const EMPTY: FormState = {
  patientId: "",
  date: "",
  eye: "OD",
  sphere: "",
  cylinder: "0",
  axialLength: "",
  outdoorHours: "",
  plan: "",
};

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function ExamForm(props: ExamFormProps) {
  const isRevise = props.mode === "revise";
  const revisionExam = isRevise ? props.exam : null;

  const [form, setForm] = useState<FormState>(() =>
    isRevise && revisionExam
      ? {
          patientId: revisionExam.patientId,
          date: revisionExam.date,
          eye: revisionExam.eye,
          sphere: String(revisionExam.sphere),
          cylinder: String(revisionExam.cylinder),
          axialLength: String(revisionExam.axialLength),
          outdoorHours: revisionExam.outdoorHours === undefined ? "" : String(revisionExam.outdoorHours),
          plan: revisionExam.plan ?? "",
        }
      : { ...EMPTY, patientId: props.mode === "add" ? props.defaultPatientId : "" }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const se = useMemo(() => {
    const sphere = parseNum(form.sphere);
    const cylinder = parseNum(form.cylinder) ?? 0;
    if (sphere === null) return null;
    return sphericalEquivalent({ sphere, cylinder });
  }, [form.sphere, form.cylinder]);

  // 风险预览：构造一条候选记录，跑同一套规则函数，确保预览与保存后一致
  const preview = useMemo(() => {
    const sphere = parseNum(form.sphere);
    const axial = parseNum(form.axialLength);
    const cylinder = parseNum(form.cylinder) ?? 0;
    if (sphere === null || axial === null || !form.date) return null;

    const tls = props.timelinesByPatient.get(form.patientId);
    if (!tls) return null;
    const ordered = tls[form.eye].entries;
    // 修订时把自己从时间线中剔除，用其前一条做基线
    const before = ordered.filter(
      (t) => t.exam.date < form.date && (!revisionExam || t.exam.id !== revisionExam.id)
    );
    const prev = before[before.length - 1]?.exam;

    const candidate: Exam = {
      id: revisionExam?.id ?? "preview",
      patientId: form.patientId,
      date: form.date,
      eye: form.eye,
      sphere: round2(sphere),
      cylinder: round2(cylinder),
      axialLength: round2(axial),
      outdoorHours: parseNum(form.outdoorHours) ?? undefined,
      plan: form.plan.trim() || undefined,
      versions: revisionExam?.versions ?? [],
      createdAt: revisionExam?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return evaluateExam(candidate, prev);
  }, [form, props.timelinesByPatient, revisionExam]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!isRevise && !form.patientId) next.patientId = "请选择患者";
    if (!form.date) next.date = "请选择复查日期";
    if (parseNum(form.sphere) === null) next.sphere = "请输入球镜数值";
    if (parseNum(form.cylinder) === null) next.cylinder = "请输入柱镜数值";
    const axial = parseNum(form.axialLength);
    if (axial === null) next.axialLength = "请输入眼轴";
    else if (axial < 15 || axial > 35) next.axialLength = "眼轴应在 15–35mm 之间";
    if (form.outdoorHours.trim() !== "") {
      const h = parseNum(form.outdoorHours);
      if (h === null || h < 0 || h > 24) next.outdoorHours = "户外时长应为 0–24 小时";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    if (isRevise && revisionExam) {
      if (!props.reason.trim()) {
        setErrors((e) => ({ ...e, reason: "修订必须填写原因" }));
        return;
      }
      props.onReviseAction({
        examId: revisionExam.id,
        reason: props.reason,
        values: {
          sphere: round2(Number(form.sphere)),
          cylinder: round2(Number(form.cylinder) ?? 0),
          axialLength: round2(Number(form.axialLength)),
        },
        outdoorHours: parseNum(form.outdoorHours) ?? undefined,
        plan: form.plan,
      });
    } else if (!isRevise) {
      props.onAddAction({
        patientId: form.patientId,
        date: form.date,
        eye: form.eye,
        sphere: round2(Number(form.sphere)),
        cylinder: round2(Number(form.cylinder) ?? 0),
        axialLength: round2(Number(form.axialLength)),
        outdoorHours: parseNum(form.outdoorHours) ?? undefined,
        plan: form.plan,
      });
      setForm({ ...EMPTY, patientId: form.patientId, eye: form.eye });
    }
    props.onSubmitted();
  };

  const careRequired = preview?.status === "focus" || preview?.status === "draft";

  return (
    <section className="panel exam-form">
      <div className="section-heading">
        <h2>{isRevise ? "修订复查（新建带原因版本）" : "新增复查"}</h2>
        {isRevise && revisionExam && (
          <span className="revise-target">
            {revisionExam.patientId} · {revisionExam.date} ·{" "}
            {revisionExam.eye === "OD" ? "右眼" : "左眼"}
          </span>
        )}
      </div>

      {isRevise && (
        <p className="revise-note">
          患者、日期、眼别为唯一键不可修改；测量值将另存为新版本，旧值保留在版本链。
        </p>
      )}

      <div className="form-grid">
        <label>
          <span>患者</span>
          <select
            value={form.patientId}
            disabled={isRevise}
            onChange={(e) => set("patientId", e.target.value)}
          >
            <option value="">请选择</option>
            {props.patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.id}）
              </option>
            ))}
          </select>
          {errors.patientId && <em className="field-error">{errors.patientId}</em>}
        </label>

        <label>
          <span>复查日期</span>
          <input
            type="date"
            value={form.date}
            disabled={isRevise}
            onChange={(e) => set("date", e.target.value)}
          />
          {errors.date && <em className="field-error">{errors.date}</em>}
        </label>

        <label>
          <span>眼别</span>
          <select
            value={form.eye}
            disabled={isRevise}
            onChange={(e) => set("eye", e.target.value as Eye)}
          >
            <option value="OD">右眼 OD</option>
            <option value="OS">左眼 OS</option>
          </select>
        </label>

        <label>
          <span>球镜 DS（近视填负）</span>
          <input
            type="number"
            step="0.25"
            value={form.sphere}
            placeholder="如 -1.25"
            onChange={(e) => set("sphere", e.target.value)}
          />
          {errors.sphere && <em className="field-error">{errors.sphere}</em>}
        </label>

        <label>
          <span>柱镜 DC</span>
          <input
            type="number"
            step="0.25"
            value={form.cylinder}
            onChange={(e) => set("cylinder", e.target.value)}
          />
          {errors.cylinder && <em className="field-error">{errors.cylinder}</em>}
        </label>

        <label>
          <span>眼轴长度（mm）</span>
          <input
            type="number"
            step="0.01"
            value={form.axialLength}
            placeholder="如 23.65"
            onChange={(e) => set("axialLength", e.target.value)}
          />
          {errors.axialLength && <em className="field-error">{errors.axialLength}</em>}
        </label>

        <label className={`se-preview ${careRequired ? "care-required" : ""}`}>
          <span>等效球镜（自动）</span>
          <input value={se === null ? "—" : `${se.toFixed(2)}D`} readOnly />
        </label>

        <label>
          <span>户外时长（小时/日）{careRequired && <b className="required-mark">*重点必填</b>}</span>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={form.outdoorHours}
            placeholder={careRequired ? "触发重点随访，必须填写" : "选填"}
            onChange={(e) => set("outdoorHours", e.target.value)}
          />
          {errors.outdoorHours && <em className="field-error">{errors.outdoorHours}</em>}
        </label>

        <label className="wide">
          <span>处置计划{careRequired && <b className="required-mark">*重点必填</b>}</span>
          <textarea
            rows={2}
            value={form.plan}
            placeholder={
              careRequired
                ? "如：0.01% 阿托品 + 多点离焦镜，3 个月后复查眼轴（触发重点随访，必须填写）"
                : "选填，如角膜塑形镜、离焦镜片、复查安排等"
            }
            onChange={(e) => set("plan", e.target.value)}
          />
        </label>
      </div>

      {preview && (
        <div className={`risk-preview preview-${preview.status}`}>
          <div className="risk-preview-head">
            <span>保存前风险预览</span>
            <StatusBadge status={preview.status} />
          </div>
          <ul>
            {preview.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {preview.missingFields.map((m) => (
              <li key={m} className="missing">
                缺少必填项：{m}，本条将以「草稿」保存
              </li>
            ))}
          </ul>
        </div>
      )}

      {isRevise && (
        <label className="reason-field">
          <span>修订原因（必填，将写入版本链）</span>
          <input
            value={props.reason}
            placeholder="如：复查单核回，首版球镜誊录错误"
            onChange={(e) => props.onReasonChange(e.target.value)}
          />
          {errors.reason && <em className="field-error">{errors.reason}</em>}
        </label>
      )}

      <div className="form-actions">
        <button className="primary-action" onClick={submit}>
          {isRevise ? "提交修订并新建版本" : "保存复查"}
        </button>
        {isRevise && <button onClick={props.onCancelRevise}>放弃修订</button>}
      </div>
    </section>
  );
}
