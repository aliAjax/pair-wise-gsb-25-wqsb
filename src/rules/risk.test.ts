import { describe, expect, it } from "vitest";
import { sphericalEquivalent, formatDiopter } from "./optics";
import {
  AXIAL_THRESHOLD_MM,
  SE_THRESHOLD_D,
  evaluateExam,
  isFastProgression,
  missingCareFields,
  progressionOf,
} from "./risk";
import type { Exam } from "../domain/types";

function exam(partial: Partial<Exam> & Pick<Exam, "id" | "patientId" | "date" | "eye">): Exam {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    sphere: 0,
    cylinder: 0,
    axialLength: 23,
    versions: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("等效球镜", () => {
  it("SE = 球镜 + 1/2 柱镜", () => {
    expect(sphericalEquivalent({ sphere: -2, cylinder: -1 })).toBe(-2.5);
    expect(sphericalEquivalent({ sphere: -1.25, cylinder: -0.5 })).toBe(-1.5);
  });

  it("格式化带正负号", () => {
    expect(formatDiopter(-2.75)).toBe("-2.75D");
    expect(formatDiopter(0.5)).toBe("+0.50D");
  });
});

describe("半年化进展", () => {
  const prev = exam({
    id: "e1",
    patientId: "P1",
    date: "2026-03-18",
    eye: "OD",
    sphere: -1.25,
    cylinder: -0.5,
    axialLength: 23.65,
  });

  it("约半年间隔直接按比例换算", () => {
    const cur = exam({
      id: "e2",
      patientId: "P1",
      date: "2026-09-15",
      eye: "OD",
      sphere: -2.0,
      cylinder: -0.5,
      axialLength: 23.95,
    });
    const delta = progressionOf(cur, prev)!;
    expect(delta.days).toBe(181);
    // +0.30mm / 181 天 × 182.625 天 ≈ +0.30mm
    expect(delta.axialPerHalfYear).toBeCloseTo(0.303, 2);
    expect(isFastProgression(delta).axial).toBe(true);
  });

  it("短间隔（3 个月）实测 0.30mm 半年当量翻倍越限", () => {
    const p = exam({ id: "a", patientId: "P", date: "2026-06-20", eye: "OD", axialLength: 22.4, sphere: 0.5 });
    const c = exam({ id: "b", patientId: "P", date: "2026-09-18", eye: "OD", axialLength: 22.7, sphere: 0.25 });
    const delta = progressionOf(c, p)!;
    expect(delta.days).toBe(90);
    expect(delta.axialPerHalfYear).toBeCloseTo(0.609, 2);
    expect(delta.axialPerHalfYear > AXIAL_THRESHOLD_MM).toBe(true);
  });

  it("平稳进展不越限", () => {
    const p = exam({ id: "a", patientId: "P", date: "2025-09-20", eye: "OD", axialLength: 24.1, sphere: -0.75, cylinder: -0.25 });
    const c = exam({ id: "b", patientId: "P", date: "2026-09-16", eye: "OD", axialLength: 24.26, sphere: -1.0, cylinder: -0.25 });
    const delta = progressionOf(c, p)!;
    expect(delta.axialPerHalfYear).toBeLessThanOrEqual(AXIAL_THRESHOLD_MM);
    expect(-delta.sePerHalfYear).toBeLessThanOrEqual(SE_THRESHOLD_D);
    expect(evaluateExam(c, p).status).toBe("normal");
  });

  it("阈值严格大于：恰好 0.20mm / 0.50D 不算越限", () => {
    const p = exam({ id: "a", patientId: "P", date: "2026-01-01", eye: "OD", axialLength: 23, sphere: 0 });
    const c = exam({ id: "b", patientId: "P", date: "2026-07-02", eye: "OD", axialLength: 23.2, sphere: -0.5 });
    const delta = progressionOf(c, p)!;
    // 182 天，半年当量几乎恰好为实测值
    expect(delta.axialPerHalfYear).toBeGreaterThan(0.199);
    expect(isFastProgression(delta).axial).toBe(false);
    expect(isFastProgression(delta).se).toBe(false);
  });
});

describe("随访等级", () => {
  const prev = exam({
    id: "e1", patientId: "P1", date: "2026-03-18", eye: "OD",
    sphere: -1.25, cylinder: -0.5, axialLength: 23.65,
  });

  it("越限且填全户外与处置 → 重点随访", () => {
    const cur = exam({
      id: "e2", patientId: "P1", date: "2026-09-15", eye: "OD",
      sphere: -2, cylinder: -0.5, axialLength: 23.95,
      outdoorHours: 1.5, plan: "阿托品 + 离焦镜",
    });
    expect(evaluateExam(cur, prev).status).toBe("focus");
  });

  it("越限但缺户外时长和处置计划 → 草稿", () => {
    const cur = exam({
      id: "e2", patientId: "P1", date: "2026-09-15", eye: "OD",
      sphere: -2, cylinder: -0.5, axialLength: 23.95,
    });
    const risk = evaluateExam(cur, prev);
    expect(risk.status).toBe("draft");
    expect(risk.missingFields).toEqual(["户外时长", "处置计划"]);
  });

  it("越限只补了户外时长，缺处置计划仍是草稿", () => {
    const cur = exam({
      id: "e2", patientId: "P1", date: "2026-09-15", eye: "OD",
      sphere: -2, cylinder: -0.5, axialLength: 23.95, outdoorHours: 2,
    });
    expect(missingCareFields(cur)).toEqual(["处置计划"]);
    expect(evaluateExam(cur, prev).status).toBe("draft");
  });

  it("首条基线复查 → 常规随访", () => {
    expect(evaluateExam(prev, undefined).status).toBe("normal");
  });
});
