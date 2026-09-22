import type { EyeTimeline } from "../rules/timeline";
import { formatDiopter, formatMm, sphericalEquivalent } from "../rules/optics";
import { StatusBadge, EYE_LABEL } from "./StatusBadge";
import { VersionChain } from "./VersionChain";

interface Props {
  timeline: EyeTimeline;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onRevise: (id: string) => void;
}

/** 单眼复查时间线：日期升序，逐条显示半年化进展与风险等级 */
export function TimelineColumn({ timeline, expandedId, onToggle, onRevise }: Props) {
  const entries = [...timeline.entries].reverse(); // 最新在上
  return (
    <section className="timeline-col">
      <h3 className="timeline-title">{EYE_LABEL[timeline.eye]}</h3>
      {entries.length === 0 && <p className="empty-note">暂无复查记录</p>}
      <ol className="timeline-list">
        {entries.map(({ exam, risk }, idx) => {
          const expanded = expandedId === exam.id;
          const isLatest = idx === 0;
          const d = risk.delta;
          return (
            <li key={exam.id} className={`timeline-item status-${risk.status}`}>
              <div className="timeline-card">
                <div className="timeline-top">
                  <div>
                    <strong className="timeline-date">{exam.date}</strong>
                    {isLatest && <span className="latest-tag">最新</span>}
                    {exam.versions.length > 1 && (
                      <span className="rev-tag">v{exam.versions.length}（含修订）</span>
                    )}
                  </div>
                  <StatusBadge status={risk.status} />
                </div>

                <div className="timeline-values">
                  <span>球镜 <b>{formatDiopter(exam.sphere)}</b></span>
                  <span>柱镜 <b>{formatDiopter(exam.cylinder)}</b></span>
                  <span>等效球镜 <b>{formatDiopter(sphericalEquivalent(exam))}</b></span>
                  <span>眼轴 <b>{formatMm(exam.axialLength)}</b></span>
                </div>

                {d && (
                  <div className="timeline-delta">
                    <span>
                      较 {d.prevDate}（{d.days} 天）：眼轴实测{" "}
                      <b className={d.axialPerHalfYear > 0.2 ? "over" : ""}>
                        +{d.axialDelta.toFixed(2)}mm
                      </b>
                      ，半年当量{" "}
                      <b className={d.axialPerHalfYear > 0.2 ? "over" : ""}>
                        +{d.axialPerHalfYear.toFixed(2)}mm
                      </b>
                    </span>
                    <span>
                      SE 实测 <b>{d.seDelta > 0 ? "+" : ""}{d.seDelta.toFixed(2)}D</b>
                      ，半年当量{" "}
                      <b className={-d.sePerHalfYear > 0.5 ? "over" : ""}>
                        {d.sePerHalfYear > 0 ? "+" : ""}{d.sePerHalfYear.toFixed(2)}D
                      </b>
                    </span>
                  </div>
                )}

                <ul className="risk-reasons">
                  {risk.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  {risk.missingFields.map((m) => (
                    <li key={m} className="missing">
                      必补：{m}
                    </li>
                  ))}
                </ul>

                {(exam.outdoorHours !== undefined || exam.plan) && (
                  <p className="care-info">
                    {exam.outdoorHours !== undefined && <>户外 {exam.outdoorHours} 小时/日</>}
                    {exam.plan && <> · 处置：{exam.plan}</>}
                  </p>
                )}

                <div className="timeline-actions">
                  <button onClick={() => onToggle(exam.id)}>
                    {expanded ? "收起版本链" : `查看版本链（${exam.versions.length}）`}
                  </button>
                  <button onClick={() => onRevise(exam.id)}>修订（留痕）</button>
                </div>

                {expanded && <VersionChain exam={exam} />}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
