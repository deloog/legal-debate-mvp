import { HTMLAttributes } from 'react';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  indicatorClassName?: string;
}

export function Progress({
  value,
  max = 100,
  className = '',
  indicatorClassName = '',
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}
      role='progressbar'
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      {...props}
    >
      <div
        className={`h-full transition-all duration-300 ease-in-out ${indicatorClassName}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
