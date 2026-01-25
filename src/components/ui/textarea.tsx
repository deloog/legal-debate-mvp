import * as React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className='flex flex-col'>
        {label && (
          <label className='text-sm font-medium text-gray-700 mb-1'>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${error ? 'border-red-500' : ''} ${className || ''}`}
          {...props}
        />
        {error && <span className='text-sm text-red-600 mt-1'>{error}</span>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
