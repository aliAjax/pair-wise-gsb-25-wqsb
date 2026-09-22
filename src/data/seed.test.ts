import { describe, expect, it, beforeEach } from "vitest";
import { seedDb } from "./seed";
import { patientTimelines, summarizeAll } from "../rules/timeline";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
    new MemoryStorage();
});

describe("示例数据端到端派生（模拟刷新后重算）", () => {
  it("各患者风险等级与业务预期一致", () => {
    const db = seedDb();
    const summaries = summarizeAll(db.patients, db.exams);
    const byName = Object.fromEntries(summaries.map((s) => [s.patient.name, s.status]));
    expect(byName).toEqual({
      李小宇: "focus", // 半年眼轴/SE 越限且已填处置
      王芷晴: "normal", // 进展平稳（含勘误版本链）
      张乐乐: "draft", // 越限但未填户外/处置
      陈一一: "normal", // 仅基线
    });
  });

  it("张乐乐双眼最新一条都是草稿，且都缺户外时长与处置计划", () => {
    const db = seedDb();
    const exams = db.exams.filter((e) => e.patientId === "P03");
    const tls = patientTimelines(exams);
    (["OD", "OS"] as const).forEach((eye) => {
      const last = tls[eye].entries[tls[eye].entries.length - 1];
      expect(last.risk.status).toBe("draft");
      expect(last.risk.missingFields).toEqual(["户外时长", "处置计划"]);
    });
  });

  it("李小宇双眼最新一条都是重点随访并已填处置", () => {
    const db = seedDb();
    const exams = db.exams.filter((e) => e.patientId === "P01");
    const tls = patientTimelines(exams);
    (["OD", "OS"] as const).forEach((eye) => {
      const last = tls[eye].entries[tls[eye].entries.length - 1];
      expect(last.risk.status).toBe("focus");
      expect(last.exam.outdoorHours).toBe(1.5);
      expect(last.exam.plan).toContain("阿托品");
    });
  });

  it("重复派生结果稳定（幂等），无副作用", () => {
    const db = seedDb();
    const first = JSON.stringify(summarizeAll(db.patients, db.exams));
    const second = JSON.stringify(summarizeAll(db.patients, db.exams));
    expect(first).toBe(second);
  });
});
