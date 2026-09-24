import { Form, Input, Modal, Select } from "antd";
import type { Order, Shift } from "../types";

interface Props {
  order: Order | null;
  shifts: Shift[];
  presetShiftId?: string;
  driverName: (driverId: string) => string;
  onClose: () => void;
  onConfirm: (toShiftId: string, reason: string) => void;
}

interface FormValues {
  toShiftId: string;
  reason: string;
}

export function HandoverModal({ order, shifts, presetShiftId, driverName, onClose, onConfirm }: Props) {
  const [form] = Form.useForm<FormValues>();
  const candidates = order
    ? shifts.filter((s) => s.id !== order.shiftId)
    : [];

  function handleOk() {
    form.validateFields().then((values) => {
      onConfirm(values.toShiftId, values.reason.trim());
      form.resetFields();
    });
  }

  return (
    <Modal
      title={`已发车订单交接${order ? ` · ${order.no}` : ""}`}
      open={!!order}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      okText="确认交接"
      cancelText="取消"
      destroyOnClose
    >
      <p className="handover-tip">
        交接成功后订单转入下一班，<strong>原司机班次的重量/时长容量当场释放</strong>；
        若新班次存在冲突则留在原班并登记受阻。
      </p>
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{ toShiftId: presetShiftId, reason: "" }}
      >
        <Form.Item
          name="toShiftId"
          label="交接给哪一班（新司机）"
          rules={[{ required: true, message: "请选择目标班次" }]}
        >
          <Select
            placeholder="选择下一班"
            options={candidates.map((s) => ({
              value: s.id,
              label: `${s.name} ${s.start}–${s.end} · ${driverName(s.driverId)}`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="reason"
          label="交接原因"
          rules={[
            { required: true, message: "请填写交接原因" },
            { min: 2, message: "原因至少 2 个字" },
          ]}
        >
          <Input.TextArea rows={3} placeholder="如：车辆故障 / 跨区域改派 / 班次结束" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
