import { useDroppable } from "@dnd-kit/core";
import type { Order, ShiftId } from "../types";
import { SHIFT_ORDER, SHIFTS, suggestShift } from "../domain/shifts";
import OrderCard from "./OrderCard";
import type { Driver } from "../types";

interface Props {
  orders: Order[];
  allOrders: Order[];
  drivers: Map<string, Driver>;
  onHandover: (orderId: string, preselectDriverId?: string) => void;
}

export default function PoolLane({ orders, allOrders, drivers, onHandover }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool", data: { type: "pool" } });

  const grouped = SHIFT_ORDER.map((shift) => ({
    shift,
    items: orders.filter((o) => suggestShift(o.pickupStart) === shift)
  }));

  return (
    <section ref={setNodeRef} className={`lane pool-lane ${isOver ? "is-over" : ""}`}>
      <header className="lane-head">
        <div>
          <p className="lane-title">待分配订单</p>
          <p className="lane-sub">按取货时段分组，拖到右侧对应司机班次</p>
        </div>
        <span className="lane-count">{orders.length}</span>
      </header>

      <div className="pool-groups">
        {grouped.map(({ shift, items }) => (
          <PoolGroup key={shift} shift={shift} items={items} allOrders={allOrders} drivers={drivers} onHandover={onHandover} />
        ))}
        {orders.length === 0 && <p className="lane-empty">待分配订单已全部排班</p>}
      </div>
    </section>
  );
}

function PoolGroup({
  shift,
  items,
  allOrders,
  drivers,
  onHandover
}: {
  shift: ShiftId;
  items: Order[];
  allOrders: Order[];
  drivers: Map<string, Driver>;
  onHandover: (orderId: string, preselectDriverId?: string) => void;
}) {
  const def = SHIFTS[shift];
  return (
    <div className="pool-group">
      <p className="pool-group-title">
        {def.name} <span>{def.start}–{def.end}</span>
        <em>{items.length}</em>
      </p>
      <div className="lane-cards">
        {items.map((order) => (
          <OrderCard key={order.id} order={order} drivers={drivers} orders={allOrders} onHandover={onHandover} />
        ))}
      </div>
    </div>
  );
}
