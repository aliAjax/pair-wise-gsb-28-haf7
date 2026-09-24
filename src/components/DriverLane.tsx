import { useDroppable } from "@dnd-kit/core";
import type { Driver, Order } from "../types";
import { SHIFTS } from "../domain/shifts";
import { driverLoad } from "../domain/validation";
import OrderCard from "./OrderCard";

interface Props {
  driver: Driver;
  orders: Order[];
  allOrders: Order[];
  drivers: Map<string, Driver>;
  onHandover: (orderId: string, preselectDriverId?: string) => void;
}

export default function DriverLane({ driver, orders, allOrders, drivers, onHandover }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `driver-${driver.id}`,
    data: { type: "driver", driverId: driver.id }
  });

  const load = driverLoad(driver.id, allOrders);
  const weightOver = load.weightKg > driver.capacityKg;
  const minutesOver = load.totalMinutes > driver.maxMinutes;
  const shift = SHIFTS[driver.shift];

  return (
    <section ref={setNodeRef} className={`lane driver-lane ${isOver ? "is-over" : ""}`}>
      <header className="lane-head">
        <div>
          <p className="lane-title">{driver.name}</p>
          <p className="lane-sub">
            {shift.name} {shift.start}–{shift.end}
            {driver.hasCooler && <span className="mini-tag mini-tag-cold">保温箱</span>}
          </p>
        </div>
      </header>

      <div className={`capacity ${weightOver || minutesOver ? "capacity-over" : ""}`}>
        <div className="capacity-row">
          <span>载重</span>
          <strong>{load.weightKg}/{driver.capacityKg}kg</strong>
        </div>
        <div className="capacity-bar">
          <i style={{ width: `${Math.min(100, (load.weightKg / driver.capacityKg) * 100)}%` }} />
        </div>
        <div className="capacity-row">
          <span>时长</span>
          <strong>{load.totalMinutes}/{driver.maxMinutes}分</strong>
        </div>
        <div className="capacity-bar">
          <i className={minutesOver ? "bar-warn" : ""} style={{ width: `${Math.min(100, (load.totalMinutes / driver.maxMinutes) * 100)}%` }} />
        </div>
        <p className="capacity-count">{load.count} 单在班</p>
      </div>

      <div className="lane-cards">
        {orders.length === 0 && <p className="lane-empty">拖订单到此班次</p>}
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} drivers={drivers} orders={allOrders} onHandover={onHandover} />
        ))}
      </div>
    </section>
  );
}
