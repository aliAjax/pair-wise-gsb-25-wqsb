// ============================================================
// 页面层状态：从数据层加载，所有派生（时间线 / 风险等级 / 版本链）
// 均由规则层实时计算，刷新后从 localStorage 重新派生，保持一致
// ============================================================

import { useCallback, useMemo, useState } from "react";
import type {
  ConflictInfo,
  Exam,
  ExamDraftInput,
  RevisionInput,
} from "../domain/types";
import {
  addExam,
  resetDb,
  reviseExam,
  loadDb,
  type Database,
} from "../data/storage";
import { patientTimelines, riskOfExam, summarizeAll, type EyeTimeline } from "../rules/timeline";

export interface Notice {
  type: "success" | "conflict" | "draft" | "info";
  text: string;
}

export function useFollowUp() {
  const [db, setDb] = useState<Database>(() => loadDb());
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const summaries = useMemo(() => summarizeAll(db.patients, db.exams), [db]);

  const timelinesByPatient = useMemo(() => {
    const map = new Map<string, Record<"OD" | "OS", EyeTimeline>>();
    for (const p of db.patients) {
      map.set(
        p.id,
        patientTimelines(db.exams.filter((e) => e.patientId === p.id))
      );
    }
    return map;
  }, [db]);

  const add = useCallback((input: ExamDraftInput) => {
    setConflict(null);
    const result = addExam(db, input);
    if ("conflict" in result) {
      setConflict(result.conflict);
      setNotice({
        type: "conflict",
        text: `保存失败：${result.conflict.patientId} ${result.conflict.date} ${
          result.conflict.eye === "OD" ? "右眼" : "左眼"
        } 已存在一条复查，请通过“修订”新建版本`,
      });
      return;
    }
    setDb(result.db);
    const savedRisk = riskOfExam(result.db.exams, result.exam);
    setNotice(
      savedRisk.status === "draft"
        ? {
            type: "draft",
            text: `已存为草稿：触发重点随访但缺少「${savedRisk.missingFields.join("、")}」，补全后自动转重点随访`,
          }
        : savedRisk.status === "focus"
          ? { type: "success", text: "已保存并转重点随访（户外时长与处置计划已登记）" }
          : { type: "info", text: "复查已保存，风险等级为常规随访" }
    );
  }, [db]);

  const revise = useCallback(
    (input: RevisionInput) => {
      const result = reviseExam(db, input);
      setDb(result.db);
      setConflict(null);
      setNotice({ type: "success", text: `已新建 v${result.exam.versions.length} 版本，旧值保留在版本链中` });
    },
    [db]
  );

  /** 冲突面板上选择“基于原值修订”后，由表单处理；此处仅清除提示 */
  const dismissConflict = useCallback(() => setConflict(null), []);

  const reset = useCallback(() => {
    setDb(resetDb());
    setConflict(null);
    setNotice({ type: "info", text: "已恢复示例数据" });
  }, []);

  const getExam = useCallback(
    (id: string): Exam | undefined => db.exams.find((e) => e.id === id),
    [db]
  );

  return {
    patients: db.patients,
    summaries,
    timelinesByPatient,
    conflict,
    notice,
    setNotice,
    add,
    revise,
    dismissConflict,
    reset,
    getExam,
  };
}
