import type { HandoverRecord } from "../types";

interface Props {
  handovers: HandoverRecord[];
}

export function HandoverLog({ handovers }: Props) {
  return (
    <section className="side-panel">
      <header className="side-head">
        <h2>发车交接记录</h2>
        <span className="side-sub">原司机 / 原因 / 新司机，原班容量当场释放</span>
      </header>
      {handovers.length === 0 && <div className="drop-hint">尚无已发车订单交接</div>}
      <ul className="handover-list">
        {handovers.map((h) => (
          <li key={h.id} className="handover-item">
            <div className="handover-route">
              <span>{h.fromDriverName}·{h.fromShiftName}</span>
              <span className="arrow">→</span>
              <span>{h.toDriverName}·{h.toShiftName}</span>
            </div>
            <div className="handover-no">{h.orderNo}</div>
            <div className="handover-reason">原因：{h.reason}</div>
            <time className="block-time">{new Date(h.at).toLocaleString("zh-CN", { hour12: false })}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
