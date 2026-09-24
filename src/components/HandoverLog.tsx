import { useScheduleStore } from "../data/store";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HandoverLog() {
  const { handovers, drivers } = useScheduleStore();
  const nameOf = (id: string) => drivers.find((d) => d.id === id)?.name ?? id;

  return (
    <section className="panel log-panel">
      <h2>交接记录</h2>
      <p className="form-hint">已发车订单交接下一班时留存：原司机、新司机与原因；页面重开仍可续查。</p>
      {handovers.length === 0 ? (
        <p className="lane-empty">暂无交接记录</p>
      ) : (
        <ul className="log-list">
          {handovers.map((h) => (
            <li key={h.id} className="log-item">
              <header>
                <strong>{h.orderNo}</strong>
                <time>{formatTime(h.at)}</time>
              </header>
              <p className="log-flow">
                <span className="log-driver">{nameOf(h.fromDriverId)}</span>
                <span className="flow-arrow">→</span>
                <span className="log-driver log-driver-new">{nameOf(h.toDriverId)}</span>
              </p>
              <p className="log-reason">原因：{h.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
