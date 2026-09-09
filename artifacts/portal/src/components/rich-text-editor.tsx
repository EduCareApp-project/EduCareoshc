import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo,
  Link as LinkIcon, Unlink, RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  onFocus?: (editor: Editor) => void;
}

type RichTextToolbarProps = {
  editor: Editor | null;
  className?: string;
};

export function RichTextToolbar({ editor, className }: RichTextToolbarProps) {
  const ToolbarBtn = ({
    onClick, active, title, children, disabled,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className={cn(
        "p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none",
        active ? "bg-muted text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );

  const addLink = () => {
    if (!editor || editor.state.selection.empty) return;
    const currentUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter the link URL", currentUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-0.5 border-b px-2 py-1 bg-muted/30", className)}>
      {!editor && <span className="px-2 py-1 text-xs text-muted-foreground">Click in a planning box to format its text.</span>}
      <ToolbarBtn title="Bold" disabled={!editor} active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Italic" disabled={!editor} active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Underline" disabled={!editor} active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <label title="Text colour" className={cn("relative h-7 w-7 rounded hover:bg-muted", !editor && "opacity-40 pointer-events-none")}>
        <span className="absolute inset-x-1 top-1 text-center text-xs font-bold">A</span>
        <span className="absolute inset-x-1 bottom-1 h-1 rounded bg-gradient-to-r from-red-500 via-green-500 to-blue-500" />
        <input
          type="color"
          aria-label="Text colour"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={!editor}
          onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
        />
      </label>
      <label title="Background colour" className={cn("relative h-7 w-7 rounded hover:bg-muted", !editor && "opacity-40 pointer-events-none")}>
        <span className="absolute inset-1 rounded border bg-yellow-200" />
        <span className="absolute inset-0 grid place-items-center text-[10px] font-bold">A</span>
        <input
          type="color"
          aria-label="Background colour"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={!editor}
          defaultValue="#fef08a"
          onChange={(event) => editor?.chain().focus().setHighlight({ color: event.target.value }).run()}
        />
      </label>
      <ToolbarBtn
        title="Clear text and background colours"
        disabled={!editor}
        onClick={() => editor?.chain().focus().unsetColor().unsetHighlight().run()}
      >
        <RemoveFormatting className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn title="Add or edit link" disabled={!editor} active={editor?.isActive("link")} onClick={addLink}>
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Remove link" disabled={!editor} onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}>
        <Unlink className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn title="Bullet list" disabled={!editor} active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Numbered list" disabled={!editor} active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn title="Align left" disabled={!editor} active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Align center" disabled={!editor} active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Align right" disabled={!editor} active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarBtn title="Undo" disabled={!editor} onClick={() => editor?.chain().focus().undo().run()}>
        <Undo className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Redo" disabled={!editor} onClick={() => editor?.chain().focus().redo().run()}>
        <Redo className="h-3.5 w-3.5" />
      </ToolbarBtn>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder = "Write something…", className, compact = false, onFocus }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
      }),
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    onFocus({ editor }) {
      onFocus?.(editor);
    },
    editorProps: {
      attributes: {
        class: compact
          ? "min-h-[60px] text-xs focus:outline-none prose prose-sm max-w-none [&_p]:my-0"
          : "min-h-[100px] px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none",
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className={cn("border rounded-md overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      {!compact && <RichTextToolbar editor={editor} />}

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("prose prose-sm max-w-none text-sm", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
