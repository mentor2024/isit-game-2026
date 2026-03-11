export const STAGE_NAMES = [
    "One", "Two", "Three", "Four", "Five",
    "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"
];

export const LEVEL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Using a constant list for reliable syncing across editors.
export const AVAILABLE_IZZY_IMAGES = [
    'izzy_1_640x960.png', 'izzy_2_640x960.png', 'izzy_3_640x960.png',
    'izzy_4_640x960.png', 'izzy_5_640x960.png', 'izzy_6_640x960.png',
    'izzy_7_640x960.png', 'izzy_8_640x960.png', 'izzy_9_640x960.png',
    'izzy_10_640x960.png', 'izzy_11_640x960.png', 'izzy_12_640x960.png',
    'izzy_13_640x960.png', 'izzy_14_640x960.png', 'izzy_15_640x960.png',
    'izzy_16_640x960.png'
];

export function formatStage(n: number): string {
    if (n < 1 || n > 20) return n.toString();
    return STAGE_NAMES[n - 1] || n.toString();
}

export function formatLevel(n: number): string {
    if (n < 1 || n > 26) return n.toString();
    return LEVEL_LETTERS[n - 1] || n.toString();
}

/**
 * Injects inline styles into HTML to force correct rendering of paragraphs and lists,
 * bypassing any CSS resets or class conflicts.
 */
export function formatHtmlForDisplay(html: string | undefined | null): string {
    if (!html) return "";

    return html
        // Force Block & Margin for Paragraphs
        .replace(/<p>/g, '<p style="display: block; margin-bottom: 24px;">')
        // Force Margins for Lists
        .replace(/<ul>/g, '<ul style="margin-bottom: 24px; list-style-type: disc; padding-left: 24px;">')
        .replace(/<ol>/g, '<ol style="margin-bottom: 24px; list-style-type: decimal; padding-left: 24px;">')
        .replace(/<li>/g, '<li style="margin-bottom: 8px;">')
        // Force Bold
        .replace(/<strong>/g, '<strong style="font-weight: 900;">')
        .replace(/<b>/g, '<b style="font-weight: 900;">')
        // Force HR styling
        .replace(/<hr>/g, '<hr style="margin-top: 32px; margin-bottom: 32px; border: 0; border-top: 1px solid #444; display: block;" />');
}
