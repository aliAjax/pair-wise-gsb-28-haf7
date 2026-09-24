// 纯逻辑冒烟测试：校验规则（不依赖 React/DOM/localStorage）
import assert from "node:assert";
import { checkAssignment, shiftUsage } from "../src/lib/validation";
import type { Driver, Order, Shift } from "../src/types";

const drivers: Driver[] = [
  { id: "d-cool", name: "保温箱司机", hasCooler: true },
  { id: "d-nocool", name: "普通司机", hasCooler: false },
];

const shifts: Shift[] = [
  { id: "s1", driverId: "d-cool", name: "早班", date: "2026-09-24", start: "06:00", end: "12:00", capacityKg: 1000, capacityMin: 300 },
  { id: "s2", driverId: "d-nocool", name: "中班", date: "2026-09-24", start: "12:00", end: "18:00", capacityKg: 500, capacityMin: 120 },
];

const o = (p: Partial<Order>): Order => ({
  id: "x", no: "X", pickupStart: "08:00", pickupEnd: "09:00",
  weight: 100, durationMin: 30, coldChain: false, destination: "",
  status: "scheduled", shiftId: "s1", createdAt: "", ...p,
});

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("✓", name); };

t("无冲突可排班", () => {
  const moving = o({ id: "m", shiftId: null, status: "pending" });
  const ctx = { orders: [moving], shifts, drivers };
  const r = checkAssignment(moving, "s1", ctx);
  assert.strictEqual(r.hard, false);
  assert.strictEqual(r.soft, false);
});

t("冷链订单不能交给无保温箱司机（硬）", () => {
  const moving = o({ id: "m", shiftId: null, status: "pending", coldChain: true });
  const ctx = { orders: [moving], shifts, drivers };
  const r = checkAssignment(moving, "s2", ctx);
  assert.strictEqual(r.hard, true);
  assert.ok(r.violations.some((v) => v.type === "coldChain"));
});

t("冷链订单可交给保温箱司机", () => {
  const moving = o({ id: "m", shiftId: null, status: "pending", coldChain: true });
  const ctx = { orders: [moving], shifts, drivers };
  const r = checkAssignment(moving, "s1", ctx);
  assert.strictEqual(r.hard, false);
});

t("取货时段重叠为硬冲突，并指出冲突订单", () => {
  const peer = o({ id: "p", no: "ORD-P", pickupStart: "08:30", pickupEnd: "09:30" });
  const moving = o({ id: "m", no: "ORD-M", shiftId: null, status: "pending", pickupStart: "08:00", pickupEnd: "09:00" });
  const ctx = { orders: [peer, moving], shifts, drivers };
  const r = checkAssignment(moving, "s1", ctx);
  assert.strictEqual(r.hard, true);
  const overlap = r.violations.find((v) => v.type === "overlap");
  assert.ok(overlap);
  assert.strictEqual(overlap!.withOrderNo, "ORD-P");
});

t("端点相接（09:00=09:00）不算重叠", () => {
  const peer = o({ id: "p", pickupStart: "09:00", pickupEnd: "10:00" });
  const moving = o({ id: "m", shiftId: null, status: "pending", pickupStart: "08:00", pickupEnd: "09:00" });
  const ctx = { orders: [peer, moving], shifts, drivers };
  const r = checkAssignment(moving, "s1", ctx);
  assert.strictEqual(r.violations.some((v) => v.type === "overlap"), false);
});

t("拖回自己所在班次不会与自己冲突", () => {
  const moving = o({ id: "m", pickupStart: "08:00", pickupEnd: "09:00" });
  const ctx = { orders: [moving], shifts, drivers };
  const r = checkAssignment(moving, "s1", ctx);
  assert.strictEqual(r.violations.length, 0);
});

t("总重超限为软冲突（可放行），给出超重值", () => {
  const peer = o({ id: "p", shiftId: "s2", weight: 450, durationMin: 30, pickupStart: "13:00", pickupEnd: "13:30" });
  const moving = o({ id: "m", shiftId: null, status: "pending", weight: 100, durationMin: 30, pickupStart: "14:00", pickupEnd: "14:30" });
  const ctx = { orders: [peer, moving], shifts, drivers };
  const r = checkAssignment(moving, "s2", ctx);
  assert.strictEqual(r.hard, false);
  assert.strictEqual(r.soft, true);
  const ow = r.violations.find((v) => v.type === "overweight");
  assert.strictEqual(ow!.excessKg, 50);
});

t("总时长超限为软冲突，给出超出分钟", () => {
  const peer = o({ id: "p", shiftId: "s2", durationMin: 100, pickupStart: "13:00", pickupEnd: "13:30" });
  const moving = o({ id: "m", shiftId: null, status: "pending", durationMin: 40, pickupStart: "14:00", pickupEnd: "14:30" });
  const ctx = { orders: [peer, moving], shifts, drivers };
  const r = checkAssignment(moving, "s2", ctx);
  const ot = r.violations.find((v) => v.type === "overtime");
  assert.ok(ot);
  assert.strictEqual(ot!.excessMin, 20);
});

t("容量按班次实时汇总（移走即释放）", () => {
  const a = o({ id: "a", weight: 300, durationMin: 60, shiftId: "s2", pickupStart: "13:00", pickupEnd: "13:30" });
  const b = o({ id: "b", weight: 100, durationMin: 30, shiftId: "s1", pickupStart: "07:00", pickupEnd: "07:30" });
  assert.deepStrictEqual(shiftUsage("s2", [a, b]), { weight: 300, duration: 60, count: 1 });
  // 交接：a 移到 s1
  const moved = { ...a, shiftId: "s1" };
  assert.deepStrictEqual(shiftUsage("s2", [moved, b]), { weight: 0, duration: 0, count: 0 });
});

console.log(`\n${passed} 项全部通过`);
