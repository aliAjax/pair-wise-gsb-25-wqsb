// 临时验证脚本：规则层关键场景（不进最终产物）
import { makeSeed } from "./src/data/seed";
import { addExam, latestVersion, reviseExam, findDoc, cloneData } from "./src/data/repository";
import type { ExamInput } from "./src/data/types";
import { buildOverview, buildPatientTimeline, previewEntry } from "./src/rules/timeline";
import { evaluateProgression } from "./src/rules/progression";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

// 1. 种子数据派生
const seed = makeSeed();
const ov = buildOverview(seed);
const tl32 = ov.timelines.find((t) => t.patient.id === "P-032")!;
const od32 = tl32.series.find((s) => s.eye === "OD")!;
const os32 = tl32.series.find((s) => s.eye === "OS")!;

console.log("种子数据：");
check("P-032 患儿风险 high", tl32.latestRisk === "high");
const od2 = od32.entries.find((e) => e.date === "2026-06-22")!;
check("P-032 OD 0622 半年眼轴速率 +0.35", od2.progression.axialRate6m === 0.35, `got ${od2.progression.axialRate6m}`);
check("P-032 OD 0622 SE速率 -0.50 不算越线", od2.progression.seRate6m === -0.5 && !od2.progression.seHit);
check("P-032 OD 0622 眼轴越线", od2.progression.axialHit && od2.progression.hit);
check("P-032 OD 0622 重点随访（资料齐）", od2.status === "focus");

const os1 = os32.entries.find((e) => e.date === "2025-12-20")!;
check("P-032 OS 基线是 v2 订正后的 -1.50", os1.metrics.se === -1.5, `got ${os1.metrics.se}`);
check("P-032 OS 基线版本号为 2", os1.versionCount === 2);
const os2 = os32.entries.find((e) => e.date === "2026-06-22")!;
check("P-032 OS 0622 半年SE -0.50（边界不越线）", os2.progression.seRate6m === -0.5 && !os2.progression.seHit);
check("P-032 OS 0622 眼轴 +0.26 越线→focus", os2.status === "focus", `got ${os2.status}`);

// 2. P-081：OD 观察带 routine；OS 越线但缺资料 → draft
const tl81 = ov.timelines.find((t) => t.patient.id === "P-081")!;
const od81 = tl81.series.find((s) => s.eye === "OD")!.entries.at(-1)!;
const os81 = tl81.series.find((s) => s.eye === "OS")!.entries.at(-1)!;
check("P-081 OD 半年眼轴+0.20 边界不越线（严格>）", !od81.progression.axialHit, `rate=${od81.progression.axialRate6m}`);
check("P-081 OD SE -0.25 进入观察带 watch", od81.risk === "watch", `risk=${od81.risk}`);
check("P-081 OD 常规随访", od81.status === "routine");
check("P-081 OS SE半年-0.75 越线", os81.progression.seHit);
check("P-081 OS 缺户外+计划 → 草稿", os81.status === "draft" && os81.missingFields.length === 2);

// 3. P-210 首诊无基线
const tl210 = ov.timelines.find((t) => t.patient.id === "P-210")!;
const first = tl210.series[0].entries[0];
check("P-210 首诊不可评价", !first.progression.evaluable);
check("P-210 首诊 routine", first.status === "routine");

// 4. 汇总指标
check("患儿数 4", ov.metrics.patientCount === 4);
check("记录数 12", ov.metrics.examCount === 12, `got ${ov.metrics.examCount}`);
check("高风险患儿 2（P-032/P-081）", ov.metrics.highRiskChildren === 2, `got ${ov.metrics.highRiskChildren}`);
check("草稿 1", ov.metrics.draftCount === 1, `got ${ov.metrics.draftCount}`);
check("重点 2（P-032 双眼）", ov.metrics.focusCount === 2, `got ${ov.metrics.focusCount}`);

// 5. 唯一键冲突
console.log("仓储：");
const dup: ExamInput = {
  patientId: "P-032", date: "2026-06-22", eye: "OD",
  metrics: { sphere: -9, cylinder: 0, axis: null, se: -9, axialLength: 99 },
  outdoorHours: 0, plan: "x", note: "", keepDraft: false,
};
const dupResult = addExam(seed, dup);
check("同日同眼重复录入被阻止，返回冲突原值", !!dupResult.conflict && dupResult.conflict!.id === "seed-032-od-2");
check("冲突原值仍是旧值 -2.25", latestVersion(dupResult.conflict!).metrics.se === -2.25);
check("数据未被写入", seed.exams.length === 12);

