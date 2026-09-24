import type { Driver, Order } from "../types";
import OrderCard from "./OrderCard";

interface Props {
  orders: Order[];
  allOrders: Order[];
  drivers: Map<string, Driver>;
  onHandover: (orderId: string, preselectDriverId?: string) => void;
}

/** 待放行车道：只展示被拦下的订单（订单、目标司机、取货时段、超重/超时）。不是投放目标。 */
export default function BlockedLane({ orders, allOrders, drivers, onHandover }: Props) {
  return (
    <section className={`lane blocked-lane ${orders.length ? "has-blocked" : ""}`}>
      <header className="lane-head">
        <div>
          <p className="lane-title">⚠️ 待放行</p>
          <p className="lane-sub">单班总重/时长冲突的单子先放这里；时段重叠与冷链不符为硬冲突，必须退回重排</p>
        </div>
        <span className={`lane-count ${orders.length ? "count-warn" : ""}`}>{orders.length}</span>
      </header>

      <div className="lane-cards blocked-cards">
        {orders.length === 0 && <p className="lane-empty">暂无受阻订单</p>}
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} drivers={drivers} orders={allOrders} onHandover={onHandover} />
        ))}
      </div>
    </section>
  );
}
