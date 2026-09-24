import { create } from "zustand";
import type { Driver, HandoverRecord, NewOrderInput, Order } from "../types";
import { evaluateAssignment, hasHardViolation } from "../domain/validation";
import { SEED_DRIVERS, SEED_HANDOVERS, SEED_ORDERS } from "./seed";

/**
 * 数据层：订单 / 司机 / 交接记录的唯一事实来源。
 * 持久化在 localStorage，页面重开后续接；校验全部委托 domain 纯函数。
 */
const STORAGE_KEY = "hxwlfront-14-shift-board-v2";

export type ToastKind = "success" | "error" | "info";
export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
}

interface PersistShape {
  orders: Order[];
  drivers: Driver[];
  handovers: HandoverRecord[];
}

interface ScheduleState extends PersistShape {
  toasts: Toast[];
  // 订单操作
  assignOrder: (orderId: string, driverId: string) => void;
  forceRelease: (orderId: string) => void;
  returnToPool: (orderId: string) => void;
  markDeparted: (orderId: string) => void;
  handover: (orderId: string, toDriverId: string, reason: string) => void;
  removeOrder: (orderId: string) => void;
  addOrder: (input: NewOrderInput) => void;
  resetDemo: () => void;
  // 提示条
  pushToast: (kind: ToastKind, text: string) => void;
  dismissToast: (id: string) => void;
}

function loadPersisted(): PersistShape {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw) as PersistShape;
      if (Array.isArray(data.orders) && Array.isArray(data.drivers)) {
        return { orders: data.orders, drivers: data.drivers, handovers: data.handovers ?? [] };
      }
    } catch {
      // 数据损坏时回落到演示数据
    }
  }
  return { orders: SEED_ORDERS, drivers: SEED_DRIVERS, handovers: SEED_HANDOVERS };
}

function persist(state: ScheduleState) {
  const payload: PersistShape = { orders: state.orders, drivers: state.drivers, handovers: state.handovers };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

const initial = loadPersisted();

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export const useScheduleStore = create<ScheduleState>((set, get) => {
  const commit = (patch: Partial<ScheduleState>) => {
    set(patch);
    persist({ ...get(), ...patch });
  };

  const pushToast = (kind: ToastKind, text: string) => {
    const toast: Toast = { id: makeId("t"), kind, text };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    window.setTimeout(() => get().dismissToast(toast.id), 5200);
  };

  return {
    ...initial,
    toasts: [],

    pushToast,
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    /** 拖到司机班次：校验通过即排上；硬冲突进待放行；软冲突也先进待放行，可强制放行。 */
    assignOrder: (orderId, driverId) => {
      const { orders, drivers } = get();
      const order = orders.find((o) => o.id === orderId);
      const driver = drivers.find((d) => d.id === driverId);
      if (!order || !driver) return;

      const violations = evaluateAssignment(order, driver, orders);
      if (violations.length === 0) {
        const next = orders.map((o) =>
          o.id === orderId
            ? { ...o, status: "assigned" as const, driverId, originDriverId: o.originDriverId ?? driverId, targetDriverId: null, violations: [] }
            : o
        );
        commit({ orders: next });
        pushToast("success", `${order.orderNo} 已排入 ${driver.name} 的班次`);
      } else {
        const next = orders.map((o) =>
          o.id === orderId
            ? { ...o, status: "blocked" as const, driverId: null, targetDriverId: driverId, violations }
            : o
        );
        commit({ orders: next });
        pushToast(hasHardViolation(violations) ? "error" : "info", `${order.orderNo} 受阻，已进入待放行`);
      }
    },

    /** 待放行单强制放行（仅限软冲突：超重 / 超时；存在硬冲突时拒绝）。 */
    forceRelease: (orderId) => {
      const { orders, drivers } = get();
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.status !== "blocked" || !order.targetDriverId) return;
      const driver = drivers.find((d) => d.id === order.targetDriverId);
      if (!driver) return;

      // 放行前重新评估：放行期间容量可能已变化
      const violations = evaluateAssignment(order, driver, orders);
      if (hasHardViolation(violations)) {
        commit({ orders: orders.map((o) => (o.id === orderId ? { ...o, violations } : o)) });
        pushToast("error", `${order.orderNo} 存在时段/冷链硬冲突，不能放行`);
        return;
      }
      const next = orders.map((o) =>
        o.id === orderId
          ? { ...o, status: "assigned" as const, driverId: driver.id, originDriverId: o.originDriverId ?? driver.id, targetDriverId: null, violations }
          : o
      );
      commit({ orders: next });
      pushToast(violations.length ? "info" : "success", violations.length ? `${order.orderNo} 已强制放行至 ${driver.name}（仍有超重/超时）` : `${order.orderNo} 已放行至 ${driver.name}`);
    },

    returnToPool: (orderId) => {
      commit({
        orders: get().orders.map((o) =>
          o.id === orderId ? { ...o, status: "unassigned" as const, driverId: null, targetDriverId: null, violations: [] } : o
        )
      });
    },

    markDeparted: (orderId) => {
      const { orders } = get();
      const next = orders.map((o) => (o.id === orderId && o.status === "assigned" ? { ...o, status: "departed" as const } : o));
      commit({ orders: next });
      const order = orders.find((o) => o.id === orderId);
      pushToast("success", `${order?.orderNo ?? "订单"} 已发车`);
    },

    /**
     * 已发车订单交接下一班：原司机容量当场释放，新司机承担本单；
     * 留下原司机、原因、新司机记录。硬冲突阻止交接。
     */
    handover: (orderId, toDriverId, reason) => {
      const { orders, drivers, handovers } = get();
      const order = orders.find((o) => o.id === orderId);
      const toDriver = drivers.find((d) => d.id === toDriverId);
      if (!order || !toDriver || !reason.trim()) return;

      const fromDriverId = order.driverId;
      if (!fromDriverId) return;
      if (fromDriverId === toDriverId) {
        pushToast("info", "新司机与原司机相同，无需交接");
        return;
      }

      const violations = evaluateAssignment(order, toDriver, orders);
      if (hasHardViolation(violations)) {
        pushToast("error", `无法交接：${violations.map((v) => v.message).join("；")}`);
        return;
      }

      const record: HandoverRecord = {
        id: makeId("h"),
        orderId,
        orderNo: order.orderNo,
        fromDriverId,
        toDriverId,
        reason: reason.trim(),
        at: new Date().toISOString()
      };
      // 旧容量当场释放：driverId 直接切到新司机（仍保持 departed，计入新司机负载）
      const next = orders.map((o) =>
        o.id === orderId ? { ...o, driverId: toDriverId, violations } : o
      );
      commit({ orders: next, handovers: [record, ...handovers] });
      pushToast("success", `${order.orderNo} 已由 ${drivers.find((d) => d.id === fromDriverId)?.name} 交接给 ${toDriver.name}`);
    },

    removeOrder: (orderId) => {
      commit({ orders: get().orders.filter((o) => o.id !== orderId) });
    },

    addOrder: (input) => {
      const order: Order = {
        id: makeId("o"),
        ...input,
        status: "unassigned",
        driverId: null,
        originDriverId: null,
        targetDriverId: null,
        violations: [],
        createdAt: new Date().toISOString()
      };
      commit({ orders: [order, ...get().orders] });
      pushToast("success", `${input.orderNo} 已加入待分配`);
    },

    resetDemo: () => {
      commit({ orders: SEED_ORDERS, drivers: SEED_DRIVERS, handovers: SEED_HANDOVERS });
      pushToast("info", "已恢复演示数据");
    }
  };
});
