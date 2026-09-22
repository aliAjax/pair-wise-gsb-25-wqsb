import type { PatientSummary } from "../domain/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  summaries: PatientSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** 左侧患者列表：风险等级由规则层汇总（双眼最新状态取最高） */
export function PatientSidebar({ summaries, selectedId, onSelect }: Props) {
  return (
    <aside className="panel narrow patient-list">
      <h2>随访儿童</h2>
      {summaries.map((s) => (
        <button
          key={s.patient.id}
          className={`patient-row ${s.patient.id === selectedId ? "active" : ""}`}
          onClick={() => onSelect(s.patient.id)}
        >
          <div className="patient-row-head">
            <strong>
              {s.patient.name}
              <span className="patient-meta">
                {s.patient.gender} · {s.patient.age} 岁
              </span>
            </strong>
            <StatusBadge status={s.status} />
          </div>
          <span className="patient-id">{s.patient.id}</span>
          <span className="patient-reason">{s.latestReasons[0] ?? "暂无复查"}</span>
        </button>
      ))}
    </aside>
  );
}
