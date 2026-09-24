import { FormEvent, useState } from "react";
import type { NewOrderInput } from "../types";
import { suggestShift, SHIFTS } from "../domain/shifts";
import { useScheduleStore } from "../data/store";

export default function OrderForm() {
  const addOrder = useScheduleStore((s) => s.addOrder);
  const [form, setForm] = useState<NewOrderInput>({
    orderNo: "",
    destination: "",
    weightKg: 100,
    coldChain: false,
    pickupStart: "08:00",
    pickupEnd: "09:00",
    serviceMinutes: 60
  });
  const [error, setError] = useState("");

  function update<K extends keyof NewOrderInput>(key: K, value: NewOrderInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.orderNo.trim() || !form.destination.trim()) {
      setError("订单号与目的地必填");
      return;
    }
    if (form.weightKg <= 0 || form.serviceMinutes <= 0) {
      setError("重量与时长需大于 0");
      return;
    }
    if (form.pickupStart >= form.pickupEnd && !(suggestShift(form.pickupStart) === "late" && form.pickupEnd <= "06:00")) {
      setError("取货结束时间需晚于开始时间（晚班跨零点除外）");
      return;
    }
    setError("");
    addOrder({ ...form, orderNo: form.orderNo.trim(), destination: form.destination.trim() });
    setForm((f) => ({ ...f, orderNo: "", destination: "" }));
  }

  const suggested = SHIFTS[suggestShift(form.pickupStart)];

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>新增待分配订单</h2>
      <p className="form-hint">新订单进入待分配池，按取货时段建议归属<b>{suggested.name}（{suggested.start}–{suggested.end}）</b></p>
      <div className="form-grid">
        <label>订单号
          <input value={form.orderNo} onChange={(e) => update("orderNo", e.target.value)} placeholder="如 ORD-9100" required />
        </label>
        <label>目的地
          <input value={form.destination} onChange={(e) => update("destination", e.target.value)} placeholder="如 浦东" required />
        </label>
        <label>重量 kg
          <input type="number" min={1} value={form.weightKg} onChange={(e) => update("weightKg", Number(e.target.value))} required />
        </label>
        <label>作业时长（分钟）
          <input type="number" min={1} value={form.serviceMinutes} onChange={(e) => update("serviceMinutes", Number(e.target.value))} required />
        </label>
        <label>取货开始
          <input type="time" value={form.pickupStart} onChange={(e) => update("pickupStart", e.target.value)} required />
        </label>
        <label>取货结束
          <input type="time" value={form.pickupEnd} onChange={(e) => update("pickupEnd", e.target.value)} required />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={form.coldChain} onChange={(e) => update("coldChain", e.target.checked)} />
          冷链订单（必须由有保温箱的司机承接）
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="submit-btn">加入待分配</button>
    </form>
  );
}
