// 页面层：同日同眼唯一键冲突弹窗 —— 显示患者、日期、眼别与原值，引导走修订流程
import { latestVersion } from "../data/repository";
import type { ExamDoc } from "../data/types";
import type { ClinicApi } from "./useClinic";
import { EYE_LABEL, fmtMm, fmtSigned, fmtDateTime } from "./format";

export default function ConflictDialog({
  doc,
  api,
}: {
  doc: ExamDoc | null;
  api: ClinicApi;
}) {
  if (!doc) return null;
  const patient = api.data.patients.find((p) => p.id === doc.patientId);
  const ver = latestVersion(doc);

  return (
    <div className="modal-mask" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="section-heading">
          <div>
            <p>记录冲突</p>
            <h2>同日同眼已存在复查记录</h2>
          </div>
        </div>

        <p className="conflict-key">
          患者 <b>{patient?.name ?? doc.patientId}</b>（{doc.patientId}） · 日期{" "}
          <b>{doc.date}</b> · 眼别 <b>{EYE_LABEL[doc.eye]}</b>{" "}
          已保留一条记录，重复录入已被阻止。
        </p>

        <table className="conflict-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>原值（v{doc.versions.length} 当前值）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>球镜</td>
              <td>{fmtSigned(ver.metrics.sphere)} DS</td>
            </tr>
            <tr>
              <td>等效球镜</td>
              <td>{fmtSigned(ver.metrics.se)} D</td>
            </tr>
            <tr>
              <td>眼轴</td>
              <td>{fmtMm(ver.metrics.axialLength)}</td>
            </tr>
            <tr>
              <td>柱镜 / 轴位</td>
              <td>
                {fmtSigned(ver.metrics.cylinder)} DC /{" "}
                {ver.metrics.axis != null ? `${ver.metrics.axis}°` : "—"}
              </td>
            </tr>
            <tr>
              <td>户外时长</td>
              <td>{ver.outdoorHours !== null ? `${ver.outdoorHours} h/日` : "未填"}</td>
            </tr>
            <tr>
              <td>处置计划</td>
              <td>{ver.plan || "未填"}</td>
            </tr>
            <tr>
              <td>记录时间 / 记录人</td>
              <td>
                {fmtDateTime(ver.createdAt)} · {ver.author}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="conflict-hint">
          若确需更正，请对该记录发起修订：系统会新建一条带原因的版本，上表原值在版本链中原样保留。
        </p>

        <div className="form-buttons">
          <button onClick={api.dismissConflict}>返回修改录入</button>
          <button className="primary-action" onClick={api.resolveConflictAsRevise}>
            以原值为基础发起修订
          </button>
        </div>
      </div>
    </div>
  );
}
