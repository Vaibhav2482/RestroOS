// A minimal ESC/POS command builder - just the handful of commands an order
// ticket actually needs (init, align, bold, double size, cut), not a full
// wrapper around the spec. Targets generic 80mm ESC/POS thermal printers
// (Epson TM-T20/T88, Xprinter, TVS, Bixolon, and the many unbranded ones -
// they all speak the same command set), which is why nothing here is tied
// to one vendor's extensions.
const ESC = "\x1B";
const GS = "\x1D";

// 42 columns at the default Font A on 80mm paper is a conservative width
// that comfortably fits with a printer's margins without measuring - wider
// (48) is common too, but a ticket that's a few characters narrower than
// it could be costs nothing, while one that's too wide wraps mid-word on
// some printers/fonts.
export const PAPER_WIDTH_CHARS = 42;

export const init = () => ESC + "@";
export const alignLeft = () => ESC + "a" + "\x00";
export const alignCenter = () => ESC + "a" + "\x01";
export const bold = (on) => ESC + "E" + (on ? "\x01" : "\x00");
// GS ! n - low nibble = character height multiplier, high nibble = width
// multiplier. 0x11 doubles both; 0x00 is normal size.
export const doubleSize = (on) => GS + "!" + (on ? "\x11" : "\x00");

// Feeds a few blank lines before cutting so the cut doesn't land through
// the last printed line, then a partial cut (GS V 1) - leaves a small tab
// so the receipt doesn't fall off before the operator can tear it, unlike
// a full cut (GS V 0).
export const cutPaper = () => "\n\n\n" + GS + "V" + "\x01";

export const divider = (char = "-") => char.repeat(PAPER_WIDTH_CHARS) + "\n";

// Left text flush left, right text flush right, on one line - the small
// building block every "Label .......... Value" row on a receipt is made
// of. Right text is never truncated (an amount getting cut off is worse
// than a slightly cramped label); left text yields space to it instead.
export const twoColumn = (left, right, width = PAPER_WIDTH_CHARS) => {

    const leftText = String(left);
    const rightText = String(right);
    const maxLeftWidth = Math.max(0, width - rightText.length - 1);
    const truncatedLeft = leftText.length > maxLeftWidth ? leftText.slice(0, maxLeftWidth) : leftText;
    const gap = Math.max(1, width - truncatedLeft.length - rightText.length);

    return truncatedLeft + " ".repeat(gap) + rightText + "\n";

};

export const centered = (text, width = PAPER_WIDTH_CHARS) => {

    const padding = Math.max(0, Math.floor((width - text.length) / 2));

    return " ".repeat(padding) + text + "\n";

};

// Rs. rather than the ₹ glyph - codepage support for the Rupee sign varies
// a lot across generic/unbranded 80mm printers (it's a relatively recent
// Unicode addition, well after most ESC/POS codepage tables were fixed),
// while "Rs." prints correctly on every printer's default ASCII codepage
// with no encoding negotiation needed.
export const formatMoney = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
