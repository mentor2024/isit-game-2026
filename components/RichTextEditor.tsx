"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    variant?: "default" | "simple";
    heightClass?: string;
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

function ToolbarButton({
    onClick,
    active,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => {
                e.preventDefault(); // prevent editor losing focus
                onClick();
            }}
            title={title}
            className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                active
                    ? "bg-gray-800 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
        >
            {children}
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RichTextEditor({
    value,
    onChange,
    label,
    placeholder,
    variant = "default",
    heightClass,
}: RichTextEditorProps) {
    const [isSourceView, setIsSourceView] = useState(false);
    const [sourceValue, setSourceValue] = useState(value);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                // StarterKit includes: bold, italic, strike, code, codeBlock,
                // heading, paragraph, bulletList, orderedList, blockquote,
                // hardBreak, horizontalRule, history
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-blue-600 underline cursor-pointer",
                },
            }),
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none px-4 py-3 min-h-full",
            },
        },
        onUpdate({ editor }) {
            const html = editor.getHTML();
            // Normalise &nbsp; to regular spaces to stay consistent with
            // what the old Quill editor produced
            const clean = html.replace(/&nbsp;/g, " ").replace(/&amp;nbsp;/g, " ");
            onChange(clean);
        },
    });

    // Keep editor in sync when `value` prop changes externally
    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (current !== value) {
            editor.commands.setContent(value ?? "", false);
        }
    }, [value, editor]);

    // Keep source textarea in sync when switching to source view
    const handleToggleSource = useCallback(() => {
        if (!isSourceView) {
            // switching TO source — snapshot current HTML
            setSourceValue(editor?.getHTML() ?? "");
        } else {
            // switching BACK to visual — push source into editor
            editor?.commands.setContent(sourceValue, false);
            onChange(sourceValue);
        }
        setIsSourceView((v) => !v);
    }, [isSourceView, editor, sourceValue, onChange]);

    const finalHeightClass =
        heightClass || (variant === "simple" ? "h-32" : "h-64");

    // ── Link helper ────────────────────────────────────────────────────────────
    const handleSetLink = useCallback(() => {
        if (!editor) return;
        const previous = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Enter URL", previous ?? "https://");
        if (url === null) return; // cancelled
        if (url === "") {
            editor.chain().focus().extendMarkToWordBoundary().unsetLink().run();
        } else {
            editor.chain().focus().extendMarkToWordBoundary().setLink({ href: url }).run();
        }
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="flex flex-col gap-2 relative">
            {/* Label + source toggle */}
            <div className="flex items-center justify-between">
                {label && (
                    <label className="font-bold text-gray-700">{label}</label>
                )}
                <button
                    type="button"
                    onClick={handleToggleSource}
                    className="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"
                >
                    {isSourceView ? "👁️ Visual View" : "💻 Source Code"}
                </button>
            </div>

            {isSourceView ? (
                /* ── Source / HTML view ────────────────────────────────────── */
                <textarea
                    className={`w-full p-4 font-mono text-sm border border-gray-300 rounded bg-gray-50 focus:ring-2 focus:ring-black focus:outline-none ${finalHeightClass}`}
                    value={sourceValue}
                    onChange={(e) => setSourceValue(e.target.value)}
                    placeholder="<!-- Edit HTML directly here -->"
                />
            ) : (
                /* ── Visual / WYSIWYG view ─────────────────────────────────── */
                <div className="border border-gray-300 rounded bg-white overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-gray-200 bg-gray-50">
                        {variant === "default" && (
                            <>
                                {/* Headings */}
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().toggleHeading({ level: 1 }).run()
                                    }
                                    active={editor.isActive("heading", { level: 1 })}
                                    title="Heading 1"
                                >
                                    H1
                                </ToolbarButton>
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().toggleHeading({ level: 2 }).run()
                                    }
                                    active={editor.isActive("heading", { level: 2 })}
                                    title="Heading 2"
                                >
                                    H2
                                </ToolbarButton>
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().toggleHeading({ level: 3 }).run()
                                    }
                                    active={editor.isActive("heading", { level: 3 })}
                                    title="Heading 3"
                                >
                                    H3
                                </ToolbarButton>
                                <span className="w-px h-5 bg-gray-300 mx-1" />
                            </>
                        )}

                        {/* Inline formatting */}
                        <ToolbarButton
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            active={editor.isActive("bold")}
                            title="Bold"
                        >
                            <strong>B</strong>
                        </ToolbarButton>
                        <ToolbarButton
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            active={editor.isActive("italic")}
                            title="Italic"
                        >
                            <em>I</em>
                        </ToolbarButton>
                        <ToolbarButton
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            active={editor.isActive("underline")}
                            title="Underline"
                        >
                            <span className="underline">U</span>
                        </ToolbarButton>
                        <ToolbarButton
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            active={editor.isActive("strike")}
                            title="Strikethrough"
                        >
                            <span className="line-through">S</span>
                        </ToolbarButton>

                        {variant === "default" && (
                            <>
                                <span className="w-px h-5 bg-gray-300 mx-1" />

                                {/* Lists */}
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().toggleBulletList().run()
                                    }
                                    active={editor.isActive("bulletList")}
                                    title="Bullet list"
                                >
                                    • List
                                </ToolbarButton>
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().toggleOrderedList().run()
                                    }
                                    active={editor.isActive("orderedList")}
                                    title="Numbered list"
                                >
                                    1. List
                                </ToolbarButton>
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().toggleBlockquote().run()
                                    }
                                    active={editor.isActive("blockquote")}
                                    title="Blockquote"
                                >
                                    ❝
                                </ToolbarButton>

                                <span className="w-px h-5 bg-gray-300 mx-1" />

                                {/* Alignment */}
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().setTextAlign("left").run()
                                    }
                                    active={editor.isActive({ textAlign: "left" })}
                                    title="Align left"
                                >
                                    ←
                                </ToolbarButton>
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().setTextAlign("center").run()
                                    }
                                    active={editor.isActive({ textAlign: "center" })}
                                    title="Align center"
                                >
                                    ↔
                                </ToolbarButton>
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().setTextAlign("right").run()
                                    }
                                    active={editor.isActive({ textAlign: "right" })}
                                    title="Align right"
                                >
                                    →
                                </ToolbarButton>

                                <span className="w-px h-5 bg-gray-300 mx-1" />

                                {/* HR */}
                                <ToolbarButton
                                    onClick={() =>
                                        editor.chain().focus().setHorizontalRule().run()
                                    }
                                    title="Horizontal rule"
                                >
                                    ─
                                </ToolbarButton>
                            </>
                        )}

                        {/* Link — both variants */}
                        <ToolbarButton
                            onClick={handleSetLink}
                            active={editor.isActive("link")}
                            title="Link"
                        >
                            🔗
                        </ToolbarButton>

                        <span className="w-px h-5 bg-gray-300 mx-1" />

                        {/* Clear formatting */}
                        <ToolbarButton
                            onClick={() =>
                                editor.chain().focus().clearNodes().unsetAllMarks().run()
                            }
                            title="Clear formatting"
                        >
                            ✕
                        </ToolbarButton>
                    </div>

                    {/* Editor area */}
                    <div
                        className={`overflow-y-auto ${finalHeightClass}`}
                        onClick={() => editor.commands.focus()}
                    >
                        <EditorContent editor={editor} placeholder={placeholder} />
                    </div>
                </div>
            )}

            {/* Minimal prose styles — scoped so they don't leak */}
            <style jsx global>{`
                .tiptap p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                    float: left;
                    height: 0;
                }
                .tiptap {
                    min-height: 100%;
                }
                .tiptap h1 { font-size: 1.75rem; font-weight: 800; margin: 0.5rem 0; }
                .tiptap h2 { font-size: 1.4rem;  font-weight: 700; margin: 0.5rem 0; }
                .tiptap h3 { font-size: 1.15rem; font-weight: 600; margin: 0.5rem 0; }
                .tiptap p  { margin: 0.1rem 0; font-size: 0.75rem; }
                .tiptap ul { list-style: disc;    padding-left: 1.5rem; }
                .tiptap ol { list-style: decimal; padding-left: 1.5rem; }
                .tiptap blockquote {
                    border-left: 3px solid #d1d5db;
                    padding-left: 1rem;
                    color: #6b7280;
                    margin: 0.5rem 0;
                }
                .tiptap hr {
                    border: none;
                    border-top: 2px solid #e5e7eb;
                    margin: 0.75rem 0;
                }
                .tiptap a { color: #2563eb; text-decoration: underline; }
            `}</style>
        </div>
    );
}
