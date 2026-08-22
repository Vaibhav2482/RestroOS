import { init, alignCenter, alignLeft, bold, doubleSize, divider, cutPaper, twoColumn, formatMoney, PAPER_WIDTH_CHARS } from "./escpos";

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    return new Date(dateString).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
    });

}

// Same content as components/TableVisitBillReceipt.jsx - the one
// consolidated bill for a table's whole visit, however many separate
// rounds/KOTs it took to get there (see server migration
// 0024_table_visits). Item quantities/amounts here are already merged
// server-side; this only formats them for print.
export function buildBillTicket({ visit, restaurantName, branchName }) {

    let ticket = init() + alignCenter();

    ticket += bold(true) + doubleSize(true) + (restaurantName || "Table Bill") + "\n" + doubleSize(false) + bold(false);

    if (branchName) {
        ticket += branchName + "\n";
    }

    ticket += "\n" + bold(true) + `TABLE ${visit.TableNumber}\n` + bold(false);
    ticket += formatDate(visit.ClosedAt || visit.OpenedAt) + "\n\n";

    ticket += alignLeft();
    ticket += divider();

    for (const item of visit.Items || []) {
        ticket += twoColumn(`${item.Quantity}x ${item.ItemName}`, formatMoney(item.TotalPrice));
    }

    ticket += divider();

    ticket += twoColumn("Subtotal", formatMoney(visit.SubTotal));

    if (Number(visit.DiscountAmount) > 0) {
        ticket += twoColumn("Discount", `-${formatMoney(visit.DiscountAmount)}`);
    }

    ticket += twoColumn("CGST", formatMoney(visit.CgstAmount));
    ticket += twoColumn("SGST", formatMoney(visit.SgstAmount));
    ticket += divider();

    ticket += bold(true) + doubleSize(true);
    ticket += twoColumn("TOTAL", formatMoney(visit.TotalAmount), Math.floor(PAPER_WIDTH_CHARS / 2));
    ticket += doubleSize(false) + bold(false) + "\n";

    ticket += `Paid via: ${visit.PaymentMethod || "-"}\n`;
    ticket += `Orders on this visit: ${visit.OrderCount}\n`;

    ticket += alignCenter() + "\nThank you, visit again!\n";

    ticket += cutPaper();

    return ticket;

}
