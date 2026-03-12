/**
 * 签名板组件
 * 使用Canvas实现手写签名功能
 */
'use client';

import { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  penColor?: string;
  penWidth?: number;
}

export default function SignaturePad({
  onSave,
  onCancel,
  width = 600,
  height = 300,
  penColor = '#000000',
  penWidth = 2,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布样式
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setContext(ctx);

    // 设置高DPI支持
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }, [penColor, penWidth]);

  // 开始绘制
  function startDrawing(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!context) return;

    setIsDrawing(true);
    setIsEmpty(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x =
      'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y =
      'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    context.beginPath();
    context.moveTo(x, y);
  }

  // 绘制中
  function draw(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) {
    if (!isDrawing || !context) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x =
      'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y =
      'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    context.lineTo(x, y);
    context.stroke();
  }

  // 结束绘制
  function stopDrawing() {
    if (!context) return;
    setIsDrawing(false);
    context.closePath();
  }

  // 清除签名
  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }

  // 保存签名
  function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isEmpty) {
      alert('请先签名');
      return;
    }

    // 转换为Base64
    const signature = canvas.toDataURL('image/png');
    onSave(signature);
  }

  return (
    <div className='flex flex-col items-center space-y-4'>
      {/* 签名画布 */}
      <div className='relative rounded-lg border-2 border-gray-300 bg-white shadow-sm'>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className='cursor-crosshair touch-none'
          style={{ width: `${width}px`, height: `${height}px` }}
        />

        {/* 提示文字（仅在空白时显示） */}
        {isEmpty && (
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
            <p className='text-gray-400'>请在此处签名</p>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className='flex gap-3'>
        <button
          type='button'
          onClick={clearSignature}
          disabled={isEmpty}
          className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          清除重签
        </button>
        {onCancel && (
          <button
            type='button'
            onClick={onCancel}
            className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            取消
          </button>
        )}
        <button
          type='button'
          onClick={saveSignature}
          disabled={isEmpty}
          className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          确认签名
        </button>
      </div>

      {/* 使用提示 */}
      <div className='rounded-lg bg-blue-50 p-3 text-xs text-blue-800'>
        <p className='font-medium'>签名提示：</p>
        <ul className='mt-1 space-y-1 list-disc list-inside'>
          <li>请使用鼠标或触摸屏在上方区域签名</li>
          <li>签名将被保存为电子签名，具有法律效力</li>
          <li>如需重新签名，请点击&quot;清除重签&quot;按钮</li>
        </ul>
      </div>
    </div>
  );
}
