// 数据层：zustand + localStorage 持久化。
// 只负责状态与领域动作；所有规则判断走 lib/validation，弹窗/提示等交互不在这里。

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  BlockRecord,
  Driver,
  HandoverRecord,
  Order,
  Shift,
  Violation,
} from "../types";
import { checkAssignment } from "../lib/validation";
import { today } from "../lib/time";

const date = today();

const seedDrivers: Driver[] = [
  { id: "drv-liu", name: "刘师傅", hasCooler: true },
  { id: "drv-zhao", name: "赵师傅", hasCooler: false },
  { id: "drv-sun", name: "孙师傅", hasCooler: true },
];

const seedShifts: Shift[] = [
  { id: "shift-am", driverId: "drv-liu", name: "早班", date, start: "06:00", end: "12:00", capacityKg: 1000, capacityMin: 300 },
  { id: "shift-mid", driverId: "drv-zhao", name: "中班", date, start: "12:00", end: "18:00", capacityKg: 800, capacityMin: 300 },
  { id: "shift-pm", driverId: "drv-sun", name: "晚班", date, start: "18:00", end: "24:00", capacityKg: 1000, capacityMin: 360 },
];

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000).toISOString();
}

const seedOrders: Order[] = [
  { id: "ord-1", no: "ORD-9012", pickupStart: "07:30", pickupEnd: "08:30", weight: 260, durationMin: 50, coldChain: false, destination: "浦东", status: "scheduled", shiftId: "shift-am", createdAt: hoursAgo(3) },
  { id: "ord-2", no: "ORD-9025", pickupStart: "09:00", pickupEnd: "10:00", weight: 320, durationMin: 60, coldChain: true, destination: "张江冷链仓", status: "scheduled", shiftId: "shift-am", createdAt: hoursAgo(2) },
  { id: "ord-3", no: "ORD-9031", pickupStart: "13:00", pickupEnd: "14:00", weight: 140, durationMin: 40, coldChain: false, destination: "嘉定", status: "pending", shiftId: null, createdAt: hoursAgo(2) },
  { id: "ord-4", no: "ORD-9044", pickupStart: "13:30", pickupEnd: "14:30", weight: 480, durationMin: 70, coldChain: false, destination: "虹桥", status: "pending", shiftId: null, createdAt: hoursAgo(1) },
  { id: "ord-5", no: "ORD-9058", pickupStart: "19:00", pickupEnd: "20:00", weight: 220, durationMin: 55, coldChain: true, destination: "徐汇冰鲜", status: "pending", shiftId: null, createdAt: hoursAgo(1) },
  { id: "ord-6", no: "ORD-9063", pickupStart: "20:30", pickupEnd: "21:30", weight: 390, durationMin: 65, coldChain: false, destination: "闵行", status: "pending", shiftId: null, createdAt: hoursAgo(0.5) },
  { id: "ord-7", no: "ORD-9007", pickupStart: "08:00", pickupEnd: "09:00", weight: 300, durationMin: 55, coldChain: false, destination: "陆家嘴", status: "departed", shiftId: "shift-am", createdAt: hoursAgo(4) },
];

export interface NewOrderInput {
  no: string;
  pickupStart: string;
  pickupEnd: string;
  weight: number;
  durationMin: number;
  coldChain: boolean;
  destination: string;
}

export interface AssignResult {
  ok: boolean;
  held: boolean;
  /** 硬冲突后是否落回了待分配池（原本就在班的订单保留原位） */
  bounced: boolean;
  violations: Violation[];
}

interface ScheduleState {
  drivers: Driver[];
  shifts: Shift[];
  orders: Order[];
  blocks: BlockRecord[];
  handovers: HandoverRecord[];

