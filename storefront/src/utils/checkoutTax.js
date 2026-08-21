const round2 = (amount) => Math.round(amount * 100) / 100;

// Mirrors the server's OrderRepository.js computeOrderTax exactly - this is
// only a checkout-page preview of what the server will actually charge once
// the order is placed, so drifting from that algorithm would show the
// customer a number they don't then get charged. Each cart line is taxed at
// its own item's rate (not one flat rate for the whole cart, since real F&B
// has multiple GST slabs), a coupon discount is apportioned pro-rata across
// lines by their share of the subtotal, and CGST/SGST are split from one
// rounded per-line total rather than each rounded independently.
export const computeCheckoutEstimate = (cartItems, discountAmount = 0) => {

    const subtotal = cartItems.reduce((sum, item) => sum + Number(item.TotalPrice), 0);

    let cgstAmount = 0;
    let sgstAmount = 0;

    for (const item of cartItems) {

        const lineAmount = Number(item.TotalPrice);
        const lineShare = subtotal > 0 ? lineAmount / subtotal : 0;
        const lineDiscount = discountAmount * lineShare;
        const taxableAmount = Math.max(0, lineAmount - lineDiscount);

        const ratePercent = Number(item.TaxRatePercent ?? 0);
        const lineTax = round2(taxableAmount * (ratePercent / 100));
        const lineCgst = round2(lineTax / 2);

        cgstAmount += lineCgst;
        sgstAmount += round2(lineTax - lineCgst);

    }

    cgstAmount = round2(cgstAmount);
    sgstAmount = round2(sgstAmount);

    const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const grandTotal = round2(totalAfterDiscount + cgstAmount + sgstAmount);

    return { subtotal, totalAfterDiscount, cgstAmount, sgstAmount, grandTotal };

};
