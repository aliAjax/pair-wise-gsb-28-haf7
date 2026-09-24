import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { App as AntdApp, Button, Popconfirm } from "antd";
import type { Order } from "./types";
import { useScheduleStore } from "./store/scheduleStore";
import { violationText } from "./lib/violationText";
import { OrderCardView } from "./components/OrderCard";
import { PendingPool } from "./components/PendingPool";
import { ShiftColumn } from "./components/ShiftColumn";
import { BlockPanel } from "./components/BlockPanel";
import { HandoverLog } from "./components/HandoverLog";
import { NewOrderModal } from "./components/NewOrderModal";
import { HandoverModal } from "./components/HandoverModal";

function Board() {
  const { message } = AntdApp.useApp();
  const store = useScheduleStore();
  const { drivers, shifts, orders, blocks, handovers } = store;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [handoverOrderId, setHandoverOrderId] = useState<string | null>(null);
  const [presetShiftId, setPresetShiftId] = useState<string | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const driverName = useMemo(() => {
    const map = new Map(drivers.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? "未知司机";
  }, [drivers]);

  const stats = useMemo(() => {
    const count = (s: Order["status"]) => orders.filter((o) => o.status === s).length;
    return [
      { label: "待分配", value: count("pending") },
      { label: "已排班", value: count("scheduled") },
      { label: "待放行", value: count("hold"), warn: true },
      { label: "已发车", value: count("departed") },
      { label: "受阻未处理", value: blocks.filter((b) => !b.resolved).length, warn: true },
    ];
  }, [orders, blocks]);

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) ?? null : null;
  const handoverOrder = handoverOrderId ? orders.find((o) => o.id === handoverOrderId) ?? null : null;

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const orderId = String(active.id);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const kind = over.data.current?.kind as string | undefined;

    if (kind === "pool") {
      if (order.status === "departed") {
        message.info("已发车订单不能拖回，请用「交接下一班」");
        return;
      }
      if (order.status === "pending") return;
      store.returnToPool(orderId);
      message.success(`已撤回 ${order.no}`);
      return;
    }

    if (kind === "shift") {
      const shiftId = String(over.data.current?.shiftId);

      if (order.status === "departed") {
        if (shiftId === order.shiftId) {
          message.info("已发车订单不能拖回原司机班，请交接给其他班次");
          return;
        }
        // 交接需要原因，弹窗收集后执行
        setHandoverOrderId(orderId);
        setPresetShiftId(shiftId);
        return;
      }

      const result = store.assignOrder(orderId, shiftId);
      const shift = shifts.find((s) => s.id === shiftId);
      const target = shift ? `${shift.name}·${driverName(shift.driverId)}` : "目标班次";
      if (result.ok) {
        message.success(`${order.no} 已排到 ${target}`);
      } else if (result.held) {
        message.warning(`${order.no} 已挂到 ${target}「待放行」：${result.violations.map(violationText).join("；")}`);
      } else {
        message.error(
          result.bounced
            ? `${order.no} 无法排到 ${target}，已留在待分配：${result.violations.map(violationText).join("；")}`
            : `${order.no} 无法改排到 ${target}，保留原班次：${result.violations.map(violationText).join("；")}`
        );
      }
    }
  }

  function confirmHandover(toShiftId: string, reason: string) {
    if (!handoverOrderId) return;
    const result = store.handover(handoverOrderId, toShiftId, reason);
    const order = orders.find((o) => o.id === handoverOrderId);
    const shift = shifts.find((s) => s.id === toShiftId);
    const target = shift ? `${shift.name}·${driverName(shift.driverId)}` : "目标班次";
    if (result.ok) {
      message.success(`${order?.no ?? "订单"} 已交接给 ${target}，原班容量已释放`);
      setHandoverOrderId(null);
      setPresetShiftId(undefined);
    } else {
      message.error(`交接受阻，${order?.no ?? "订单"} 留在原班：${result.violations.map(violationText).join("；")}`);
    }
  }

  return (
    <main className="app">
      <div className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">物流配送 · 拖拽式班次排班台</p>
            <h1>班次板排班台</h1>
            <p className="subtitle">
              待分配订单按取货时段拖给司机班次：重叠时段同一班次只能接一单；冷链订单仅保温箱司机可接；
              单班总重或总时长超限先进「待放行」；已发车订单可交接下一班并当场释放原班容量。
            </p>
          </div>
          <div className="top-actions">
            <Button type="primary" size="large" onClick={() => setNewOpen(true)}>＋ 新增订单</Button>
            <Popconfirm
              title="重置为演示数据？"
              description="当前排班、受阻与交接记录将被清空。"
              okText="重置"
              cancelText="取消"
              onConfirm={() => { store.resetAll(); message.success("已重置演示数据"); }}
            >
              <Button size="large">重置数据</Button>
            </Popconfirm>
          </div>
        </header>

        <section className="metrics">
          {stats.map((s) => (
            <article className={`metric${s.warn && s.value > 0 ? " metric-warn" : ""}`} key={s.label}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </article>
          ))}
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <PendingPool orders={orders} onDelete={(id) => { store.removeOrder(id); message.success("订单已删除"); }} />

          <section className="board">
            {shifts.map((shift) => (
              <ShiftColumn
                key={shift.id}
                shift={shift}
                driver={drivers.find((d) => d.id === shift.driverId)}
                orders={orders}
                onRelease={(id) => { store.releaseOrder(id); message.success("已放行，计入本班容量"); }}
                onReturn={(id) => { store.returnToPool(id); message.success("已退回待分配"); }}
                onDepart={(id) => { store.depart(id); message.success("已发车，可交接给下一班"); }}
                onHandover={(id) => { setHandoverOrderId(id); setPresetShiftId(undefined); }}
              />
            ))}
          </section>

          <DragOverlay dropAnimation={null}>
            {activeOrder ? <OrderCardView order={activeOrder} overlay /> : null}
          </DragOverlay>
        </DndContext>

        <section className="side-grid">
          <BlockPanel
            blocks={blocks}
            orders={orders}
            onRelease={(id) => { store.releaseOrder(id); message.success("已放行，计入本班容量"); }}
            onDismiss={(id) => store.resolveBlock(id)}
          />
          <HandoverLog handovers={handovers} />
        </section>

        <footer className="foot-note">
          数据自动保存在浏览器 localStorage，刷新或重开页面后排班、受阻与交接记录仍可续接。
        </footer>
      </div>

      <NewOrderModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={(input) => { store.addOrder(input); message.success("已加入待分配"); }}
      />
      <HandoverModal
        key={`${handoverOrderId ?? "none"}-${presetShiftId ?? "manual"}`}
        order={handoverOrder}
        shifts={shifts}
        presetShiftId={presetShiftId}
        driverName={driverName}
        onClose={() => { setHandoverOrderId(null); setPresetShiftId(undefined); }}
        onConfirm={confirmHandover}
      />
    </main>
  );
}

export default function App() {
  return (
    <AntdApp>
      <Board />
    </AntdApp>
  );
}
