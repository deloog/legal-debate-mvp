import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CaseSearch } from "@/app/cases/components/case-search";

// Mock debounce
jest.useFakeTimers();

/**
 * CaseSearch组件测试
 * 测试搜索组件的渲染和交互功能
 */
describe("CaseSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 测试组件渲染
   */
  describe("渲染测试", () => {
    it("应该正确渲染搜索输入框", () => {
      const mockOnSearch = jest.fn();
      render(<CaseSearch value="" onSearch={mockOnSearch} />);

      expect(
        screen.getByPlaceholderText(/搜索案件标题、描述/),
      ).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("应该显示初始搜索值", () => {
      const mockOnSearch = jest.fn();
      render(<CaseSearch value="test" onSearch={mockOnSearch} />);

      expect(screen.getByRole("textbox")).toHaveValue("test");
    });

    it("应该显示搜索图标", () => {
      const mockOnSearch = jest.fn();
      render(<CaseSearch value="" onSearch={mockOnSearch} />);

      const searchIcon = document.querySelector('svg[class*="lucide-search"]');
      expect(searchIcon).toBeInTheDocument();
    });
  });

  /**
   * 测试用户交互
   */
  describe("交互测试", () => {
    it("应该在输入时更新值", async () => {
      const mockOnSearch = jest.fn();
      const user = userEvent.setup({ delay: null });
      render(<CaseSearch value="" onSearch={mockOnSearch} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "test");

      expect(input).toHaveValue("test");
    });

    it("应该在防抖延迟后调用搜索回调", async () => {
      const mockOnSearch = jest.fn();
      const user = userEvent.setup({ delay: null });
      render(<CaseSearch value="" onSearch={mockOnSearch} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "test");

      // 快进300ms（防抖延迟）
      jest.advanceTimersByTime(300);

      expect(mockOnSearch).toHaveBeenCalledWith("test");
    });

    it("应该在连续输入时正确防抖", async () => {
      const mockOnSearch = jest.fn();
      const user = userEvent.setup({ delay: null });
      render(<CaseSearch value="" onSearch={mockOnSearch} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "test");

      // 快进时间超过防抖延迟
      jest.advanceTimersByTime(300);

      // 验证只调用了一次
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
      expect(mockOnSearch).toHaveBeenCalledWith("test");

      // 继续输入
      await user.type(input, "ing");

      // 快进时间超过防抖延迟
      jest.advanceTimersByTime(300);

      // 验证调用了两次
      expect(mockOnSearch).toHaveBeenCalledTimes(2);
      expect(mockOnSearch).toHaveBeenCalledWith("testing");
    });

    it("应该正确处理空输入", async () => {
      const mockOnSearch = jest.fn();
      const user = userEvent.setup({ delay: null });
      render(<CaseSearch value="test" onSearch={mockOnSearch} />);

      const input = screen.getByRole("textbox");
      await user.clear(input);

      jest.advanceTimersByTime(300);

      expect(mockOnSearch).toHaveBeenCalledWith("");
    });
  });

  /**
   * 测试清空功能
   */
  describe("清空按钮测试", () => {
    it("当有值时应该显示清空按钮", () => {
      const mockOnSearch = jest.fn();
      render(<CaseSearch value="test" onSearch={mockOnSearch} />);

      const clearButton = document.querySelector('svg[class*="lucide-x"]');
      expect(clearButton).toBeInTheDocument();
    });

    it("当没有值时应该隐藏清空按钮", () => {
      const mockOnSearch = jest.fn();
      render(<CaseSearch value="" onSearch={mockOnSearch} />);

      const clearButton = document.querySelector('svg[class*="lucide-x"]');
      expect(clearButton).not.toBeInTheDocument();
    });

    it("点击清空按钮应该清空输入并调用回调", async () => {
      const mockOnSearch = jest.fn();
      const user = userEvent.setup({ delay: null });
      render(<CaseSearch value="test" onSearch={mockOnSearch} />);

      const clearButton = document
        .querySelector('svg[class*="lucide-x"]')
        ?.closest("button");
      expect(clearButton).toBeInTheDocument();

      await user.click(clearButton!);

      expect(screen.getByRole("textbox")).toHaveValue("");
      expect(mockOnSearch).toHaveBeenCalledWith("");
    });
  });

  /**
   * 测试无障碍性
   */
  describe("无障碍性测试", () => {
    it("输入框应该有正确的标签", () => {
      const mockOnSearch = jest.fn();
      render(<CaseSearch value="" onSearch={mockOnSearch} />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute(
        "placeholder",
        expect.stringContaining("搜索"),
      );
    });
  });

  /**
   * 测试样式类
   */
  describe("样式测试", () => {
    it("应该应用自定义类名", () => {
      const mockOnSearch = jest.fn();
      render(
        <CaseSearch
          value=""
          onSearch={mockOnSearch}
          className="custom-class"
        />,
      );

      const container = document.querySelector(".custom-class");
      expect(container).toBeInTheDocument();
    });
  });
});
