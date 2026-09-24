// 校验层（纯函数）：给定当前排班状态，计算把某订单放入某班次的全部违规项。
// 与数据存储、React/拖拽交互完全无关，可单独单测。

import type { Driver, Order, Shift, Violation } from "../types";
import { overlaps } from "./time";

export interface AssignmentContext {
  orders: Order[];
  shifts: Shift[];
  drivers: Driver[];
}

export interface AssignmentCheck {
  violations: Violation[];
  hard: boolean; // 存在硬约束（冷链 / 重叠），不可直接落位
  soft: boolean; // 仅有软约束（超重 / 超时），可待放行
}

/**
 * 校验 order 放入 shiftId（忽略订单自身在该班次中的旧位置，
 * 这样拖回原班次/原司机也不会和自己冲突）。
 */
export function checkAssignment(
  order: Order,
  shiftId: string,
  ctx: AssignmentContext
): AssignmentCheck {
  const shift = ctx.shifts.find((s) => s.id === shiftId);
  const driver = shift ? ctx.drivers.find((d) => d.id === shift.driverId) : undefined;
  const violations: Violation[] = [];

  if (!shift || !driver) {
    return { violations, hard: true, soft: false };
  }

  // 1. 硬约束：冷链订单只能由有保温箱的司机承接
  if (order.coldChain && !driver.hasCooler) {
    violations.push({ type: "coldChain" });
  }

  // 该班次上除自己以外的已排/已发车订单
  const peers = ctx.orders.filter(
    (o) =>
      o.shiftId === shiftId &&
      o.id !== order.id &&
      (o.status === "scheduled" || o.status === "departed" || o.status === "hold")
  );

  // 2. 硬约束：取货时段重叠，同一班次只能接一单
  for (const peer of peers) {
    if (overlaps(order.pickupStart, order.pickupEnd, peer.pickupStart, peer.pickupEnd)) {
      violations.push({ type: "overlap", withOrderNo: peer.no });
    }
  }

  // 3. 软约束：单班总重
  const usedWeight = peers.reduce((sum, o) => sum + o.weight, 0);
  const totalWeight = usedWeight + order.weight;
  if (totalWeight > shift.capacityKg) {
    violations.push({ type: "overweight", excessKg: totalWeight - shift.capacityKg });
  }

  // 4. 软约束：单班总时长
  const usedDuration = peers.reduce((sum, o) => sum + o.durationMin, 0);
  const totalDuration = usedDuration + order.durationMin;
  if (totalDuration > shift.capacityMin) {
    violations.push({ type: "overtime", excessMin: totalDuration - shift.capacityMin });
  }

  const hard = violations.some((v) => v.type === "coldChain" || v.type === "overlap");
  const soft = !hard && violations.length > 0;
  return { violations, hard, soft };
}

/** 班次当前已占用容量（含在该班受阻的订单，便于看板显示真实压力） */
export function shiftUsage(shiftId: string, orders: Order[]) {
  const mine = orders.filter(
    (o) => o.shiftId === shiftId && o.status !== "pending"
  );
  return {
    weight: mine.reduce((s, o) => s + o.weight, 0),
    duration: mine.reduce((s, o) => s + o.durationMin, 0),
    count: mine.length,
  };
}
