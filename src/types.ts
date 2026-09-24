/** 跨层共享的数据模型：只描述数据，不含任何校验与界面逻辑。 */

export type ShiftId = "early" | "middle" | "late";

export interface ShiftDef {
  id: ShiftId;
  name: string;
  /** 开班时间 HH:mm */
  start: string;
  /** 收班时间 HH:mm；晚班跨零点，以“次日”理解 */
  end: string;
}

export interface Driver {
  id: string;
  name: string;
  shift: ShiftId;
  /** 是否配备保温箱（冷链订单硬条件） */
  hasCooler: boolean;
  /** 单班载重上限 kg */
  capacityKg: number;
  /** 单班总作业时长上限（分钟） */
  maxMinutes: number;
}

/** unassigned 待分配池 / assigned 已排上班次 / departed 已发车 / blocked 待放行 */
export type OrderStatus = "unassigned" | "assigned" | "departed" | "blocked";

export type ViolationType = "overlap" | "cooler" | "weight" | "duration";

export interface Violation {
  type: ViolationType;
  message: string;
  /** overlap：与哪一单取货时段冲突 */
  conflictOrderId?: string;
  /** weight：超重 kg（正数） */
  overloadKg?: number;
  /** duration：超时分钟（正数） */
  overloadMinutes?: number;
}

export interface Order {
  id: string;
  orderNo: string;
  destination: string;
  weightKg: number;
  /** 是否冷链订单 */
  coldChain: boolean;
  /** 取货时段 HH:mm */
  pickupStart: string;
  pickupEnd: string;
  /** 本单作业时长（分钟），计入单班总时长 */
  serviceMinutes: number;
  status: OrderStatus;
  /** 当前承接司机；blocked 时为空（看 targetDriverId） */
  driverId: string | null;
  /** 最初承接的原司机，交接后也不改变 */
  originDriverId: string | null;
  /** 受阻时尝试投放的目标司机 */
  targetDriverId: string | null;
  /** 最近一次校验的冲突清单 */
  violations: Violation[];
  createdAt: string;
}

export interface HandoverRecord {
  id: string;
  orderId: string;
  orderNo: string;
  /** 交接前的原司机 */
  fromDriverId: string;
  /** 接班的新司机 */
  toDriverId: string;
  reason: string;
  at: string;
}

export interface NewOrderInput {
  orderNo: string;
  destination: string;
  weightKg: number;
  coldChain: boolean;
  pickupStart: string;
  pickupEnd: string;
  serviceMinutes: number;
}
