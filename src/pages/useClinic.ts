// 页面层：状态编排。组合数据层（仓储/持久化）与规则层（派生），不直接写业务规则。
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClinicData, ExamDoc, ExamInput, Patient } from "../data/types";
import {
  addExam,
  addPatient,
  cloneData,
  loadData,
  reviseExam,
  saveData,
} from "../data/repository";
import { makeSeed } from "../data/seed";
import { buildOverview } from "../rules/timeline";

export type FormMode =
  | { kind: "create" }
  | { kind: "revise"; docId: string };

export interface NewPatientFields {
  name: string;
  gender?: Patient["gender"];
  birthDate?: string;
}

let seedCache: ClinicData | null = null;
function seed(): ClinicData {
  if (!seedCache) seedCache = makeSeed();
  return cloneData(seedCache);
}

export function useClinic() {
  const [data, setData] = useState<ClinicData>(() => loadData(seed()));
  const [selectedId, setSelectedId] = useState<string>(
    () => loadData(seed()).patients[0]?.id ?? ""
  );
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [conflict, setConflict] = useState<ExamDoc | null>(null);

  // 刷新一致：所有派生量都从持久化数据重算
  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (!data.patients.some((p) => p.id === selectedId)) {
      setSelectedId(data.patients[0]?.id ?? "");
    }
  }, [data.patients, selectedId]);

  const derived = useMemo(() => buildOverview(data), [data]);
  const selected =
    derived.timelines.find((t) => t.patient.id === selectedId) ?? null;

  const openCreate = useCallback(() => {
    setConflict(null);
    setFormMode({ kind: "create" });
  }, []);

  const openRevise = useCallback((docId: string) => {
    setConflict(null);
    setFormMode({ kind: "revise", docId });
  }, []);

  const closeForm = useCallback(() => setFormMode(null), []);

  const submitCreate = useCallback((input: ExamInput): ExamDoc | null => {
    const result = addExam(data, input);
    if (result.conflict) {
      setConflict(result.conflict);
      return result.conflict;
    }
    setData(result.data);
    return null;
  }, [data]);

  const submitRevise = useCallback(
    (docId: string, input: ExamInput): boolean => {
      const next = reviseExam(data, docId, input);
      if (!next) return false;
      setData(next);
      setFormMode(null);
      return true;
    },
    [data]
  );

  const dismissConflict = useCallback(() => setConflict(null), []);

  const resolveConflictAsRevise = useCallback(() => {
    if (conflict) setFormMode({ kind: "revise", docId: conflict.id });
    setConflict(null);
  }, [conflict]);

  const createPatient = useCallback(
    (fields: NewPatientFields): Patient => {
      const result = addPatient(data, fields);
      setData(result.data);
      setSelectedId(result.patient.id);
      return result.patient;
    },
    [data]
  );

  const resetDemo = useCallback(() => {
    setData(seed());
    setFormMode(null);
    setConflict(null);
  }, []);

  return {
    data,
    metrics: derived.metrics,
    timelines: derived.timelines,
    selected,
    selectedId,
    setSelectedId,
    formMode,
    openCreate,
    openRevise,
    closeForm,
    submitCreate,
    submitRevise,
    conflict,
    dismissConflict,
    resolveConflictAsRevise,
    createPatient,
    resetDemo,
  };
}

export type ClinicApi = ReturnType<typeof useClinic>;
