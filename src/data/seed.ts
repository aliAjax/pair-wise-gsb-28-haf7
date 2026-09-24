import type { Driver, HandoverRecord, Order } from "../types";

export const SEED_DRIVERS: Driver[] = [
  { id: "d-liu", name: "刘师傅", shift: "early", hasCooler: true, capacityKg: 500, maxMinutes: 360 },
  { id: "d-zhao", name: "赵师傅", shift: "early", hasCooler: false, capacityKg: 600, maxMinutes: 380 },
  { id: "d-sun", name: "孙师傅", shift: "middle", hasCooler: true, capacityKg: 550, maxMinutes: 420 },
  { id: "d-zhou", name: "周师傅", shift: "middle", hasCooler: false, capacityKg: 800, maxMinutes: 420 },
  { id: "d-wu", name: "吴师傅", shift: "late", hasCooler: true, capacityKg: 500, maxMinutes: 360 }
];

const now = Date.now();
function iso(daysAgo: number, hour: number): string {
  return new Date(now - daysAgo * 86400000).toISOString().slice(0, 10) + `T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

export const SEED_ORDERS: Order[] = [
  // 早班：刘师傅（保温箱）已有一单
  {
    id: "o-9012",
    orderNo: "ORD-9012",
    destination: "浦东",
    weightKg: 260,
    coldChain: false,
    pickupStart: "07:30",
    pickupEnd: "08:30",
    serviceMinutes: 70,
    status: "assigned",
    driverId: "d-liu",
    originDriverId: "d-liu",
    targetDriverId: null,
    violations: [],
    createdAt: iso(1, 8)
  },
  // 已发车订单：冷链，刘师傅早班，用于演示交接给晚班吴师傅
  {
    id: "o-9108",
    orderNo: "ORD-9108",
    destination: "虹桥冷链仓",
    weightKg: 180,
    coldChain: true,
    pickupStart: "12:30",
    pickupEnd: "13:30",
    serviceMinutes: 60,
    status: "departed",
    driverId: "d-liu",
    originDriverId: "d-liu",
    targetDriverId: null,
    violations: [],
    createdAt: iso(1, 12)
  },
  // 待分配池
  {
    id: "o-9031",
    orderNo: "ORD-9031",
    destination: "嘉定",
    weightKg: 140,
    coldChain: false,
    pickupStart: "09:00",
    pickupEnd: "10:00",
    serviceMinutes: 50,
    status: "unassigned",
    driverId: null,
    originDriverId: null,
    targetDriverId: null,
    violations: [],
    createdAt: iso(0, 6)
  },
  {
    id: "o-9045",
    orderNo: "ORD-9045",
    destination: "宝山生鲜超市",
    weightKg: 120,
    coldChain: true,
    pickupStart: "08:00",
    pickupEnd: "09:00",
    serviceMinutes: 60,
    status: "unassigned",
    driverId: null,
    originDriverId: null,
    targetDriverId: null,
    violations: [],
    createdAt: iso(0, 6)
  },
  {
    id: "o-9066",
    orderNo: "ORD-9066",
    destination: "松江工业园",
    weightKg: 320,
    coldChain: false,
    pickupStart: "10:30",
    pickupEnd: "11:30",
    serviceMinutes: 90,
    status: "unassigned",
    driverId: null,
    originDriverId: null,
    targetDriverId: null,
    violations: [],
    createdAt: iso(0, 7)
  },
  {
    id: "o-9077",
    orderNo: "ORD-9077",
    destination: "徐汇冷链中心",
    weightKg: 90,
    coldChain: true,
    pickupStart: "15:00",
    pickupEnd: "16:00",
    serviceMinutes: 45,
    status: "unassigned",
    driverId: null,
    originDriverId: null,
    targetDriverId: null,
    violations: [],
    createdAt: iso(0, 9)
  },
  {
    id: "o-9088",
    orderNo: "ORD-9088",
    destination: "青浦",
    weightKg: 210,
    coldChain: false,
    pickupStart: "16:30",
    pickupEnd: "17:30",
    serviceMinutes: 80,
    status: "unassigned",
    driverId: null,
    originDriverId: null,
    targetDriverId: null,
    violations: [],
    createdAt: iso(0, 9)
  },
  {
    id: "o-9099",
    orderNo: "ORD-9099",
    destination: "机场冷链",
    weightKg: 160,
    coldChain: true,
    pickupStart: "23:30",
    pickupEnd: "00:30",
    serviceMinutes: 70,
    status: "unassigned",
    driverId: null,
    originDriverId: null,
    targetDriverId: null,
    violations: [],
    createdAt: iso(0, 10)
  }
];

export const SEED_HANDOVERS: HandoverRecord[] = [];
