// 页面层：顶部指标条（数据来自规则层 buildOverview 的派生结果）
import type { OverviewMetrics } from "../rules/timeline";

const CARDS: {
  key: keyof OverviewMetrics;
  label: string;
  tone: string;
  hint: string;
}[] = [
  { key: "patientCount", label: "随访患儿", tone: "status-ok", hint: "屈光发育档案" },
  { key: "highRiskChildren", label: "高风险患儿", tone: "status-danger", hint: "半年越线者" },
  { key: "focusCount", label: "重点随访记录", tone: "status-watch", hint: "已含户外与处置计划" },
  { key: "draftCount", label: "草稿待补", tone: "status-danger", hint: "越线但资料未齐" },
];

export default function MetricsBar({ metrics }: { metrics: OverviewMetrics }) {
  return (
    <section className="metrics-grid">
      {CARDS.map((card) => (
        <article key={card.key} className="metric-card">
          <span>{card.label}</span>
          <strong>{metrics[card.key]}</strong>
          <em className="metric-hint">{card.hint}</em>
          <i className={card.tone} />
        </article>
      ))}
    </section>
  );
}
