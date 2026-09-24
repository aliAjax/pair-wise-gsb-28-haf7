import { useMemo, useState } from "react";
import type { Order } from "../types";
import { evaluateAssignment, hasHardViolation } from "../domain/validation";
import { SHIFTS } from "../domain/shifts";
import { useScheduleStore } from "../data/store";

interface Props {
  order: Order;
  preselectDriverId?: string;
  onClose: () => void;
}

const REASON_PRESETS = ["跨班交接给下一班", "原司机收班", "车辆故障/运力调整", "保温箱等设备限制", "其他（在备注中说明）"];

export default function HandoverModal({ order, preselectDriverId, onClose }: Props) {
  const { drivers, orders, handover } = useScheduleStore();
  const fromDriver = drivers.find((d) => d.id === order.driverId);

  const candidates = useMemo(
    () => drivers.filter((d) => d.id !== order.driverId),
    [drivers, order.driverId]
  );

  const initialTarget =
    preselectDriverId && preselectDriverId !== order.driverId
      ? preselectDriverId
      : candidates.find((d) => (!order.coldChain || d.hasCooler) && d.shift !== fromDriver?.shift)?.id
        ?? candidates[0]?.id
        ?? "";

  const [toDriverId, setToDriverId] = useState(initialTarget);
  const [reasonPreset, setReasonPreset] = useState(REASON_PRESETS[0]);
  const [reasonDetail, setReasonDetail] = useState("");

  const toDriver = drivers.find((d) => d.id === toDriverId);
  const violations = toDriver ? evaluateAssignment(order, toDriver, orders) : [];
  const hardBlocked = hasHardViolation(violations);

  const reason = reasonDetail.trim() ? `${reasonPreset}：${reasonDetail.trim()}` : reasonPreset;

  function confirm() {
    if (!toDriverId || !reason.trim()) return;
    handover(order.id, toDriverId, reason);
    onClose();
  }

  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <h2>已发车订单交接</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="modal-body">
          <div className="handover-order">
            <strong>{order.orderNo}</strong>
            <span>{order.destination}</span>
            <span>{order.pickupStart}–{order.pickupEnd}</span>
            <span>{order.weightKg}kg</span>
            {order.coldChain && <span className="mini-tag mini-tag-cold">冷链</span>}
          </div>

          <div className="handover-flow">
            <label>
              原司机
              <input value={`${fromDriver?.name ?? "—"}（${fromDriver ? SHIFTS[fromDriver.shift].name : ""}）`} readOnly />
            </label>
            <span className="flow-arrow">→</span>
            <label>
              新司机（交接后原司机容量当场释放）
              <select value={toDriverId} onChange={(e) => setToDriverId(e.target.value)}>
                {candidates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {SHIFTS[d.shift].name}{d.hasCooler ? " · 保温箱" : ""} · {d.capacityKg}kg
                  </option>
                ))}
              </select>
            </label>
          </div>

          {violations.length > 0 && (
            <ul className={`violation-list handover-check ${hardBlocked ? "check-blocked" : "check-warn"}`}>
              {violations.map((v) => (
                <li key={v.type} className={`violation violation-${v.type}`}>
                  <b>{v.type === "overlap" ? "时段冲突" : v.type === "cooler" ? "冷链不符" : v.type === "weight" ? "超重" : "超时"}</b>
                  <span>{v.message}</span>
                </li>
              ))}
              {hardBlocked && <li className="check-note">存在硬冲突，请改选其他司机。</li>}
            </ul>
          )}

          <label className="reason-field">
            交接原因（必留）
            <select value={reasonPreset} onChange={(e) => setReasonPreset(e.target.value)}>
              {REASON_PRESETS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <textarea
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            placeholder="补充说明（可选）：如下一棒取货点、现场情况等"
          />
        </div>

        <footer className="modal-foot">
          <button type="button" className="secondary" onClick={onClose}>取消</button>
          <button type="button" onClick={confirm} disabled={!toDriverId || hardBlocked}>
            确认交接并释放旧容量
          </button>
        </footer>
      </div>
    </div>
  );
}
