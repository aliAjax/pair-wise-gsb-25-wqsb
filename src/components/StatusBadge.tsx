import type { FollowUpStatus } from "../domain/types";
import { STATUS_LABEL } from "../rules/risk";

const CLASS: Record<FollowUpStatus, string> = {
  normal: "badge-normal",
  focus: "badge-focus",
  draft: "badge-draft",
};

export function StatusBadge({ status }: { status: FollowUpStatus }) {
  return <span className={`status-badge ${CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export const EYE_LABEL: Record<"OD" | "OS", string> = {
  OD: "右眼 OD",
  OS: "左眼 OS",
};
