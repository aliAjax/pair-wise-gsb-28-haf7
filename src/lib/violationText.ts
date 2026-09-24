// 违规项的展示文案（纯函数），看板提示与受阻清单共用
import type { Violation } from "../types";

export function violationText(v: Violation): string {
  switch (v.type) {
    case "coldChain":
      return "冷链订单必须由配备保温箱的司机承接";
    case "overlap":
      return `取货时段与订单 ${v.withOrderNo ?? ""} 重叠，同一班次重叠时段只能接一单`;
    case "overweight":
      return `单班总重超出上限 ${v.excessKg ?? 0} kg`;
    case "overtime":
      return `单班总时长超出上限 ${v.excessMin ?? 0} 分钟`;
  }
}
