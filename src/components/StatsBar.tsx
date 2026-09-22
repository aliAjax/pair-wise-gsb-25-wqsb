import type { PatientSummary } from "../domain/types";

interface Props {
  summaries: PatientSummary[];
  totalExams: number;
  draftCount: number;
}

/** 顶部统计：数值全部由规则层从数据实时派生 */
export function StatsBar({ summaries, totalExams, draftCount }: Props) {
  const focusCount = summaries.filter((s) => s.status === "focus").length;
  const normalCount = summaries.filter((s) => s.status === "normal").length;

  const cards = [
    { label: "随访儿童", value: summaries.length, sub: `常规 ${normalCount} 人`, tone: "" },
    { label: "重点随访", value: focusCount, sub: "半年进展越限", tone: "card-focus" },
    { label: "草稿待补全", value: draftCount, sub: "缺户外时长 / 处置计划", tone: "card-draft" },
    { label: "累计复查眼次", value: totalExams, sub: "患者 + 日期 + 眼别唯一", tone: "" },
  ];

  return (
    <section className="metrics-grid">
      {cards.map((c) => (
        <article key={c.label} className={`metric-card ${c.tone}`}>
          <span>{c.label}</span>
          <strong>{c.value}</strong>
          <small>{c.sub}</small>
        </article>
      ))}
    </section>
  );
}
