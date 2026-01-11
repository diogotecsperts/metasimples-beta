import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Digite aqui...",
  className,
  maxLength = 2500,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] max-h-[500px] overflow-y-auto px-3 py-2",
      },
    },
  });

  // Atualiza o conteúdo quando o value muda externamente (ex: reset do form)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  // Conta caracteres do texto puro (sem HTML)
  const getPlainTextLength = useCallback(() => {
    if (!editor) return 0;
    return editor.state.doc.textContent.length;
  }, [editor]);

  const charCount = getPlainTextLength();

  if (!editor) {
    return (
      <div className="rounded-md border bg-background min-h-[170px] animate-pulse" />
    );
  }

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5 bg-muted/30">
        <div className="flex items-center gap-0.5">
          <Toggle
            size="sm"
            pressed={editor.isActive("bold")}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            aria-label="Negrito"
            title="Negrito (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("italic")}
            onPressedChange={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Itálico"
            title="Itálico (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("underline")}
            onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
            aria-label="Sublinhado"
            title="Sublinhado (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Toggle>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        <div className="flex items-center gap-0.5">
          <Toggle
            size="sm"
            pressed={editor.isActive("bulletList")}
            onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
            aria-label="Lista com marcadores"
            title="Lista com marcadores"
          >
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("orderedList")}
            onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
            aria-label="Lista numerada"
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </Toggle>
        </div>

        <div className="flex-1" />

        {/* Contador de caracteres */}
        <span
          className={cn(
            "text-xs tabular-nums shrink-0 pr-1",
            charCount > maxLength
              ? "text-destructive font-medium"
              : charCount > maxLength * 0.9
              ? "text-amber-500"
              : "text-muted-foreground"
          )}
        >
          {charCount.toLocaleString("pt-BR")} / {maxLength.toLocaleString("pt-BR")}
        </span>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Styles for placeholder */}
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
        .ProseMirror strong {
          font-weight: 600;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
