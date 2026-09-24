// 数据层冒烟测试：zustand store 的领域动作 + localStorage 持久化/重开续接
import assert from "node:assert";

// ---- localStorage 桩（必须先于 store 模块加载）----
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

const { useScheduleStore } = await import("../src/store/scheduleStore");

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("✓", name); };
const S = () => useScheduleStore.getState();
const order = (id: string) => S().orders.find((o) => o.id === id)!;

// 种子：早班 shift-am(刘,保温箱) 已有 ord-1(07:30-08:30) / ord-2(09:00-10:00 冷链) / ord-7(已发车)
// 待分配：ord-3(13:00-14:00) ord-4(13:30-14:30) ord-5(19:00-20:00 冷链) ord-6(20:30-21:30)

t("重叠时段排班 → 硬受阻，留在待分配并登记", () => {
  // 新订单 07:45-08:15 与 ord-1 重叠
  S().addOrder({ no: "T-OVER", pickupStart: "07:45", pickupEnd: "08:15", weight: 50, durationMin: 20, coldChain: false, destination: "测试" });
  const id = S().orders.find((o) => o.no === "T-OVER")!.id;
  const r = S().assignOrder(id, "shift-am");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.bounced, true);
  assert.strictEqual(order(id).status, "pending");
  assert.strictEqual(order(id).shiftId, null);
  const blk = S().blocks.find((b) => b.orderId === id)!;
  assert.strictEqual(blk.hard, true);
  assert.ok(blk.violations.some((v) => v.type === "overlap" && v.withOrderNo === "ORD-9012"));
  assert.strictEqual(blk.driverName, "刘师傅");
  assert.strictEqual(blk.windowLabel, "07:45–08:15");
});

t("冷链订单交给无保温箱司机 → 硬受阻", () => {
  const r = S().assignOrder("ord-5", "shift-mid"); // 赵师傅无保温箱
  assert.strictEqual(r.ok, false);
  assert.ok(r.violations.some((v) => v.type === "coldChain"));
  assert.strictEqual(order("ord-5").status, "pending");
});

t("冷链订单交给保温箱司机 → 成功落位", () => {
  const r = S().assignOrder("ord-5", "shift-pm"); // 孙师傅有保温箱
  assert.strictEqual(r.ok, true);
  assert.strictEqual(order("ord-5").status, "scheduled");
  assert.strictEqual(order("ord-5").shiftId, "shift-pm");
});

t("总重超限 → 待放行（软受阻）", () => {
  // 中班容量 800kg：先放 480kg(ord-4)，再放 480kg 会超
  assert.strictEqual(S().assignOrder("ord-4", "shift-mid").ok, true);
  S().addOrder({ no: "T-HEAVY", pickupStart: "15:00", pickupEnd: "16:00", weight: 480, durationMin: 30, coldChain: false, destination: "测试" });
  const id = S().orders.find((o) => o.no === "T-HEAVY")!.id;
  const r = S().assignOrder(id, "shift-mid");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.held, true);
  assert.strictEqual(order(id).status, "hold");
  assert.strictEqual(order(id).shiftId, "shift-mid");
  const blk = S().blocks.find((b) => b.orderId === id)!;
  assert.strictEqual(blk.hard, false);
  assert.ok(blk.violations.some((v) => v.type === "overweight" && v.excessKg === 160));
});

t("放行后变为已排班，受阻记录核销", () => {
  const id = S().orders.find((o) => o.no === "T-HEAVY")!.id;
  S().releaseOrder(id);
  assert.strictEqual(order(id).status, "scheduled");
  assert.ok(S().blocks.filter((b) => b.orderId === id).every((b) => b.resolved));
});

t("撤回已排班订单回待分配", () => {
  S().returnToPool("ord-4");
  assert.strictEqual(order("ord-4").status, "pending");
  assert.strictEqual(order("ord-4").shiftId, null);
});

t("发车 → 已发车；已发车不能撤回", () => {
  S().depart("ord-1");
  assert.strictEqual(order("ord-1").status, "departed");
  S().returnToPool("ord-1");
  assert.strictEqual(order("ord-1").status, "departed");
});

t("交接下一班：记录原司机/原因/新司机，旧班容量当场释放", () => {
  const before = S().orders.filter((o) => o.shiftId === "shift-am" && o.status !== "pending")
    .reduce((s, o) => s + o.weight, 0);
  const r = S().handover("ord-7", "shift-mid", "车辆故障，改派中班");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(order("ord-7").shiftId, "shift-mid");
  const after = S().orders.filter((o) => o.shiftId === "shift-am" && o.status !== "pending")
    .reduce((s, o) => s + o.weight, 0);
  assert.strictEqual(before - after, 300); // ord-7 的 300kg 已释放
  const h = S().handovers[0];
  assert.strictEqual(h.orderNo, "ORD-9007");
  assert.strictEqual(h.fromDriverName, "刘师傅");
  assert.strictEqual(h.toDriverName, "赵师傅");
  assert.strictEqual(h.reason, "车辆故障，改派中班");
});

t("交接受阻（冷链→无保温箱）→ 留在原班并登记", () => {
  S().addOrder({ no: "T-COLD", pickupStart: "10:30", pickupEnd: "11:00", weight: 80, durationMin: 20, coldChain: true, destination: "测试" });
  const id = S().orders.find((o) => o.no === "T-COLD")!.id;
  assert.strictEqual(S().assignOrder(id, "shift-am").ok, true); // 刘师傅有保温箱
  S().depart(id);
  const r = S().handover(id, "shift-mid", "测试交接受阻");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(order(id).shiftId, "shift-am"); // 没动
  const blk = S().blocks.find((b) => b.orderId === id && b.action === "handover")!;
  assert.ok(blk);
  assert.strictEqual(blk.driverName, "赵师傅");
});

t("持久化：localStorage 中有完整状态，重开可续接", () => {
  const raw = mem.get("hxwlfront-14-schedule-v2");
  assert.ok(raw, "storage 应已写入");
  const parsed = JSON.parse(raw!);
  assert.ok(parsed.state.orders.length >= 8);
  assert.ok(parsed.state.blocks.length >= 3);
  assert.ok(parsed.state.handovers.length === 1);
  assert.strictEqual(parsed.version, 2);
});

console.log(`\n${passed} 项全部通过`);
