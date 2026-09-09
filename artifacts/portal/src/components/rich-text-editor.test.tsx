import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import { RichTextEditor, RichTextToolbar } from "./rich-text-editor";

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

function EditorHarness({
  compact = false,
  sharedToolbar = false,
  onSave,
}: {
  compact?: boolean;
  sharedToolbar?: boolean;
  onSave: (html: string) => void;
}) {
  const [html, setHtml] = useState("<p>Weekly plan</p>");
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  return (
    <>
      {sharedToolbar && <RichTextToolbar editor={activeEditor} />}
      <RichTextEditor
        value={html}
        onChange={setHtml}
        compact={compact}
        onFocus={sharedToolbar ? setActiveEditor : undefined}
      />
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

  it("formats compact planning cells from the shared grid toolbar", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("https://example.com");
    const { container } = render(<EditorHarness compact sharedToolbar onSave={onSave} />);
    const editor = container.querySelector<HTMLElement>('[contenteditable="true"]')!;

    editor.focus();
    await waitFor(() => expect(screen.getByTitle("Bold")).not.toBeDisabled());
    selectEditorText(editor);
    await user.click(screen.getByTitle("Bold"));

    selectEditorText(editor);
    fireEvent.change(screen.getByLabelText("Text colour"), { target: { value: "#ff0000" } });

    selectEditorText(editor);
    fireEvent.change(screen.getByLabelText("Background colour"), { target: { value: "#ffff00" } });

    selectEditorText(editor);
    await user.click(screen.getByTitle("Add or edit link"));

    await waitFor(() => {
      expect(editor.innerHTML).toContain("<strong>");
      expect(editor.innerHTML).toContain("color: rgb(255, 0, 0)");
      expect(editor.innerHTML).toContain("background-color: rgb(255, 255, 0)");
      expect(editor.innerHTML).toContain('href="https://example.com"');
    });
    prompt.mockRestore();
  });
});