  addOrder: (input: NewOrderInput) => void;
  removeOrder: (id: string) => void;
  /** 把订单排到班次：硬约束退回待分配并记受阻；软约束进待放行；无冲突直接落位 */
  assignOrder: (orderId: string, shiftId: string) => AssignResult;
  /** 退回待分配池（含从待放行撤回） */
  returnToPool: (orderId: string) => void;
  /** 放行待放行订单（软约束由调度员确认） */
  releaseOrder: (orderId: string) => void;
  /** 发车 */
  depart: (orderId: string) => void;
  /** 已发车订单交接给下一班；受阻则不移动、只登记 */
  handover: (orderId: string, toShiftId: string, reason: string) => AssignResult;
  /** 核销一条受阻记录 */
  resolveBlock: (blockId: string) => void;
  resetAll: () => void;
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function initialState() {
  return {
    drivers: seedDrivers,
    shifts: seedShifts,
    orders: seedOrders,
    blocks: [] as BlockRecord[],
    handovers: [] as HandoverRecord[],
  };
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => {
      const ctx = () => {
        const { orders, shifts, drivers } = get();
        return { orders, shifts, drivers };
      };

      /** 核销该订单（可选：仅针对某班次）尚未处理的受阻记录——位置变化后旧受阻已失效 */
      const supersedeBlocks = (orderId: string, shiftId?: string): BlockRecord[] => {
        const shift = shiftId ? get().shifts.find((s) => s.id === shiftId) : undefined;
        return get().blocks.map((b) => {
          if (b.resolved || b.orderId !== orderId) return b;
          if (shift && b.driverId !== shift.driverId) return b;
          return { ...b, resolved: true };
        });
      };

      const makeBlock = (
        action: BlockRecord["action"],
        order: Order,
        shiftId: string,
        violations: Violation[]
      ): BlockRecord | null => {
        const shift = get().shifts.find((s) => s.id === shiftId);
        const driver = shift ? get().drivers.find((d) => d.id === shift.driverId) : undefined;
        if (!shift || !driver) return null;
        return {
          id: uid("blk"),
          at: new Date().toISOString(),
          action,
          orderId: order.id,
          orderNo: order.no,
          driverId: driver.id,
          driverName: driver.name,
          shiftName: `${shift.date} ${shift.name}`,
          windowLabel: `${order.pickupStart}–${order.pickupEnd}`,
          violations,
          hard: violations.some((v) => v.type === "coldChain" || v.type === "overlap"),
          resolved: false,
        };
      };

      const pushBlock = (
        blocks: BlockRecord[],
        action: BlockRecord["action"],
        order: Order,
        shiftId: string,
        violations: Violation[]
      ): BlockRecord[] => {
        const rec = makeBlock(action, order, shiftId, violations);
        return rec ? [rec, ...blocks] : blocks;
      };

      return {
        ...initialState(),

        addOrder: (input) => {
          const order: Order = {
            id: uid("ord"),
            status: "pending",
            shiftId: null,
            createdAt: new Date().toISOString(),
            ...input,
          };
          set({ orders: [order, ...get().orders] });
        },

        removeOrder: (id) => {
          set({
            orders: get().orders.filter((o) => o.id !== id),
            blocks: get().blocks.map((b) => (b.orderId === id ? { ...b, resolved: true } : b)),
          });
        },

        assignOrder: (orderId, shiftId) => {
          const order = get().orders.find((o) => o.id === orderId);
          if (!order) return { ok: false, held: false, bounced: false, violations: [] };

          const check = checkAssignment(order, shiftId, ctx());
          const blocks = supersedeBlocks(orderId, shiftId);

          if (check.hard) {
            // 硬约束：本就待分配的退回待分配；已在其他班的保留原位，只登记受阻
            const toPool = order.status === "pending";
            set({
              blocks: pushBlock(blocks, "assign", order, shiftId, check.violations),
              orders: toPool
                ? get().orders.map((o) =>
                    o.id === orderId ? { ...o, status: "pending", shiftId: null } : o
                  )
                : get().orders,
            });
            return { ok: false, held: false, bounced: toPool, violations: check.violations };
          }

          if (check.soft) {
            // 软约束：先挂到该班待放行，登记受阻
            set({
              blocks: pushBlock(blocks, "assign", order, shiftId, check.violations),
              orders: get().orders.map((o) =>
                o.id === orderId ? { ...o, status: "hold", shiftId } : o
              ),
            });
            return { ok: false, held: true, bounced: false, violations: check.violations };
          }

          set({
            blocks,
            orders: get().orders.map((o) =>
              o.id === orderId ? { ...o, status: "scheduled", shiftId } : o
            ),
          });
          return { ok: true, held: false, bounced: false, violations: [] };
        },

        returnToPool: (orderId) => {
          const order = get().orders.find((o) => o.id === orderId);
          if (!order || order.status === "departed") return;
          set({
            blocks: supersedeBlocks(orderId),
            orders: get().orders.map((o) =>
              o.id === orderId ? { ...o, status: "pending", shiftId: null } : o
            ),
          });
        },

        releaseOrder: (orderId) => {
          set({
            blocks: get().blocks.map((b) =>
              !b.resolved && b.orderId === orderId ? { ...b, resolved: true } : b
            ),
            orders: get().orders.map((o) =>
              o.id === orderId && o.status === "hold" ? { ...o, status: "scheduled" } : o
            ),
          });
        },

        depart: (orderId) => {
          set({
            orders: get().orders.map((o) =>
              o.id === orderId && o.status === "scheduled" ? { ...o, status: "departed" } : o
            ),
          });
        },

        handover: (orderId, toShiftId, reason) => {
          const order = get().orders.find((o) => o.id === orderId);
          if (!order || order.status !== "departed" || !order.shiftId) {
            return { ok: false, held: false, bounced: false, violations: [] };
          }
          const fromShift = get().shifts.find((s) => s.id === order.shiftId);
          const toShift = get().shifts.find((s) => s.id === toShiftId);
          if (!fromShift || !toShift || fromShift.id === toShift.id) {
            return { ok: false, held: false, bounced: false, violations: [] };
          }

          const check = checkAssignment(order, toShiftId, ctx());
          if (check.hard || check.soft) {
            // 受阻：订单留在原班，只登记受阻（含超重/超时长明细）
            set({ blocks: pushBlock(get().blocks, "handover", order, toShiftId, check.violations) });
            return { ok: false, held: check.soft, bounced: false, violations: check.violations };
          }

          const fromDriver = get().drivers.find((d) => d.id === fromShift.driverId);
          const toDriver = get().drivers.find((d) => d.id === toShift.driverId);
          if (!fromDriver || !toDriver) return { ok: false, held: false, bounced: false, violations: [] };

          const record: HandoverRecord = {
            id: uid("hand"),
            at: new Date().toISOString(),
            orderId: order.id,
            orderNo: order.no,
            fromDriverId: fromDriver.id,
            fromDriverName: fromDriver.name,
            fromShiftName: fromShift.name,
            toDriverId: toDriver.id,
            toDriverName: toDriver.name,
            toShiftName: toShift.name,
            reason,
          };
          set({
            handovers: [record, ...get().handovers],
            // 移到下一班即释放原班容量（重量/时长按 shiftId 实时汇总）
            orders: get().orders.map((o) =>
              o.id === orderId ? { ...o, shiftId: toShiftId } : o
            ),
          });
          return { ok: true, held: false, bounced: false, violations: [] };
        },

        resolveBlock: (blockId) => {
          set({ blocks: get().blocks.map((b) => (b.id === blockId ? { ...b, resolved: true } : b)) });
        },

        resetAll: () => set(initialState()),
      };
    },
    {
      name: "hxwlfront-14-schedule-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
