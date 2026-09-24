import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import type { Order } from "../types";
import { SHIFTS, SHIFT_ORDER } from "../domain/shifts";
import { useScheduleStore } from "../data/store";
import PoolLane from "./PoolLane";
import DriverLane from "./DriverLane";
import BlockedLane from "./BlockedLane";
import HandoverModal from "./HandoverModal";

interface DropData {
  type: "pool" | "driver";
  driverId?: string;
}

export default function ShiftBoard() {
  const { orders, drivers, assignOrder, returnToPool, pushToast } = useScheduleStore();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [handover, setHandover] = useState<{ orderId: string; preselect?: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const driverMap = new Map(drivers.map((d) => [d.id, d]));

  function onDragStart(e: DragStartEvent) {
    const order = e.active.data.current?.order as Order | undefined;
    if (order) setActiveOrder(order);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveOrder(null);
    const order = e.active.data.current?.order as Order | undefined;
    const target = e.over?.data.current as DropData | undefined;
    if (!order || !target) return;

    if (target.type === "pool") {
      if (order.status === "departed") {
        pushToast("info", "已发车订单请使用“交接下一班”，不能直接退回待分配");
        return;
      }
      if (order.status !== "unassigned") returnToPool(order.id);
      return;
    }

    const driverId = target.driverId!;
    // 已发车订单拖向任何司机列（含原司机）都走交接：留痕原司机、原因、新司机
    if (order.status === "departed") {
      setHandover({ orderId: order.id, preselect: driverId });
      return;
    }
    assignOrder(order.id, driverId);
  }

  const openHandover = (orderId: string, preselectDriverId?: string) =>
    setHandover({ orderId, preselect: preselectDriverId });

  const handoverOrder = handover ? orders.find((o) => o.id === handover.orderId) ?? null : null;

  const unassigned = orders.filter((o) => o.status === "unassigned");
  const blocked = orders.filter((o) => o.status === "blocked");

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveOrder(null)}>
      <div className="board-scroll">
        <div className="board">
          <div className="board-col board-col-pool">
            <PoolLane orders={unassigned} allOrders={orders} drivers={driverMap} onHandover={openHandover} />
            <BlockedLane orders={blocked} allOrders={orders} drivers={driverMap} onHandover={openHandover} />
          </div>

          {SHIFT_ORDER.map((shiftId) => (
            <div className="board-col" key={shiftId}>
              <div className="shift-group-head">{SHIFTS[shiftId].name} · {SHIFTS[shiftId].start}–{SHIFTS[shiftId].end}</div>
              <div className="shift-lanes">
                {drivers
                  .filter((d) => d.shift === shiftId)
                  .map((driver) => (
                    <DriverLane
                      key={driver.id}
                      driver={driver}
                      orders={orders.filter((o) => o.driverId === driver.id && (o.status === "assigned" || o.status === "departed"))}
                      allOrders={orders}
                      drivers={driverMap}
                      onHandover={openHandover}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOrder ? (
          <div className="drag-clone">
            <strong>{activeOrder.orderNo}</strong>
            <span>{activeOrder.destination} · {activeOrder.pickupStart}–{activeOrder.pickupEnd} · {activeOrder.weightKg}kg{activeOrder.coldChain ? " · 冷链" : ""}</span>
          </div>
        ) : null}
      </DragOverlay>

      {handoverOrder && (
        <HandoverModal
          order={handoverOrder}
          preselectDriverId={handover?.preselect}
          onClose={() => setHandover(null)}
        />
      )}
    </DndContext>
  );
}
