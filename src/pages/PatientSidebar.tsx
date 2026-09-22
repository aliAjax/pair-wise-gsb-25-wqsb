// 页面层：患儿列表 + 新增患儿
import { useState } from "react";
import type { Patient } from "../data/types";
import type { ClinicApi } from "./useClinic";
import { EYE_LABEL, RISK_LABEL, fmtAge } from "./format";

export default function PatientSidebar({ api }: { api: ClinicApi }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Patient["gender"]>("");
  const [birthDate, setBirthDate] = useState("");
  const [err, setErr] = useState("");

  const confirmAdd = () => {
    if (!name.trim()) {
      setErr("请填写患儿姓名");
      return;
    }
    api.createPatient({ name, gender, birthDate });
    setName("");
    setGender("");
    setBirthDate("");
    setErr("");
    setAdding(false);
  };

  return (
    <aside className="panel narrow sidebar">
      <div className="section-heading compact">
        <h2>随访患儿</h2>
        <button onClick={() => setAdding((v) => !v)}>
          {adding ? "收起" : "新增"}
        </button>
      </div>

      {adding && (
        <div className="add-patient">
          <input
            placeholder="姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Patient["gender"])}
          >
            <option value="">性别</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          {err && <em className="err">{err}</em>}
          <button className="primary-action" onClick={confirmAdd}>
            建档
          </button>
        </div>
      )}

      <div className="patient-list">
        {api.timelines.map((t) => {
          const newest = t.series
            .flatMap((s) => s.entries)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          return (
            <button
              key={t.patient.id}
              className={`patient-item ${
                t.patient.id === api.selectedId ? "active" : ""
              }`}
              onClick={() => api.setSelectedId(t.patient.id)}
            >
              <div className="patient-line">
                <strong>{t.patient.name}</strong>
                <span className={`risk-dot risk-${t.latestRisk}`} />
                <span className="risk-text">{RISK_LABEL[t.latestRisk]}</span>
              </div>
              <div className="patient-meta">
                <span>{t.patient.id}</span>
                <span>
                  {newest
                    ? `${fmtAge(t.patient.birthDate, newest.date)} · ${newest.date}`
                    : "未建档检查"}
                </span>
              </div>
              <div className="patient-flags">
                {t.focusCount > 0 && (
                  <span className="mini-badge focus">重点 {t.focusCount}</span>
                )}
                {t.draftCount > 0 && (
                  <span className="mini-badge draft">草稿 {t.draftCount}</span>
                )}
                <span className="eye-count">
                  {[...new Set(t.series.flatMap((s) => s.entries.map((e) => e.eye)))].length
                    ? t.series
                        .map((s) => `${EYE_LABEL[s.eye]}${s.entries.length}`)
                        .join(" · ")
                    : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
