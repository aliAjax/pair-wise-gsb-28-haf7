import { useDroppable } from "@dnd-kit/core";
import type { Order } from "../types";
import { toMin } from "../lib/time";
import { OrderCard } from "./OrderCard";

interface Props {
  orders: Order[];
  onDelete: (id: string) => void;
}

export function PendingPool({ orders, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: "pool",
    data: { kind: "pool" },
  });

  const pending = orders
    .filter((o) => o.status === "pending")
    .sort((a, b) => toMin(a.pickupStart) - toMin(b.pickupStart));

  return (
    <section ref={setNodeRef} className={`pool${isOver ? " drop-over" : ""}`}>
      <header className="pool-head">
        <h2>待分配订单</h2>
        <span className="pool-hint">按取货时段拖给对应班次 · 拖回此处可撤回排班（已发车除外）</span>
        <span className="shift-count">{pending.length} 单</span>
      </header>
      <div className="pool-cards">
        {pending.length === 0 && <div className="drop-hint">待分配池已空</div>}
        {pending.map((order) => (
          <OrderCard key={order.id} order={order} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}
