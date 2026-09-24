import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import type { Order } from "../types";

type DragBindings = Pick<ReturnType<typeof useDraggable>, "attributes" | "listeners">;

interface ViewProps {
  order: Order;
  overlay?: boolean;
  style?: CSSProperties;
  onRelease?: (id: string) => void;
  onReturn?: (id: string) => void;
  onDepart?: (id: string) => void;
  onHandover?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** 拖拽绑定（由可拖拽包装层注入），浮层卡片不传 */
  dragHandle?: DragBindings & { ref?: (node: HTMLElement | null) => void };
}

const STATUS_LABEL = {
  pending: "待分配",
  scheduled: "已排班",
  hold: "待放行",
  departed: "已发车",
} as const;

/** 纯展示卡片：不含任何拖拽注册，可安全用于 DragOverlay */
export function OrderCardView({ order, overlay, style, dragHandle, onRelease, onReturn, onDepart, onHandover, onDelete }: ViewProps) {
  // 按钮区不响应拖拽，避免点按被当成拖动
  const swallow = (e: MouseEvent | PointerEvent) => e.stopPropagation();

  return (
    <article
      ref={dragHandle?.ref}
      style={style}
      className={`order-card order-${order.status}${overlay ? " order-overlay" : ""}`}
      {...(dragHandle?.attributes ?? {})}
      {...(dragHandle?.listeners ?? {})}
      title="拖拽以排班 / 交接"
    >
      <header className="order-card-head">
        <strong>{order.no}</strong>
        <span className={`badge badge-${order.status}`}>
          {order.coldChain && <span className="snow">❄</span>}
          {STATUS_LABEL[order.status]}
        </span>
      </header>
      <div className="order-card-body">
        <span>🕒 {order.pickupStart}–{order.pickupEnd}</span>
        <span>⚖ {order.weight}kg</span>
        <span>⏱ {order.durationMin}分</span>
        <span>📍 {order.destination}</span>
      </div>
      {!overlay && (
        <footer className="order-card-actions" onClick={swallow} onPointerDown={swallow}>
          {order.status === "scheduled" && (
            <>
              <button type="button" className="mini" onClick={() => onDepart?.(order.id)}>发车</button>
              <button type="button" className="mini ghost" onClick={() => onReturn?.(order.id)}>撤回</button>
            </>
          )}
          {order.status === "hold" && (
            <>
              <button type="button" className="mini warn" onClick={() => onRelease?.(order.id)}>放行</button>
              <button type="button" className="mini ghost" onClick={() => onReturn?.(order.id)}>退回</button>
            </>
          )}
          {order.status === "departed" && (
            <button type="button" className="mini" onClick={() => onHandover?.(order.id)}>交接下一班</button>
          )}
          {order.status === "pending" && (
            <button type="button" className="mini danger" onClick={() => onDelete?.(order.id)}>删除</button>
          )}
        </footer>
      )}
    </article>
  );
}

interface WrapperProps extends Omit<ViewProps, "style" | "dragHandle"> {}

/** 可拖拽包装：注册 draggable，展示逻辑全部在 OrderCardView */
export function OrderCard(props: WrapperProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.order.id,
    data: { orderId: props.order.id, status: props.order.status, shiftId: props.order.shiftId },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <OrderCardView
      {...props}
      style={style}
      dragHandle={{ ref: setNodeRef, listeners, attributes }}
    />
  );
}
