import { useDroppable } from "@dnd-kit/core";
import type { Driver, Order, Shift } from "../types";
import { shiftUsage } from "../lib/validation";
import { toMin } from "../lib/time";
import { OrderCard } from "./OrderCard";

interface Props {
  shift: Shift;
  driver?: Driver;
  orders: Order[];
  onRelease: (id: string) => void;
  onReturn: (id: string) => void;
  onDepart: (id: string) => void;
  onHandover: (id: string) => void;
}

export function ShiftColumn({ shift, driver, orders, onRelease, onReturn, onDepart, onHandover }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `shift:${shift.id}`,
    data: { kind: "shift", shiftId: shift.id },
  });

  const usage = shiftUsage(shift.id, orders);
  const mine = orders
    .filter((o) => o.shiftId === shift.id)
    .sort((a, b) => toMin(a.pickupStart) - toMin(b.pickupStart));
  const overWeight = usage.weight > shift.capacityKg;
  const overTime = usage.duration > shift.capacityMin;

  return (
    <section ref={setNodeRef} className={`shift-col${isOver ? " drop-over" : ""}`}>
      <header className="shift-head">
        <div>
          <h3>
            {shift.name}
            <span className="shift-time">{shift.start}–{shift.end}</span>
          </h3>
          <p className="shift-driver">
            {driver?.name ?? "未指派"}
            {driver?.hasCooler && <span className="cooler" title="配备保温箱">🧊 保温箱</span>}
          </p>
        </div>
        <span className="shift-count">{mine.length} 单</span>
      </header>

      <div className="shift-caps">
        <div className={`cap ${overWeight ? "cap-over" : ""}`}>
          <span>总重</span>
          <div className="cap-track"><div className="cap-fill" style={{ width: `${Math.min(100, (usage.weight / shift.capacityKg) * 100)}%` }} /></div>
          <strong>{usage.weight}/{shift.capacityKg}kg</strong>
        </div>
        <div className={`cap ${overTime ? "cap-over" : ""}`}>
          <span>总时长</span>
          <div className="cap-track"><div className="cap-fill" style={{ width: `${Math.min(100, (usage.duration / shift.capacityMin) * 100)}%` }} /></div>
          <strong>{usage.duration}/{shift.capacityMin}分</strong>
        </div>
      </div>

      <div className="shift-orders">
        {mine.length === 0 && <div className="drop-hint">拖入订单排到本班</div>}
        {mine.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onRelease={onRelease}
            onReturn={onReturn}
            onDepart={onDepart}
            onHandover={onHandover}
          />
        ))}
      </div>
    </section>
  );
}
