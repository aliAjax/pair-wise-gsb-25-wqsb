// 页面层：复查录入 / 修订表单。修订时锁定患者-日期-眼别，必须填写修改原因。
import { useEffect, useMemo, useRef, useState } from "react";
import type { Eye, ExamInput, ExamMetrics } from "../data/types";
import { latestVersion } from "../data/repository";
import { previewEntry } from "../rules/timeline";
import type { ClinicApi } from "./useClinic";
import {
  EYE_LABEL,
  RISK_LABEL,
  STATUS_LABEL,
  todayISO,
} from "./format";

interface FormState {
  patientId: string;
  date: string;
  eye: Eye;
  sphere: string;
  cylinder: string;
  axis: string;
  se: string;
  axial: string;
  outdoor: string;
  plan: string;
  note: string;
  reason: string;
  author: string;
  keepDraft: boolean;
}

function num(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function ExamForm({ api }: { api: ClinicApi }) {
  const mode = api.formMode;
  const reviseDoc =
    mode?.kind === "revise"
      ? api.data.exams.find((d) => d.id === mode.docId) ?? null
      : null;

  const lastAutoSe = useRef<string | null>(null);
  const [form, setForm] = useState<FormState>(() => {
    if (mode?.kind === "revise") {
      const doc = api.data.exams.find((d) => d.id === mode.docId);
      const ver = doc ? latestVersion(doc) : null;
      return {
        patientId: doc?.patientId ?? api.selectedId,
        date: doc?.date ?? todayISO(),
        eye: doc?.eye ?? "OD",
        sphere: ver ? String(ver.metrics.sphere) : "",
        cylinder: ver ? String(ver.metrics.cylinder) : "",
        axis: ver?.metrics.axis != null ? String(ver.metrics.axis) : "",
        se: ver ? String(ver.metrics.se) : "",
        axial: ver ? String(ver.metrics.axialLength) : "",
        outdoor: ver?.outdoorHours != null ? String(ver.outdoorHours) : "",
        plan: ver?.plan ?? "",
        note: ver?.note ?? "",
        reason: "",
        author: ver?.author ?? "",
        keepDraft: ver?.keepDraft ?? false,
      };
    }
    return {
      patientId: api.selectedId,
      date: todayISO(),
      eye: "OD",
      sphere: "",
      cylinder: "",
      axis: "",
      se: "",
      axial: "",
      outdoor: "",
      plan: "",
      note: "",
      reason: "",
      author: "",
      keepDraft: false,
    };
  });

  // 切换模式/目标记录时重置表单
  useEffect(() => {
    lastAutoSe.current = null;
    if (mode?.kind === "revise") {
      const doc = api.data.exams.find((d) => d.id === mode.docId);
      const ver = doc ? latestVersion(doc) : null;
      setForm((f) => ({
        ...f,
        patientId: doc?.patientId ?? f.patientId,
        date: doc?.date ?? f.date,
        eye: doc?.eye ?? f.eye,
        sphere: ver ? String(ver.metrics.sphere) : "",
        cylinder: ver ? String(ver.metrics.cylinder) : "",
        axis: ver?.metrics.axis != null ? String(ver.metrics.axis) : "",
        se: ver ? String(ver.metrics.se) : "",
        axial: ver ? String(ver.metrics.axialLength) : "",
        outdoor: ver?.outdoorHours != null ? String(ver.outdoorHours) : "",
        plan: ver?.plan ?? "",
        note: ver?.note ?? "",
        reason: "",
        author: ver?.author ?? "",
        keepDraft: ver?.keepDraft ?? false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode?.kind, mode?.kind === "revise" ? mode.docId : null]);

  const sphere = num(form.sphere);
  const cylinder = num(form.cylinder);

  // 等效球镜 = 球镜 + 柱镜/2：未手改时随球柱镜联动
  useEffect(() => {
    if (sphere === null || cylinder === null) return;
    const auto = String(Math.round((sphere + cylinder / 2) * 1000) / 1000);
    if (form.se === "" || form.se === lastAutoSe.current) {
      lastAutoSe.current = auto;
      setForm((f) => ({ ...f, se: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sphere, cylinder]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const axis = form.axis.trim() === "" ? null : num(form.axis);
  const se = num(form.se);
  const axial = num(form.axial);
  const outdoor = form.outdoor.trim() === "" ? null : num(form.outdoor);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.patientId) e.patientId = "请选择患儿";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) e.date = "请选择复查日期";
    if (sphere === null) e.sphere = "请填球镜";
    else if (sphere < -25 || sphere > 25) e.sphere = "球镜范围异常";
    if (cylinder === null) e.cylinder = "请填柱镜（平光填 0）";
    if (form.axis.trim() !== "" && (axis === null || axis < 1 || axis > 180))
      e.axis = "轴位 1–180";
    if (se === null) e.se = "请填等效球镜";
    if (axial === null || axial <= 10 || axial >= 40) e.axial = "眼轴 10–40 mm";
    if (outdoor !== null && (outdoor < 0 || outdoor > 12))
      e.outdoor = "户外时长 0–12 小时";
    if (mode?.kind === "revise" && !form.reason.trim())
      e.reason = "修订必须填写原因，旧值会保留在版本链";
    return e;
  }, [form, sphere, cylinder, axis, se, axial, outdoor, mode]);

  const metricsValid =
    sphere !== null &&
    cylinder !== null &&
    se !== null &&
    axial !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.date);

  const metrics: ExamMetrics | null = metricsValid
    ? { sphere: sphere!, cylinder: cylinder!, axis, se: se!, axialLength: axial! }
    : null;

  const preview = useMemo(() => {
    if (!metrics) return null;
    return previewEntry(
      api.data,
      {
        patientId: form.patientId,
        date: form.date,
        eye: form.eye,
        metrics,
        outdoorHours: outdoor,
        plan: form.plan,
        keepDraft: form.keepDraft,
      },
      reviseDoc?.id
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    metrics,
    form.patientId,
    form.date,
    form.eye,
    outdoor,
    form.plan,
    form.keepDraft,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metrics || Object.keys(errors).length > 0) return;
    const input: ExamInput = {
      patientId: form.patientId,
      date: form.date,
      eye: form.eye,
      metrics,
      outdoorHours: outdoor,
      plan: form.plan,
      note: form.note,
      keepDraft: form.keepDraft,
      reason: form.reason,
      author: form.author,
    };
    if (mode?.kind === "revise") {
      api.submitRevise(mode.docId, input);
    } else {
      const conflict = api.submitCreate(input);
      if (!conflict) api.closeForm();
    }
  };

  const readOnly = mode?.kind === "revise";

  return (
    <section className="panel form-panel">
      <div className="section-heading">
        <div>
          <p>{readOnly ? "修订模式" : "新增复查"}</p>
          <h2>{readOnly ? "新建带原因版本" : "录入验光数据"}</h2>
        </div>
        <button type="button" onClick={api.closeForm}>
          关闭
        </button>
      </div>

      <form onSubmit={handleSubmit} className="exam-form">
        <div className="field-grid">
          <label>
            <span>患儿</span>
            <select
              value={form.patientId}
              disabled={readOnly}
              onChange={(e) => set("patientId", e.target.value)}
            >
              {api.data.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（{p.id}）
                </option>
              ))}
            </select>
            {errors.patientId && <em className="err">{errors.patientId}</em>}
          </label>

          <label>
            <span>复查日期</span>
            <input
              type="date"
              value={form.date}
              disabled={readOnly}
              onChange={(e) => set("date", e.target.value)}
            />
            {errors.date && <em className="err">{errors.date}</em>}
          </label>

          <label>
            <span>眼别</span>
            <select
              value={form.eye}
              disabled={readOnly}
              onChange={(e) => set("eye", e.target.value as Eye)}
            >
              <option value="OD">{EYE_LABEL.OD} OD</option>
              <option value="OS">{EYE_LABEL.OS} OS</option>
            </select>
          </label>

          <label>
            <span>球镜 DS（0.25 步进）</span>
            <input
              inputMode="decimal"
              step="0.25"
              placeholder="如 -1.75"
              value={form.sphere}
              onChange={(e) => set("sphere", e.target.value)}
            />
            {errors.sphere && <em className="err">{errors.sphere}</em>}
          </label>

          <label>
            <span>柱镜 DC（0.25 步进）</span>
            <input
              inputMode="decimal"
              step="0.25"
              placeholder="平光填 0"
              value={form.cylinder}
              onChange={(e) => set("cylinder", e.target.value)}
            />
            {errors.cylinder && <em className="err">{errors.cylinder}</em>}
          </label>

          <label>
            <span>轴位 °（1–180，无散光留空）</span>
            <input
              inputMode="numeric"
              placeholder="如 180"
              value={form.axis}
              onChange={(e) => set("axis", e.target.value)}
            />
            {errors.axis && <em className="err">{errors.axis}</em>}
          </label>

          <label>
            <span>等效球镜 D（球镜 + 柱镜/2）</span>
            <input
              inputMode="decimal"
              placeholder="自动计算，可手改"
              value={form.se}
              onChange={(e) => set("se", e.target.value)}
            />
            {errors.se ? (
              <em className="err">{errors.se}</em>
            ) : (
              <em className="hint">与球柱镜不一致时以手填值为准</em>
            )}
          </label>

          <label>
            <span>眼轴 mm</span>
            <input
              inputMode="decimal"
              placeholder="如 23.62"
              value={form.axial}
              onChange={(e) => set("axial", e.target.value)}
            />
            {errors.axial && <em className="err">{errors.axial}</em>}
          </label>

          <label>
            <span>日均户外时长（小时）</span>
            <input
              inputMode="decimal"
              placeholder="重点随访必填"
              value={form.outdoor}
              onChange={(e) => set("outdoor", e.target.value)}
            />
            {errors.outdoor ? (
              <em className="err">{errors.outdoor}</em>
            ) : (
              <em className="hint">越线转重点随访时必填</em>
            )}
          </label>

          <label>
            <span>记录人</span>
            <input
              placeholder="如 复查医生 周岚"
              value={form.author}
              onChange={(e) => set("author", e.target.value)}
            />
          </label>
        </div>

        <label className="full-line">
          <span>处置计划</span>
          <textarea
            rows={2}
            placeholder="如 多点离焦镜片 + 每日户外 2 小时，3 个月后复查眼轴"
            value={form.plan}
            onChange={(e) => set("plan", e.target.value)}
          />
        </label>

        <label className="full-line">
          <span>备注</span>
          <textarea
            rows={2}
            placeholder="其他检查所见"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>

        {readOnly && (
          <label className="full-line reason-line">
            <span>修改原因（必填）</span>
            <textarea
              rows={2}
              placeholder="如 按验光单原件订正：球镜 -1.00 → -1.25"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
            />
            {errors.reason && <em className="err">{errors.reason}</em>}
          </label>
        )}

        {preview && (
          <div className={`preview preview-${preview.entry.risk}`}>
            <div className="preview-head">
              <strong>提交前规则预览</strong>
              <span className={`risk-badge risk-${preview.entry.risk}`}>
                {RISK_LABEL[preview.entry.risk]}
              </span>
              <span className={`status-badge status-${preview.entry.status}`}>
                {STATUS_LABEL[preview.entry.status]}
              </span>
            </div>
            <ul>
              {preview.entry.progression.evaluable ? (
                <>
                  <li>
                    对照基线：{preview.baselineDate}，间隔{" "}
                    {preview.entry.progression.days} 天
                  </li>
                  <li>
                    半年等效眼轴变化{" "}
                    <b>{preview.entry.progression.axialRate6m?.toFixed(2)} mm</b>
                    ；半年等效球镜变化{" "}
                    <b>
                      {preview.entry.progression.seRate6m?.toFixed(2)} D
                    </b>
                  </li>
                </>
              ) : (
                <li>无有效基线（首次建档或距上次复查不足 30 天），不判定进展</li>
              )}
              {preview.entry.alerts.map((a) => (
                <li key={a} className="alert-text">
                  越线：{a}
                </li>
              ))}
              {preview.entry.missingFields.length > 0 && (
                <li className="alert-text">
                  已达重点随访阈值，须补齐：
                  {preview.entry.missingFields
                    .map((f) => (f === "outdoorHours" ? "户外时长" : "处置计划"))
                    .join("、")}
                  ；否则本次只能存草稿
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="form-actions">
          <label className="draft-check">
            <input
              type="checkbox"
              checked={form.keepDraft}
              onChange={(e) => set("keepDraft", e.target.checked)}
            />
            先存草稿，稍后补资料
          </label>
          <div className="form-buttons">
            <button type="button" onClick={api.closeForm}>
              取消
            </button>
            <button
              type="submit"
              className="primary-action"
              disabled={Object.keys(errors).length > 0}
            >
              {readOnly ? "提交新版本（保留旧值）" : "保存复查"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
