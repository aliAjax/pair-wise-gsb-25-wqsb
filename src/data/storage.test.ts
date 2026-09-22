import { describe, expect, it, beforeEach } from "vitest";
import {
  addExam,
  examKey,
  reviseExam,
  uniqueKey,
  type Database,
} from "./storage";
import { seedDb } from "./seed";

// localStorage 内存桩，使数据层在 node 环境可测
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

describe("唯一键", () => {
  it("键 = 患者|日期|眼别", () => {
    expect(uniqueKey("P01", "2026-09-15", "OD")).toBe("P01|2026-09-15|OD");
  });

  it("同日同眼第二次保存返回冲突且不写入，冲突带原值", () => {
    const db = seedDb();
    const before = db.exams.length;
    const result = addExam(db, {
      patientId: "P01",
      date: "2026-09-15",
      eye: "OD",
      sphere: -3,
      cylinder: 0,
      axialLength: 24.5,
    });
    expect("conflict" in result).toBe(true);
    if ("conflict" in result) {
      expect(result.conflict.patientName).toBe("李小宇");
      expect(result.conflict.date).toBe("2026-09-15");
      expect(result.conflict.eye).toBe("OD");
      // 原值
      expect(result.conflict.existing.sphere).toBe(-2);
      expect(result.conflict.existing.axialLength).toBe(23.95);
      expect(examKey(result.conflict.existing)).toBe("P01|2026-09-15|OD");
    }
    expect(db.exams.length).toBe(before);
  });

  it("同患者不同眼别可以各存一条", () => {
    const db0 = seedDb();
    const r1 = addExam(db0, {
      patientId: "P04", date: "2026-09-22", eye: "OD",
      sphere: 0.5, cylinder: 0, axialLength: 22.2,
    });
    expect("exam" in r1).toBe(true);
    const r2 = addExam(r1.db, {
      patientId: "P04", date: "2026-09-22", eye: "OS",
      sphere: 0.5, cylinder: 0, axialLength: 22.15,
    });
    expect("exam" in r2).toBe(true);
  });
});

describe("修订版本链", () => {
  it("修订追加带原因的新版本，旧值保留", () => {
    const db: Database = seedDb();
    const target = db.exams.find((e) => e.id === "seed-7")!;
    expect(target.versions.length).toBe(2); // 示例自带一次勘误
    const oldSphere = target.sphere;

    const result = reviseExam(db, {
      examId: target.id,
      reason: "设备校准偏差，核回眼轴",
      values: { axialLength: 24.21 },
    });
    const revised = result.db.exams.find((e) => e.id === target.id)!;
    expect(revised.versions.length).toBe(3);
    expect(revised.axialLength).toBe(24.21);
    expect(revised.sphere).toBe(oldSphere);
    const v1 = revised.versions[0];
    const v3 = revised.versions[2];
    expect(v1.axialLength).toBe(24.26); // 旧值仍在 v1
    expect(v1.reason).toBe("初次录入");
    expect(v3.reason).toBe("设备校准偏差，核回眼轴");
    expect(v3.axialLength).toBe(24.21);
  });

  it("修订不存在的记录抛错", () => {
    expect(() =>
      reviseExam(seedDb(), { examId: "nope", reason: "x", values: {} })
    ).toThrow();
  });
});