// 6. 修订必须带原因且保留旧值
const noReason = reviseExam(seed, "seed-032-od-2", dup);
check("无原因修订被拒绝", noReason === null);
const withReason = reviseExam(seed, "seed-032-od-2", { ...dup, reason: "仪器校准后复测" });
check("带原因修订成功", withReason !== null);
const revised = findDoc(withReason!, "P-032", "2026-06-22", "OD")!;
check("版本链追加为 2 版", revised.versions.length === 2);
check("旧值保留 v1 SE -2.25", revised.versions[0].metrics.se === -2.25);
check("当前值为新值 v2 SE -9", latestVersion(revised).metrics.se === -9);
check("新版本带原因", latestVersion(revised).reason === "仪器校准后复测");

// 7. 草稿不作为后续基线
console.log("基线规则：");
const draftCase: ExamInput = {
  patientId: "P-210", date: "2027-03-15", eye: "OD",
  metrics: { sphere: -2, cylinder: 0, axis: null, se: -2, axialLength: 23 },
  outdoorHours: null, plan: "", note: "", keepDraft: false, // 越线且资料缺 → 草稿
};
let d = cloneData(seed);
const r1 = addExam(d, draftCase);
check("草稿场景：越线缺资料存草稿", r1.conflict === null);
d = r1.data;
const t = buildPatientTimeline(d, d.patients.find((p) => p.id === "P-210")!);
const draftEntry = t.series[0].entries.find((e) => e.date === "2027-03-15")!;
check("2027-03 草稿 SE-2 相对基线越线", draftEntry.status === "draft" && draftEntry.progression.seHit);

// 在草稿之后再来一条常规复查：基线仍应是 2026-09 的首诊，而非草稿
const later: ExamInput = {
  patientId: "P-210", date: "2027-09-20", eye: "OD",
  metrics: { sphere: -1, cylinder: 0, axis: null, se: -1, axialLength: 22.6 },
  outdoorHours: 2, plan: "观察", note: "", keepDraft: false,
};
const r2 = addExam(d, later);
d = r2.data;
const t2 = buildPatientTimeline(d, d.patients.find((p) => p.id === "P-210")!);
const laterEntry = t2.series[0].entries.find((e) => e.date === "2027-09-20")!;
check("后续记录跳过草稿，基线为首诊 2026-09-10", laterEntry.progression.baselineDate === "2026-09-10", `got ${laterEntry.progression.baselineDate}`);

// 8. 30 天内不评价
const short = evaluateProgression("2026-10-01", { sphere: 0, cylinder: 0, axis: null, se: -2, axialLength: 24 }, {
  date: "2026-09-15", metrics: { sphere: 0, cylinder: 0, axis: null, se: 0, axialLength: 22 },
});
check("间隔<30天不可评价", !short.evaluable);

// 9. 预览
const prev = previewEntry(seed, {
  patientId: "P-210", date: "2027-03-15", eye: "OD",
  metrics: { sphere: -2, cylinder: 0, axis: null, se: -2, axialLength: 23 },
  outdoorHours: null, plan: "", keepDraft: false,
});
check("预览：越线缺资料 → draft", prev.entry.status === "draft");
const prevOk = previewEntry(seed, {
  patientId: "P-210", date: "2027-03-15", eye: "OD",
  metrics: { sphere: -2, cylinder: 0, axis: null, se: -2, axialLength: 23 },
  outdoorHours: 2, plan: "低浓度阿托品随访", keepDraft: false,
});
check("预览：补齐资料 → focus", prevOk.entry.status === "focus");
const prevManual = previewEntry(seed, {
  patientId: "P-210", date: "2027-03-15", eye: "OD",
  metrics: { sphere: -2, cylinder: 0, axis: null, se: -2, axialLength: 23 },
  outdoorHours: 2, plan: "低浓度阿托品随访", keepDraft: true,
});
check("预览：显式存草稿优先", prevManual.entry.status === "draft");

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
