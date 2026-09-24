import { Form, Input, InputNumber, Modal, Switch, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { NewOrderInput } from "../store/scheduleStore";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewOrderInput) => void;
}

interface FormValues {
  no: string;
  range: [Dayjs, Dayjs];
  weight: number;
  durationMin: number;
  coldChain: boolean;
  destination: string;
}

export function NewOrderModal({ open, onClose, onSubmit }: Props) {
  const [form] = Form.useForm<FormValues>();

  function handleFinish(values: FormValues) {
    onSubmit({
      no: values.no,
      pickupStart: values.range[0].format("HH:mm"),
      pickupEnd: values.range[1].format("HH:mm"),
      weight: Number(values.weight),
      durationMin: Number(values.durationMin),
      coldChain: values.coldChain,
      destination: values.destination,
    });
    form.resetFields();
    onClose();
  }

  return (
    <Modal
      title="新增待分配订单"
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={() => form.submit()}
      okText="加入待分配"
      cancelText="取消"
      destroyOnClose
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{
          weight: 100,
          durationMin: 30,
          coldChain: false,
          range: [dayjs("09:00", "HH:mm"), dayjs("10:00", "HH:mm")],
        }}
        onFinish={handleFinish}
      >
        <Form.Item
          name="no"
          label="订单号"
          rules={[{ required: true, message: "请输入订单号" }]}
        >
          <Input placeholder="ORD-XXXX" />
        </Form.Item>

        <Form.Item
          name="range"
          label="取货时段"
          rules={[
            { required: true, message: "请选择取货起止时间" },
            {
              validator: (_rule, value: [Dayjs, Dayjs]) =>
                value && value[0] && value[1] && value[1].isAfter(value[0])
                  ? Promise.resolve()
                  : Promise.reject(new Error("结束时间必须晚于开始时间")),
            },
          ]}
        >
          <TimePicker.RangePicker format="HH:mm" minuteStep={15} allowClear={false} />
        </Form.Item>

        <div className="form-row">
          <Form.Item
            name="weight"
            label="重量 kg"
            rules={[{ required: true, message: "请输入重量" }]}
          >
            <InputNumber min={1} max={3000} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="durationMin"
            label="作业时长（分钟）"
            rules={[{ required: true, message: "请输入时长" }]}
          >
            <InputNumber min={5} max={480} style={{ width: "100%" }} />
          </Form.Item>
        </div>

        <Form.Item name="coldChain" label="冷链订单（需保温箱司机承接）" valuePropName="checked">
          <Switch checkedChildren="冷链" unCheckedChildren="常温" />
        </Form.Item>

        <Form.Item
          name="destination"
          label="目的地"
          rules={[{ required: true, message: "请输入目的地" }]}
        >
          <Input placeholder="如：浦东张江" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
