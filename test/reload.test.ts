// 模拟“页面重开”：localStorage 里已有上一会话的持久化数据，store 初始化后应原样续接
import assert from "node:assert";

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

// 上一会话留下的现场：一张待放行单、一条受阻、一条交接
const persisted = {
  state: {
    drivers: [{ id: "d1", name: "甲师傅", hasCooler: true }],
    shifts: [{ id: "s1", driverId: "d1", name: "早班", date: "2026-09-24", start: "06:00", end: "12:00", capacityKg: 1000, capacityMin: 300 }],
    orders: [
      { id: "o1", no: "ORD-OLD", pickupStart: "07:00", pickupEnd: "08:00", weight: 900, durationMin: 60, coldChain: false, destination: "旧址", status: "hold", shiftId: "s1", createdAt: "2026-09-24T01:00:00.000Z" },
    ],
    blocks: [
      { id: "b1", at: "2026-09-24T01:00:00.000Z", action: "assign", orderId: "o1", orderNo: "ORD-OLD", driverId: "d1", driverName: "甲师傅", shiftName: "2026-09-24 早班", windowLabel: "07:00–08:00", violations: [{ type: "overweight", excessKg: 0 }], hard: false, resolved: false },
    ],
    handovers: [
      { id: "h1", at: "2026-09-24T02:00:00.000Z", orderId: "o9", orderNo: "ORD-LEGACY", fromDriverId: "d1", fromDriverName: "甲师傅", fromShiftName: "早班", toDriverId: "d2", toDriverName: "乙师傅", toShiftName: "中班", reason: "车辆故障" },
    ],
  },
  version: 2,
};
mem.set("hxwlfront-14-schedule-v2", JSON.stringify(persisted));

const { useScheduleStore } = await import("../src/store/scheduleStore");
const S = useScheduleStore.getState();

assert.strictEqual(S.orders.length, 1);
assert.strictEqual(S.orders[0].no, "ORD-OLD");
assert.strictEqual(S.orders[0].status, "hold");
assert.strictEqual(S.blocks.length, 1);
assert.strictEqual(S.blocks[0].resolved, false);
assert.strictEqual(S.handovers.length, 1);
assert.strictEqual(S.handovers[0].reason, "车辆故障");

// 续接操作仍可用：放行上一会话留下的待放行单
useScheduleStore.getState().releaseOrder("o1");
assert.strictEqual(useScheduleStore.getState().orders[0].status, "scheduled");

console.log("✓ 页面重开后状态续接（待放行/受阻/交接记录完整，且可继续操作）");
