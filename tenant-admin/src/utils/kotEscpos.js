import { init, alignCenter, alignLeft, bold, doubleSize, divider, cutPaper, twoColumn, PAPER_WIDTH_CHARS } from "./escpos";

function formatTime(dateString) {

    const date = dateString ? new Date(dateString) : new Date();

    return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
    });

}

// Same content/ordering as components/KotReceipt.jsx (the on-screen/browser-
// print version) - table/delivery type leads in large type, no prices (the
// kitchen doesn't need them), notes called out separately. Kept in sync by
// hand rather than sharing code with the React component, since one renders
// JSX and the other builds a raw command string; the content they carry is
// what actually needs to match, not the implementation.
export function buildKotTicket({ order, restaurantName, kotNumber }) {

    const isDineIn = order.DeliveryType === "Dine In";
    const totalItems = (order.Items || []).reduce((sum, item) => sum + Number(item.Quantity || 0), 0);

    let ticket = init() + alignCenter();

    ticket += bold(true) + doubleSize(true) + (restaurantName || "Kitchen Order Ticket") + "\n" + doubleSize(false) + bold(false);

    if (order.BranchName) {
        ticket += order.BranchName + "\n";
    }

    ticket += "\n" + bold(true) + doubleSize(true);
    ticket += (isDineIn ? `TABLE ${order.TableNumber}` : (order.DeliveryType || "").toUpperCase()) + "\n";
    ticket += doubleSize(false) + bold(false) + "\n";

    ticket += alignLeft();
    ticket += twoColumn(`KOT #${kotNumber ?? order.OrderId}`, formatTime(order.OrderDate));
    ticket += divider();

    for (const item of order.Items || []) {

        ticket += bold(true) + `${item.Quantity}x  ${item.ItemName}\n` + bold(false);

        if (item.SelectedOptions?.length > 0) {
            ticket += `    ${item.SelectedOptions.map((option) => option.OptionName).join(", ")}\n`;
        }

    }

    if (order.OrderNotes) {
        ticket += divider();
        ticket += bold(true) + "Note: " + bold(false) + order.OrderNotes + "\n";
    }

    ticket += divider();
    ticket += alignCenter() + `${totalItems} item${totalItems === 1 ? "" : "s"} total\n`;

    ticket += cutPaper();

    return ticket;

}

export { PAPER_WIDTH_CHARS };
