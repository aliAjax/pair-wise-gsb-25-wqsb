// 页面层：单患儿双眼随访时间线 + 版本链展示
import type { ExamDoc } from "../data/types";
import type { EyeSeries, PatientTimeline, TimelineEntry } from "../rules/timeline";
import { DAYS_HALF_YEAR } from "../rules/progression";
import type { ClinicApi } from "./useClinic";
import {
  EYE_LABEL,
  RISK_LABEL,
  STATUS_LABEL,
  fmtDateTime,
  fmtMm,
  fmtSigned,
} from "./format";

function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function EntryCard({
  entry,
  doc,
  api,
}: {
  entry: TimelineEntry;
  doc: ExamDoc | undefined;
  api: ClinicApi;
}) {
  const p = entry.progression;
  const versions = doc ? [...doc.versions].reverse() : [];

  return (
    <article className={`entry-card risk-border-${entry.risk} status-${entry.status}`}>
      <div className="entry-head">
        <div>
          <h3>{entry.date}</h3>
          <span className={`risk-badge risk-${entry.risk}`}>
            {RISK_LABEL[entry.risk]}
          </span>
          <span className={`status-badge status-${entry.status}`}>
            {STATUS_LABEL[entry.status]}
          </span>
        </div>
        <button onClick={() => api.openRevise(entry.docId)}>修订（新建版本）</button>
      </div>

      <div className="metric-grid">
        <Metric label="球镜" value={`${fmtSigned(entry.metrics.sphere)} DS`} />
        <Metric label="柱镜" value={`${fmtSigned(entry.metrics.cylinder)} DC`} />
        <Metric
          label="轴位"
          value={entry.metrics.axis != null ? `${entry.metrics.axis}°` : "—"}
        />
        <Metric label="等效球镜" value={`${fmtSigned(entry.metrics.se)} D`} />
        <Metric label="眼轴" value={fmtMm(entry.metrics.axialLength)} />
        <Metric
          label="户外"
          value={entry.outdoorHours !== null ? `${entry.outdoorHours} h/日` : "未填"}
        />
      </div>

      <div className="progression">
        {p.evaluable ? (
          <>
            <span>
              对照 {p.baselineDate}（{p.days} 天）：原始眼轴{" "}
              {fmtSigned(p.rawAxialDelta)} mm · 等效球镜 {fmtSigned(p.rawSeDelta)} D
            </span>
            <span className="rate">
              半年等效：眼轴 +{(p.axialRate6m ?? 0).toFixed(2)} mm
              {p.axialHit ? " 🔺" : ""} · 球镜 {fmtSigned(p.seRate6m)} D
              {p.seHit ? " 🔺" : ""}
            </span>
            <span className="rule-note">
              判定规则：间隔折算 {DAYS_HALF_YEAR} 天，&gt;0.20mm 或下降
              &gt;0.50D 转重点随访
            </span>
          </>
        ) : (
          <span className="rule-note">
            无有效基线（首次建档或距上次复查不足 30 天），不参与进展判定
          </span>
        )}
        {entry.alerts.map((a) => (
          <p key={a} className="alert-text">
            {a}
          </p>
        ))}
        {entry.missingFields.length > 0 && (
          <p className="alert-text">
            重点随访资料未齐，待补：
            {entry.missingFields
              .map((f) => (f === "outdoorHours" ? "户外时长" : "处置计划"))
              .join("、")}
            （当前存为草稿）
          </p>
        )}
        {entry.keepDraft && <p className="alert-text">操作者标记：先存草稿</p>}
      </div>

      {entry.plan && (
        <p className="plan-line">
          <b>处置计划：</b>
          {entry.plan}
        </p>
      )}
      {entry.note && (
        <p className="note-line">
          <b>备注：</b>
          {entry.note}
        </p>
      )}

      <details className="version-chain">
        <summary>
          版本链（{entry.versionCount} 版）{entry.versionCount > 1 ? "· 已修订" : ""}
        </summary>
        <ol>
          {versions.map((ver, idx) => {
            const no = versions.length - idx;
            const isCurrent = idx === 0;
            return (
              <li key={ver.versionId} className={isCurrent ? "current" : "old"}>
                <div className="ver-head">
                  <strong>
                    v{no}
                    {isCurrent ? "（当前）" : "（旧值保留）"}
                  </strong>
                  <span>{fmtDateTime(ver.createdAt)}</span>
                  <span>{ver.author}</span>
                </div>
                <div className="ver-values">
                  球镜 {fmtSigned(ver.metrics.sphere)} DS · 柱镜{" "}
                  {fmtSigned(ver.metrics.cylinder)} DC · 轴位{" "}
                  {ver.metrics.axis != null ? `${ver.metrics.axis}°` : "—"} · SE{" "}
                  {fmtSigned(ver.metrics.se)} D · 眼轴 {fmtMm(ver.metrics.axialLength)}
                  {ver.outdoorHours !== null && ` · 户外 ${ver.outdoorHours}h/日`}
                </div>
                {ver.reason && (
                  <div className="ver-reason">修改原因：{ver.reason}</div>
                )}
                {ver.plan && <div className="ver-plan">处置计划：{ver.plan}</div>}
                {ver.note && <div className="ver-plan">备注：{ver.note}</div>}
              </li>
            );
          })}
        </ol>
      </details>
    </article>
  );
}

function EyeColumn({ series, api }: { series: EyeSeries; api: ClinicApi }) {
  const entries = [...series.entries].reverse(); // 最新在上
  return (
    <div className="eye-column">
      <h3 className="eye-title">
        {EYE_LABEL[series.eye]}（{series.eye}） · {entries.length} 次复查
      </h3>
      {entries.length === 0 && <p className="empty">暂无复查记录</p>}
      <div className="entry-list">
        {entries.map((entry) => {
          const doc = api.data.exams.find((d) => d.id === entry.docId);
          return <EntryCard key={entry.docId} entry={entry} doc={doc} api={api} />;
        })}
      </div>
    </div>
  );
}

export default function TimelineView({
  timeline,
  api,
}: {
  timeline: PatientTimeline;
  api: ClinicApi;
}) {
  const newest =
    timeline.series
      .flatMap((s) => s.entries)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  return (
    <section className="panel timeline">
      <div className="section-heading">
        <div>
          <p>近视进展随访时间线</p>
          <h2>
            {timeline.patient.name}{" "}
            <span className="patient-id">{timeline.patient.id}</span>
          </h2>
        </div>
        <button className="primary-action" onClick={api.openCreate}>
          新增复查
        </button>
      </div>

      <div className="timeline-summary">
        <span>{timeline.patient.gender || "性别未填"}</span>
        <span>
          出生 {timeline.patient.birthDate || "未填"}（
          {newest ? `最近就诊 ${newest.date}` : "尚无就诊"}）
        </span>
        <span className={`risk-badge risk-${timeline.latestRisk}`}>
          患儿风险：{RISK_LABEL[timeline.latestRisk]}
        </span>
        <span className={`status-badge status-focus`}>
          重点随访 {timeline.focusCount} 条
        </span>
        <span className={`status-badge status-draft`}>
          草稿 {timeline.draftCount} 条
        </span>
      </div>

      <div className="eye-grid">
        {timeline.series.map((series) => (
          <EyeColumn key={series.eye} series={series} api={api} />
        ))}
      </div>
    </section>
  );
}
