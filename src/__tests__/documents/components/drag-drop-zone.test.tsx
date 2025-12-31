import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DragDropZone } from "@/app/documents/components/drag-drop-zone";

describe("DragDropZone", () => {
  it("应该渲染默认的拖拽区域", () => {
    const onDrop = jest.fn();
    render(<DragDropZone onDrop={onDrop} />);

    expect(screen.getByText("拖拽文件到此处")).toBeInTheDocument();
    expect(screen.getByText("或点击选择文件")).toBeInTheDocument();
  });

  it("应该渲染自定义子组件", () => {
    const onDrop = jest.fn();
    render(
      <DragDropZone onDrop={onDrop}>
        <div>自定义内容</div>
      </DragDropZone>,
    );

    expect(screen.getByText("自定义内容")).toBeInTheDocument();
    expect(screen.queryByText("拖拽文件到此处")).not.toBeInTheDocument();
  });

  it("点击时应触发文件选择", () => {
    const onDrop = jest.fn();
    render(<DragDropZone onDrop={onDrop} />);

    const input = screen.getByRole("button").querySelector("input");

    expect(input).toHaveAttribute("type", "file");
  });

  it("应该处理文件选择", () => {
    const onDrop = jest.fn();
    render(<DragDropZone onDrop={onDrop} />);

    const input = screen
      .getByRole("button")
      .querySelector("input") as HTMLInputElement;
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onDrop).toHaveBeenCalledWith([file]);
    expect(input.value).toBe("");
  });

  it("应该限制文件数量", () => {
    const onDrop = jest.fn();
    render(<DragDropZone onDrop={onDrop} maxFiles={2} />);

    const input = screen
      .getByRole("button")
      .querySelector("input") as HTMLInputElement;
    const file1 = new File(["test1"], "test1.pdf", { type: "application/pdf" });
    const file2 = new File(["test2"], "test2.pdf", { type: "application/pdf" });
    const file3 = new File(["test3"], "test3.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file1, file2, file3] } });

    expect(onDrop).toHaveBeenCalledWith([file1, file2]);
  });

  it("禁用状态下不应触发交互", () => {
    const onDrop = jest.fn();
    render(<DragDropZone onDrop={onDrop} disabled />);

    const zone = screen.getByRole("button");
    expect(zone).toHaveClass("opacity-50");
    expect(zone).toHaveClass("cursor-not-allowed");
    expect(zone).toHaveAttribute("tabIndex", "-1");
  });

  it("应该有正确的ARIA属性", () => {
    const onDrop = jest.fn();
    render(<DragDropZone onDrop={onDrop} />);

    const zone = screen.getByRole("button");
    expect(zone).toHaveAttribute("aria-label", "上传文件区域");
  });
});
