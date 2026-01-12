import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withProviders?: boolean;
}

const AllTheProviders = ({ children }: { children: ReactNode }) => {
  // For now, just return children. We'll add providers as needed
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  { ...renderOptions }: CustomRenderOptions = {}
) => {
  return render(<AllTheProviders>{ui}</AllTheProviders>, renderOptions);
};

// Re-export everything from testing-library/react
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Export user event for interactions
export { userEvent } from '@testing-library/user-event';
