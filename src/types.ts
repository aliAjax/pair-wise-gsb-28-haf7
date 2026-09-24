// 领域模型：订单 / 司机 / 班次 / 受阻记录 / 交接记录

export type OrderStatus = "pending" | "scheduled" | "hold" | "departed";

export interface Order {
  id: string;
  no: string; // 订单号
  pickupStart: string; // 取货开始 HH:MM
  pickupEnd: string; // 取货结束 HH:MM
  weight: number; // 重量 kg
  durationMin: number; // 作业时长（分钟）
  coldChain: boolean; // 是否冷链
  destination: string; // 目的地
  status: OrderStatus;
  shiftId: string | null; // 所在班次（hold 时为被卡住的班次）
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  hasCooler: boolean; // 是否配备保温箱
}

export type ShiftName = "早班" | "中班" | "晚班";

export interface Shift {
  id: string;
  driverId: string;
  name: ShiftName;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  capacityKg: number; // 单班总重上限
  capacityMin: number; // 单班总时长上限（分钟）
}

export type ViolationType =
  | "coldChain" // 硬约束：冷链订单交给无保温箱司机
  | "overlap" // 硬约束：取货时段重叠
  | "overweight" // 软约束：单班总重超限，待放行
  | "overtime"; // 软约束：单班总时长超限，待放行

export interface Violation {
  type: ViolationType;
  /** 与哪一单冲突（overlap 时为冲突订单号，weight/time 时为本订单号） */
  withOrderNo?: string;
  /** 超限差值 */
  excessKg?: number;
  excessMin?: number;
}

export type BlockAction = "assign" | "handover";

export interface BlockRecord {
  id: string;
  at: string; // ISO 时间
  action: BlockAction;
  orderId: string;
  orderNo: string;
  driverId: string;
  driverName: string;
  shiftName: string;
  windowLabel: string; // 订单取货时段
  violations: Violation[];
  hard: boolean;
  resolved: boolean; // 放行（软约束）后置为已处理
}

export interface HandoverRecord {
  id: string;
  at: string;
  orderId: string;
  orderNo: string;
  fromDriverId: string;
  fromDriverName: string;
  fromShiftName: string;
  toDriverId: string;
  toDriverName: string;
  toShiftName: string;
  reason: string;
}
