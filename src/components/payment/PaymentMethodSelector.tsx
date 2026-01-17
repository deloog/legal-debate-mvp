import { Check, CreditCard, Smartphone, QrCode } from 'lucide-react';

export type PaymentMethod = 'wechat' | 'alipay' | 'bank_card' | 'balance';

interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  available: boolean;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
}

const paymentMethods: PaymentMethodOption[] = [
  {
    id: 'wechat',
    name: '微信支付',
    icon: Smartphone,
    description: '推荐使用，支持快捷支付',
    available: true,
  },
  {
    id: 'alipay',
    name: '支付宝',
    icon: QrCode,
    description: '安全便捷，支持花呗分期',
    available: true,
  },
  {
    id: 'bank_card',
    name: '银行卡',
    icon: CreditCard,
    description: '支持各大银行信用卡/储蓄卡',
    available: true,
  },
  {
    id: 'balance',
    name: '余额支付',
    icon: CreditCard,
    description: '使用账户余额支付',
    available: true,
  },
];

export function PaymentMethodSelector({
  selectedMethod,
  onMethodSelect,
  disabled = false,
}: PaymentMethodSelectorProps) {
  return (
    <div className='space-y-4'>
      <h3 className='text-lg font-semibold text-gray-900'>选择支付方式</h3>
      <div className='grid gap-3'>
        {paymentMethods.map(method => {
          const isSelected = selectedMethod === method.id;
          const IconComponent = method.icon;

          return (
            <div
              key={method.id}
              className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${!method.available ? 'opacity-50' : ''}`}
              onClick={() => {
                if (!disabled && method.available) {
                  onMethodSelect(method.id);
                }
              }}
            >
              <div className='flex items-center gap-4'>
                {/* 图标 */}
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-blue-500' : 'bg-gray-100'
                  }`}
                >
                  <IconComponent
                    className={`h-6 w-6 ${
                      isSelected ? 'text-white' : 'text-gray-600'
                    }`}
                  />
                </div>

                {/* 信息 */}
                <div className='flex-1'>
                  <div className='mb-1 flex items-center gap-2'>
                    <h4 className='font-semibold text-gray-900'>
                      {method.name}
                    </h4>
                    {!method.available && (
                      <span className='rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600'>
                        暂不可用
                      </span>
                    )}
                  </div>
                  <p className='text-sm text-gray-600'>{method.description}</p>
                </div>

                {/* 选中标记 */}
                {isSelected && (
                  <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500'>
                    <Check className='h-4 w-4 text-white' />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 提示信息 */}
      <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
        <p className='text-sm text-yellow-800'>
          ⚠️ 支付功能正在开发中，当前仅供演示。实际支付功能将在后续版本中集成。
        </p>
      </div>
    </div>
  );
}
