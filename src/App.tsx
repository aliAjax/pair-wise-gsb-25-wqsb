import { useMemo, useState } from "react";
import "./styles.css";
import { useFollowUp } from "./state/useFollowUp";
import { StatsBar } from "./components/StatsBar";
import { PatientSidebar } from "./components/PatientSidebar";
import { TimelineColumn } from "./components/Timeline";
import { ExamForm } from "./components/ExamForm";
import { ConflictPanel } from "./components/ConflictPanel";

const RULES_TEXT = [
  "唯一键：患者 + 日期 + 眼别，同日同眼仅保留一条",
  "半年眼轴增长 > 0.20mm，或等效球镜下降 > 0.50D → 重点随访",
  "不足半年的间隔按 182.625 天换算为半年当量后判定",
  "触发重点随访须填写户外时长与处置计划，否则记为草稿",
  "任何修改都新建带原因的版本，旧值保留在版本链",
];

function App() {
  const fu = useFollowUp();
  const [selectedId, setSelectedId] = useState(fu.patients[0]?.id ?? "");
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const timelines = fu.timelinesByPatient.get(selectedId);
  const revisionExam = revisionId ? fu.getExam(revisionId) : undefined;

  // 草稿眼次：对所有复查逐条跑规则，状态不入库、刷新后重算
  const draftCount = useMemo(() => {
    let n = 0;
    for (const patientId of fu.timelinesByPatient.keys()) {
      const tls = fu.timelinesByPatient.get(patientId)!;
      (["OD", "OS"] as const).forEach((eye) => {
        n += tls[eye].entries.filter((t) => t.risk.status === "draft").length;
      });
    }
    return n;
  }, [fu.timelinesByPatient]);

  const startRevise = (id: string) => {
    setRevisionId(id);
    setRevisionReason("");
    document.getElementById("exam-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const cancelRevise = () => {
    setRevisionId(null);
    setRevisionReason("");
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-11 · 儿童近视进展随访台</p>
          <h1>近视进展随访台</h1>
          <p className="subtitle">
            按患者、日期、眼别记录球镜、等效球镜与眼轴；时间线、风险等级与版本链均由规则实时派生，
            数据 / 规则 / 页面三层分离。
          </p>
          <ul className="rules-list">
            {RULES_TEXT.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="stack-card">
          <span>分层结构</span>
          <strong>
            data/ 数据（localStorage + 唯一键 + 版本）
            <br />
            rules/ 规则（SE、半年化风险、时间线）
            <br />
            components/ 页面（录入、冲突、时间线）
          </strong>
          <button onClick={fu.reset}>重置为示例数据</button>
        </div>
      </section>

      <StatsBar
        summaries={fu.summaries}
        totalExams={fu.summaries.reduce((n, s) => n + s.exams.length, 0)}
        draftCount={draftCount}
      />

      {fu.notice && (
        <div className={`notice notice-${fu.notice.type}`}>
          <span>{fu.notice.text}</span>
          <button onClick={() => fu.setNotice(null)} aria-label="关闭提示">✕</button>
        </div>
      )}

      <section className="workspace">
        <PatientSidebar
          summaries={fu.summaries}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            cancelRevise();
          }}
        />

        <div className="timelines" id="timelines">
          {timelines ? (
            <div className="timeline-grid">
              <TimelineColumn
                timeline={timelines.OD}
                expandedId={expandedVersion}
                onToggle={(id) => setExpandedVersion((v) => (v === id ? null : id))}
                onRevise={startRevise}
              />
              <TimelineColumn
                timeline={timelines.OS}
                expandedId={expandedVersion}
                onToggle={(id) => setExpandedVersion((v) => (v === id ? null : id))}
                onRevise={startRevise}
              />
            </div>
          ) : (
            <p className="empty-note">请选择左侧患者</p>
          )}
        </div>
      </section>

      {fu.conflict && (
        <ConflictPanel
          conflict={fu.conflict}
          onRevise={() => {
            startRevise(fu.conflict!.existing.id);
            fu.dismissConflict();
          }}
          onDismiss={fu.dismissConflict}
        />
      )}

      <div id="exam-form">
        {revisionExam ? (
          <ExamForm
            key={`revise-${revisionExam.id}-${revisionExam.versions.length}`}
            mode="revise"
            exam={revisionExam}
            reason={revisionReason}
            onReasonChange={setRevisionReason}
            patients={fu.patients}
            timelinesByPatient={fu.timelinesByPatient}
            onReviseAction={fu.revise}
            onCancelRevise={cancelRevise}
            onSubmitted={cancelRevise}
          />
        ) : (
          <ExamForm
            key={`add-${selectedId}`}
            mode="add"
            defaultPatientId={selectedId}
            patients={fu.patients}
            timelinesByPatient={fu.timelinesByPatient}
            onAddAction={fu.add}
            onSubmitted={() => undefined}
          />
        )}
      </div>
    </main>
  );
}

export default App;
