// The one place that knows how a table's QR code link is built - a
// customer scanning it lands on the storefront already scoped to this
// restaurant, with the table pre-filled (see storefront's
// StorefrontContext, which reads this exact "table" query param). Falls
// back to the local dev storefront's own port, same reasoning as
// axiosClient's own VITE_API_BASE_URL fallback - only production actually
// needs the real env var set.
export const buildTableOrderUrl = (tenantSlug, tableName) => {

    const base = import.meta.env.VITE_STOREFRONT_URL || "http://localhost:5177";

    return `${base}/${encodeURIComponent(tenantSlug)}?table=${encodeURIComponent(tableName)}`;

};
