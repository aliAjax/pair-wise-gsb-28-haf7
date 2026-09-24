import type { Driver, Order, Violation } from "../types";
import { windowsOverlap } from "./shifts";

/**
 * 排班校验（纯函数层，不依赖 React / localStorage）。
 * 规则：
 *  - overlap  同一司机班次内，取货时段重叠只能接一单（硬约束）
 *  - cooler   冷链订单必须交给配备保温箱的司机（硬约束）
 *  - weight   单班总重超出容量（软约束，可由调度“强制放行”）
 *  - duration 单班总作业时长超上限（软约束，可由调度“强制放行”）
 */
export const HARD_VIOLATIONS = ["overlap", "cooler"] as const;

export function isHard(v: Violation): boolean {
  return (HARD_VIOLATIONS as readonly string[]).includes(v.type);
}

export interface DriverLoad {
  weightKg: number;
  totalMinutes: number;
  count: number;
}

/** 占用司机班次容量的订单：已排班 + 已发车；受阻单不占用，交接后旧容量当场释放。 */
export function driverLoad(driverId: string, orders: Order[]): DriverLoad {
  return orders
    .filter((o) => o.driverId === driverId && (o.status === "assigned" || o.status === "departed"))
    .reduce<DriverLoad>(
      (acc, o) => ({
        weightKg: acc.weightKg + o.weightKg,
        totalMinutes: acc.totalMinutes + o.serviceMinutes,
        count: acc.count + 1
      }),
      { weightKg: 0, totalMinutes: 0, count: 0 }
    );
}

/** 评估把 order 交给 driver 时的全部冲突。excludeId 用于把“自身”排除（重新评估场景）。 */
export function evaluateAssignment(
  order: Pick<Order, "id" | "weightKg" | "serviceMinutes" | "coldChain" | "pickupStart" | "pickupEnd">,
  driver: Driver,
  orders: Order[],
  excludeId?: string
): Violation[] {
  const violations: Violation[] = [];

  // 1. 保温箱硬条件
  if (order.coldChain && !driver.hasCooler) {
    violations.push({ type: "cooler", message: `${driver.name}无保温箱，不能承接冷链订单` });
  }

  // 2. 取货时段重叠（同一司机班次内只能接一单）
  const conflict = orders.find(
    (o) =>
      o.id !== excludeId &&
      o.id !== order.id &&
      o.driverId === driver.id &&
      (o.status === "assigned" || o.status === "departed") &&
      windowsOverlap(o.pickupStart, o.pickupEnd, order.pickupStart, order.pickupEnd, driver.shift)
  );
  if (conflict) {
    violations.push({
      type: "overlap",
      conflictOrderId: conflict.id,
      message: `取货时段与 ${conflict.orderNo}（${conflict.pickupStart}–${conflict.pickupEnd}）重叠`
    });
  }

  const load = driverLoad(driver.id, orders.filter((o) => o.id !== order.id));
  const nextWeight = load.weightKg + order.weightKg;
  const nextMinutes = load.totalMinutes + order.serviceMinutes;

  // 3. 单班总重
  if (nextWeight > driver.capacityKg) {
    violations.push({
      type: "weight",
      overloadKg: nextWeight - driver.capacityKg,
      message: `单班总重 ${nextWeight}kg，超出容量 ${driver.capacityKg}kg，超重 ${nextWeight - driver.capacityKg}kg`
    });
  }

  // 4. 单班总作业时长
  if (nextMinutes > driver.maxMinutes) {
    violations.push({
      type: "duration",
      overloadMinutes: nextMinutes - driver.maxMinutes,
      message: `单班总时长 ${nextMinutes} 分钟，超出上限 ${driver.maxMinutes} 分钟，超时 ${nextMinutes - driver.maxMinutes} 分钟`
    });
  }

  return violations;
}

export function hasHardViolation(violations: Violation[]): boolean {
  return violations.some(isHard);
}

export function violationSummary(violations: Violation[]): string {
  return violations.map((v) => v.message).join("；");
}
