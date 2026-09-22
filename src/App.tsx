// 页面层：布局组装。数据（src/data）、规则（src/rules）、页面（src/pages）三层互不越界。
import "./styles.css";
import MetricsBar from "./pages/MetricsBar";
import PatientSidebar from "./pages/PatientSidebar";
import TimelineView from "./pages/TimelineView";
import ExamForm from "./pages/ExamForm";
import ConflictDialog from "./pages/ConflictDialog";
import { useClinic } from "./pages/useClinic";

const project = {
  id: "hxwl-11",
  port: 5111,
  title: "儿童近视进展随访台",
  subtitle: "按患儿、复查日期与眼别追踪球镜、等效球镜与眼轴；半年眼轴增长 > 0.20mm 或等效球镜下降 > 0.50D 自动转重点随访",
  stack: "React + Vite + TypeScript + CSS（数据层 / 规则层 / 页面层分离）",
};

function App() {
  const api = useClinic();

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {project.id} · port {project.port}
          </p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈与分层</span>
          <strong>{project.stack}</strong>
          <span className="layer-note">
            data：唯一键 + 版本链存储 · rules：阈值 / 风险 / 状态纯函数 ·
            pages：时间线与表单
          </span>
          <button onClick={api.resetDemo}>重置演示数据</button>
        </div>
      </section>

      <MetricsBar metrics={api.metrics} />

      <section className="rule-strip panel">
        <strong>随访规则</strong>
        <span>
          ① 患者 + 日期 + 眼别唯一，同日同眼只留一条；② 修改只能新建带原因版本，旧值保留；
          ③ 与最近一次非草稿复查对比，变化量按 182.625 天折算半年速率；
          ④ 眼轴 &gt; 0.20mm 或等效球镜下降 &gt; 0.50D 转重点随访，须填户外时长与处置计划，否则存草稿；
          ⑤ 刷新后时间线、风险等级、版本链均从存储数据重算。
        </span>
      </section>

      <section className="workspace">
        <PatientSidebar api={api} />
        <div className="main-col">
          {api.formMode && <ExamForm api={api} />}
          {api.selected ? (
            <TimelineView timeline={api.selected} api={api} />
          ) : (
            <section className="panel empty-state">
              <h2>尚无患儿档案</h2>
              <p>请先在左侧新增患儿，再录入复查数据。</p>
            </section>
          )}
        </div>
      </section>

      <footer className="foot-note">
        本地演示数据保存在浏览器 localStorage；刷新页面不会丢失，时间线 / 风险 /
        版本链始终一致。
      </footer>

      <ConflictDialog doc={api.conflict} api={api} />
    </main>
  );
}

export default App;
