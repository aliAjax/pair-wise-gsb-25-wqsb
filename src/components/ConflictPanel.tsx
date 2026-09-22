import type { ConflictInfo } from "../domain/types";
import { EYE_LABEL } from "./StatusBadge";
import { formatDiopter, formatMm, sphericalEquivalent } from "../rules/optics";

interface Props {
  conflict: ConflictInfo;
  onRevise: () => void;
  onDismiss: () => void;
}

/** 同日同眼冲突：展示患者、日期、眼别与已有记录原值 */
export function ConflictPanel({ conflict, onRevise, onDismiss }: Props) {
  const e = conflict.existing;
  return (
    <section className="panel conflict-panel">
      <div className="conflict-head">
        <h2>同日同眼记录已存在</h2>
        <button onClick={onDismiss} aria-label="关闭冲突提示">
          ✕
        </button>
      </div>
      <dl className="conflict-grid">
        <div>
          <dt>患者</dt>
          <dd>
            {conflict.patientName}（{conflict.patientId}）
          </dd>
        </div>
        <div>
          <dt>日期</dt>
          <dd>{conflict.date}</dd>
        </div>
        <div>
          <dt>眼别</dt>
          <dd>{EYE_LABEL[conflict.eye]}</dd>
        </div>
        <div>
          <dt>当前版本</dt>
          <dd>v{e.versions.length}</dd>
        </div>
      </dl>
      <div className="conflict-values">
        <h3>原值（将保留在版本链中）</h3>
        <table>
          <tbody>
            <tr>
              <th>球镜</th>
              <td>{formatDiopter(e.sphere)}</td>
              <th>柱镜</th>
              <td>{formatDiopter(e.cylinder)}</td>
            </tr>
            <tr>
              <th>等效球镜</th>
              <td>{formatDiopter(sphericalEquivalent(e))}</td>
              <th>眼轴</th>
              <td>{formatMm(e.axialLength)}</td>
            </tr>
            <tr>
              <th>户外时长</th>
              <td>{e.outdoorHours === undefined ? "未填" : `${e.outdoorHours} 小时/日`}</td>
              <th>处置计划</th>
              <td>{e.plan || "未填"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="conflict-hint">
        系统不覆盖原值。如需更正，请填写修订原因后新建版本，旧值可在版本链中追溯。
      </p>
      <div className="conflict-actions">
        <button className="primary-action" onClick={onRevise}>
          基于原值修订（新建版本）
        </button>
        <button onClick={onDismiss}>取消</button>
      </div>
    </section>
  );
}
