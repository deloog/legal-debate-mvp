import * as React from 'react';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  return (
    <>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{
              open?: boolean;
              onOpenChange?: (open: boolean) => void;
            }>,
            {
              open: isOpen,
              onOpenChange: handleOpenChange,
            }
          );
        }
        return child;
      })}
    </>
  );
};

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(
  (
    { className, children, asChild = false, onOpenChange, onClick, ...props },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
      onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
      onOpenChange?.(true);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(
        children as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
        {
          ...props,
          onClick: handleClick,
        }
      );
    }
    return (
      <button
        ref={ref}
        className={className}
        onClick={
          handleClick as unknown as React.MouseEventHandler<HTMLButtonElement>
        }
        {...props}
      >
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(({ className, children, open = false, onOpenChange, ...props }, ref) => {
  if (!open) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div
        className='animate-dialog-overlay fixed inset-0 bg-black/50'
        onClick={() => onOpenChange?.(false)}
      />
      <div
        ref={ref}
        className={`animate-dialog-content relative z-50 w-full max-w-lg rounded-lg bg-white shadow-lg dark:bg-zinc-900 p-6 ${className || ''}`}
        onClick={e => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});
DialogContent.displayName = 'DialogContent';

const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={`mb-4 ${className || ''}`} {...props} />
));
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex items-center justify-end space-x-2 mt-6 ${className || ''}`}
    {...props}
  />
));
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={`text-lg font-semibold text-gray-900 dark:text-zinc-50 ${className || ''}`}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-gray-600 dark:text-zinc-400 ${className || ''}`}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
