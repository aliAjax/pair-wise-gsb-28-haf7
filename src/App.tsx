import { useMemo } from "react";
import OrderForm from "./components/OrderForm";
import ShiftBoard from "./components/ShiftBoard";
import HandoverLog from "./components/HandoverLog";
import { useScheduleStore } from "./data/store";

function Toasts() {
  const { toasts, dismissToast } = useScheduleStore();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismissToast(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { orders, handovers, resetDemo } = useScheduleStore();

  const metrics = useMemo(() => {
    const count = (s: string) => orders.filter((o) => o.status === s).length;
    return [
      { label: "待分配", value: count("unassigned") },
      { label: "在班（已排班/已发车）", value: count("assigned") + count("departed") },
      { label: "待放行", value: count("blocked") },
      { label: "交接记录", value: handovers.length }
    ];
  }, [orders, handovers]);

  return (
    <main className="app">
      <div className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">物流行业前端最小闭环</p>
            <h1>配送排班 · 可拖拽班次板</h1>
            <p className="subtitle">
              待分配订单按取货时段拖入司机班次；重叠时段只能接一单，冷链必须交给有保温箱的司机；
              单班总重或时长冲突先进待放行；已发车订单可交接下一班并释放旧容量。
            </p>
          </div>
          <div className="topbar-side">
            <div className="stack">
              {["React", "Vite", "TypeScript", "dnd-kit", "zustand"].map((item) => (
                <span className="tag" key={item}>{item}</span>
              ))}
            </div>
            <button type="button" className="secondary reset-btn" onClick={resetDemo}>恢复演示数据</button>
          </div>
        </header>

        <section className="metrics">
          {metrics.map((m) => (
            <article className="metric" key={m.label}>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </article>
          ))}
        </section>

        <div className="layout">
          <aside className="sidebar">
            <OrderForm />
            <HandoverLog />
          </aside>
          <section className="board-wrap">
            <ShiftBoard />
          </section>
        </div>
      </div>
      <Toasts />
    </main>
  );
}
