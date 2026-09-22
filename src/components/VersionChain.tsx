import type { Exam } from "../domain/types";
import { formatDiopter, formatMm, sphericalEquivalent } from "../rules/optics";

/** 修订版本链：首版为初次录入，末版为当前值，旧值只追加不覆盖 */
export function VersionChain({ exam }: { exam: Exam }) {
  if (exam.versions.length === 1) {
    return <p className="version-hint">仅 v1 初次录入，尚未修订</p>;
  }
  return (
    <ol className="version-chain">
      {exam.versions.map((v) => {
        const isCurrent = v.version === exam.versions.length;
        return (
          <li key={v.version} className={isCurrent ? "version-current" : ""}>
            <header>
              <strong>v{v.version}</strong>
              <span>{new Date(v.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
              {isCurrent && <em>当前值</em>}
            </header>
            <p className="version-reason">原因：{v.reason}</p>
            <p className="version-values">
              球镜 {formatDiopter(v.sphere)} · 柱镜 {formatDiopter(v.cylinder)} · SE{" "}
              {formatDiopter(sphericalEquivalent(v))} · 眼轴 {formatMm(v.axialLength)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
