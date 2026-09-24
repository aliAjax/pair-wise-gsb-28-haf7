import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import type { Driver, Order } from "../types";
import { formatRange } from "../domain/shifts";
import { driverLoad } from "../domain/validation";
import { useScheduleStore } from "../data/store";

interface Props {
  order: Order;
  drivers: Map<string, Driver>;
  orders: Order[];
  onHandover: (orderId: string, preselectDriverId?: string) => void;
}

const STATUS_LABEL: Record<Order["status"], string> = {
  unassigned: "待分配",
  assigned: "已排班",
  departed: "已发车",
  blocked: "待放行"
};

const VIOLATION_LABEL: Record<string, string> = {
  overlap: "时段冲突",
  cooler: "冷链不符",
  weight: "超重",
  duration: "超时"
};

export default function OrderCard({ order, drivers, orders, onHandover }: Props) {
  const { forceRelease, returnToPool, markDeparted, removeOrder } = useScheduleStore();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { type: "order", order }
  });

  const targetDriver = order.targetDriverId ? drivers.get(order.targetDriverId) : undefined;
  const currentDriver = order.driverId ? drivers.get(order.driverId) : undefined;
  const originDriver = order.originDriverId ? drivers.get(order.originDriverId) : undefined;
  const handedOver = order.status === "departed" && order.originDriverId && order.originDriverId !== order.driverId;

  const load = currentDriver && (order.status === "assigned" || order.status === "departed")
    ? driverLoad(currentDriver.id, orders)
    : null;
  const overLoaded = load && currentDriver
    ? load.weightKg > currentDriver.capacityKg || load.totalMinutes > currentDriver.maxMinutes
    : false;
  const hasHard = order.violations.some((v) => v.type === "overlap" || v.type === "cooler");

  return (
    <article
      ref={setNodeRef}
      className={`order-card order-card-${order.status} ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
    >
      <header className="order-card-head">
        <strong>{order.orderNo}</strong>
        <span className={`order-state state-${order.status}`}>{STATUS_LABEL[order.status]}</span>
      </header>

      <p className="order-dest">{order.destination}</p>

      <div className="order-meta">
        <span>🕒 {formatRange(order.pickupStart, order.pickupEnd)}</span>
        <span>⚖️ {order.weightKg}kg</span>
        <span>⏱ {order.serviceMinutes}分</span>
        {order.coldChain && <span className="mini-tag mini-tag-cold">❄ 冷链</span>}
      </div>

      {currentDriver && (
        <p className="order-driver">
          当前：{currentDriver.name}
          {load && (
            <em className={overLoaded ? "load-over" : ""}>
              （{load.weightKg}/{currentDriver.capacityKg}kg · {load.totalMinutes}/{currentDriver.maxMinutes}分）
            </em>
          )}
        </p>
      )}
      {handedOver && <p className="order-origin">原司机：{originDriver?.name}（已交接）</p>}

      {order.status === "blocked" && targetDriver && (
        <div className="block-info">
          <p className="block-target">尝试投放：{targetDriver.name} · 取货时段 {formatRange(order.pickupStart, order.pickupEnd)}</p>
          <ul className="violation-list">
            {order.violations.map((v) => (
              <li key={v.type} className={`violation violation-${v.type}`}>
                <b>{VIOLATION_LABEL[v.type]}</b>
                <span>{v.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="order-actions" onPointerDown={(e) => e.stopPropagation()}>
        {order.status === "blocked" && (
          <>
            <button type="button" onClick={() => forceRelease(order.id)} disabled={hasHard} title={hasHard ? "存在时段/冷链硬冲突，只能退回重排" : "超重/超时可由调度确认放行"}>
              强制放行
            </button>
            <button type="button" className="secondary" onClick={() => returnToPool(order.id)}>退回待分配</button>
          </>
        )}
        {order.status === "assigned" && (
          <button type="button" onClick={() => markDeparted(order.id)}>确认发车</button>
        )}
        {order.status === "departed" && (
          <button type="button" onClick={() => onHandover(order.id)}>交接下一班</button>
        )}
        <button type="button" className="ghost-danger" onClick={() => removeOrder(order.id)}>删除</button>
      </div>
    </article>
  );
}
