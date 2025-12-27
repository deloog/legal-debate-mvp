import { render, screen } from "@/test-utils/render";
import { describe, it } from "@jest/globals";
import "@testing-library/jest-dom";

// Simple test component for testing test setup
const TestComponent = () => {
  return (
    <div data-testid="test-component">
      <h1>Hello World</h1>
      <p>This is a test component</p>
    </div>
  );
};

describe("Test Infrastructure", () => {
  it("should render a test component correctly", () => {
    render(<TestComponent />);

    expect(screen.getByTestId("test-component")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("This is a test component")).toBeInTheDocument();
  });

  it("should have jest globals available", () => {
    expect(typeof jest.fn()).toBe("function");
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
  });

  it("should have testing library functions available", () => {
    expect(typeof render).toBe("function");
    expect(typeof screen).toBe("object");
  });
});
