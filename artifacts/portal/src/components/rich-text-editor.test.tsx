import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./rich-text-editor";

function EditorHarness({
  compact = false,
  onSave,
}: {
  compact?: boolean;
  onSave: (html: string) => void;
}) {
  const [html, setHtml] = useState("<p>Weekly plan</p>");

  return (
    <>
      <RichTextEditor value={html} onChange={setHtml} compact={compact} />
      <button type="button" onClick={() => onSave(html)}>
        Save
      </button>
    </>
  );
}

function selectEditorText(editor: HTMLElement) {
  const text = editor.querySelector("p")?.firstChild;
  if (!text) throw new Error("Expected editor paragraph text");

  const range = document.createRange();
  range.selectNodeContents(text);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.select(editor);
}

describe("RichTextEditor bold interactions", () => {
  it("applies bold exactly once with Ctrl+B in a compact weekly-plan cell and saves it", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<EditorHarness compact onSave={onSave} />);
    const editor = container.querySelector<HTMLElement>('[contenteditable="true"]');
    expect(editor).not.toBeNull();

    editor!.focus();
    selectEditorText(editor!);
    await user.keyboard("{Control>}b{/Control}");

    await waitFor(() => {
      expect(editor!.innerHTML).toBe("<p><strong>Weekly plan</strong></p>");
    });

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("<p><strong>Weekly plan</strong></p>");
  });

  it("keeps toolbar-based bold behavior unchanged", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<EditorHarness onSave={onSave} />);
    const editor = container.querySelector<HTMLElement>('[contenteditable="true"]');
    expect(editor).not.toBeNull();

    editor!.focus();
    selectEditorText(editor!);
    await user.click(screen.getByTitle("Bold"));

    await waitFor(() => {
      expect(editor!.innerHTML).toBe("<p><strong>Weekly plan</strong></p>");
    });
  });
});