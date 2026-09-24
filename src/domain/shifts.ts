import type { ShiftDef, ShiftId } from "../types";

export const SHIFTS: Record<ShiftId, ShiftDef> = {
  early: { id: "early", name: "早班", start: "06:00", end: "14:00" },
  middle: { id: "middle", name: "中班", start: "14:00", end: "22:00" },
  late: { id: "late", name: "晚班", start: "22:00", end: "06:00" }
};

export const SHIFT_ORDER: ShiftId[] = ["early", "middle", "late"];

/** HH:mm 转当日分钟数；晚班跨零点时，可选择把小时数映射到次日。 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 取货时段建议归属班次（按取货开始时间落班）。 */
export function suggestShift(hhmm: string): ShiftId {
  const t = toMinutes(hhmm);
  if (t >= toMinutes(SHIFTS.late.start) || t < toMinutes(SHIFTS.early.start)) return "late";
  if (t < toMinutes(SHIFTS.middle.start)) return "early";
  return "middle";
}

/** 晚班把 00:00-06:00 映射为次日，便于做区间重叠比较。 */
function onShiftAxis(shift: ShiftId, hhmm: string): number {
  let t = toMinutes(hhmm);
  if (shift === "late" && t < toMinutes(SHIFTS.early.start)) t += 24 * 60;
  return t;
}

/** 两个 [start,end) 时段是否重叠。 */
export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string, shift: ShiftId): boolean {
  const aS = onShiftAxis(shift, aStart);
  const aE = onShiftAxis(shift, aEnd);
  const bS = onShiftAxis(shift, bStart);
  const bE = onShiftAxis(shift, bEnd);
  return aS < bE && bS < aE;
}

export function formatRange(start: string, end: string): string {
  return `${start}–${end}`;
}
