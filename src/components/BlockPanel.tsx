import { useMemo, useState } from "react";
import type { BlockRecord, Order } from "../types";
import { violationText } from "../lib/violationText";

interface Props {
  blocks: BlockRecord[];
  orders: Order[];
  onRelease: (orderId: string) => void;
  onDismiss: (blockId: string) => void;
}

export function BlockPanel({ blocks, orders, onRelease, onDismiss }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const open = useMemo(() => blocks.filter((b) => !b.resolved), [blocks]);
  const history = useMemo(() => blocks.filter((b) => b.resolved), [blocks]);

  return (
    <section className="side-panel">
      <header className="side-head">
        <h2>受阻记录 {open.length > 0 && <em className="danger-dot">{open.length}</em>}</h2>
        <span className="side-sub">列出订单、司机、时段与超重明细</span>
      </header>

      {open.length === 0 && <div className="drop-hint">暂无受阻，排班顺畅</div>}

      <div className="block-list">
        {open.map((b) => {
          const stillHeld = orders.some((o) => o.id === b.orderId && o.status === "hold");
          return (
            <article key={b.id} className={`block-item ${b.hard ? "hard" : "soft"}`}>
              <div className="block-top">
                <strong>{b.orderNo}</strong>
                <span className={`block-kind ${b.hard ? "hard" : "soft"}`}>
                  {b.action === "handover" ? "交接受阻" : b.hard ? "硬性冲突" : "待放行"}
                </span>
              </div>
              <dl className="block-meta">
                <div><dt>司机/班次</dt><dd>{b.driverName} · {b.shiftName}</dd></div>
                <div><dt>取货时段</dt><dd>{b.windowLabel}</dd></div>
              </dl>
              <ul className="violations">
                {b.violations.map((v, i) => (
                  <li key={i} className={`v-${v.type}`}>{violationText(v)}</li>
                ))}
              </ul>
              <div className="block-actions">
                {!b.hard && stillHeld && (
                  <button type="button" className="mini warn" onClick={() => onRelease(b.orderId)}>
                    确认放行
                  </button>
                )}
                {b.hard && <span className="block-note">订单已退回待分配</span>}
                {!b.hard && !stillHeld && <span className="block-note">订单已移走</span>}
                <button type="button" className="mini ghost" onClick={() => onDismiss(b.id)}>知道了</button>
              </div>
              <time className="block-time">{new Date(b.at).toLocaleString("zh-CN", { hour12: false })}</time>
            </article>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="history">
          <button type="button" className="link-btn" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "收起" : "查看"}已处理记录（{history.length}）
          </button>
          {showHistory && (
            <ul className="history-list">
              {history.slice(0, 30).map((b) => (
                <li key={b.id}>
                  {new Date(b.at).toLocaleString("zh-CN", { hour12: false })} · {b.orderNo} → {b.driverName}（{b.hard ? "硬性冲突已退回" : "已放行/移走"}）
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
