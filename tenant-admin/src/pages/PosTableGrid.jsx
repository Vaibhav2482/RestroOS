import { Box, Button, Card, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";

import { POS_STATUS_COLOR, getPosForwardStatuses } from "./posOrderStatus";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

// Fixed card width, not a per-breakpoint column count - a floor plan needs
// to scale to however many tables a tenant actually has (a small counter
// with 5 tables and a large hall with 80 are both real cases), and a fixed-
// count grid (the old "6 across on a phone, 8 across on desktop" shape)
// forces every tile narrower as more columns are demanded, which is exactly
// what was truncating the order amount on a busy table. auto-fill with a
// literal pixel size (not minmax) keeps every tile identically sized and
// just fits more of them on a wider floor instead.
const CARD_WIDTH = 180;

// Every card reserves the same four rows whether or not a given table has
// something to put in them - an idle "Available" table still occupies the
// status/detail/action rows, just with nothing rendered in them, which is
// what keeps every tile on the floor exactly the same height regardless of
// what's actually happening at that table. A previous version of this file
// tried a fixed Card height without reserving that space and had to revert
// to minHeight because content that only some tables have (the detail line,
// the action button) clipped on the ones that had it - this fixes that at
// the root instead of giving up on a fixed height.
const TOP_ZONE_HEIGHT = 78;
const STATUS_ZONE_HEIGHT = 28;
const DETAIL_ZONE_HEIGHT = 18;
const ACTION_ZONE_HEIGHT = 26;
const CARD_HEIGHT = TOP_ZONE_HEIGHT + STATUS_ZONE_HEIGHT + DETAIL_ZONE_HEIGHT + ACTION_ZONE_HEIGHT + 24; // + vertical padding

// Tables with no Floor set (the common case, and the only case for a tenant
// that's never used this) are grouped under this label rather than silently
// dropped from the floor view once at least one other table does have a
// Floor - a table a captain can't find is worse than one under a slightly
// generic header.
const UNASSIGNED_FLOOR_LABEL = "Other Tables";

function TableCard({ table, orders, onTableClick, onQuickAdvance, onAddOrder, onSettleBill, pendingAdvanceOrderIds }) {

    const isOccupied = orders.length > 0;
    const hasMultipleOrders = orders.length > 1;
    // The card can only summarize one status at a glance - with more than
    // one active order at the table, the quick-advance shortcut is
    // ambiguous (which order?), so it's only offered for the single-order
    // case; multiple orders route through the table's chooser dialog
    // instead.
    const primaryOrder = orders[0];
    const nextStatus = isOccupied && !hasMultipleOrders ? getPosForwardStatuses(primaryOrder.OrderStatus, primaryOrder.DeliveryType)[0] : null;
    const combinedTotal = orders.reduce((sum, order) => sum + Number(order.TotalAmount), 0);

    return (

        <Card
            onClick={() => onTableClick(table, orders)}
            sx={{
                position: "relative",
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                cursor: "pointer",
                textAlign: "center",
                border: "2px solid",
                borderColor: isOccupied ? "warning.main" : "success.main",
                bgcolor: isOccupied ? "#FFF8E1" : "#F0FDF4",
                transition: "transform .15s, box-shadow .15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 20px rgba(0,0,0,.08)" }
            }}
        >

            {/* A direct shortcut to start another round on this table -
                previously the only way there was through the details
                dialog, costing staff an extra tap on the single-order case
                that happens on almost every table. Distinct from tapping
                the card body (which opens the existing order/chooser) - the
                tooltip is what disambiguates the two, since both are valid,
                different actions on an occupied table. */}
            {isOccupied && (

                <Tooltip title="Start another order for this table">
                    <IconButton
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            onAddOrder(table);
                        }}
                        sx={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            "&:hover": { bgcolor: "primary.main", color: "#fff" }
                        }}
                    >
                        <AddRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

            )}

            {/* Reaches the table's consolidated bill directly, regardless of
                how many separate rounds/orders it's carrying - staff
                shouldn't have to open the multi-order chooser first just to
                settle up. */}
            {isOccupied && (

                <Tooltip title="Settle bill for this table">
                    <IconButton
                        size="small"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSettleBill(table);
                        }}
                        sx={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            "&:hover": { bgcolor: "primary.main", color: "#fff" }
                        }}
                    >
                        <ReceiptLongRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

            )}

            <Box sx={{ height: TOP_ZONE_HEIGHT, pt: 2, px: 1.5, flexShrink: 0 }}>

                <TableRestaurantRoundedIcon
                    sx={{ fontSize: 30, color: isOccupied ? "warning.main" : "success.main" }}
                />

                <Typography fontWeight={700} sx={{ mt: 0.25, lineHeight: 1.2 }} noWrap>
                    {table.TableName}
                </Typography>

                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                    {table.Capacity ? `Seats ${table.Capacity}` : " "}
                </Typography>

            </Box>

            <Box sx={{ height: STATUS_ZONE_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>

                {hasMultipleOrders ? (

                    <Chip label={`${orders.length} Orders`} color="warning" size="small" />

                ) : isOccupied ? (

                    <Chip
                        label={primaryOrder.OrderStatus}
                        color={POS_STATUS_COLOR[primaryOrder.OrderStatus] || "default"}
                        size="small"
                    />

                ) : (

                    <Chip label="Available" color="success" size="small" />

                )}

            </Box>

            {/* Detail row: order number + amount (or the combined total for
                a multi-order table), blank but still occupying its row
                height for an idle table - this is what keeps that row from
                ever needing to shrink or truncate the amount to fit, which a
                shared, content-sized row would otherwise be tempted to do
                under a taller neighbor. */}
            <Box sx={{ height: DETAIL_ZONE_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", px: 1, width: "100%", flexShrink: 0 }}>

                {hasMultipleOrders ? (

                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        {formatCurrency(combinedTotal)} total
                    </Typography>

                ) : isOccupied ? (

                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                        #{primaryOrder.OrderId} &middot; {formatCurrency(primaryOrder.TotalAmount)}
                    </Typography>

                ) : null}

            </Box>

            {/* Action row: a real next-step control when there is one,
                deliberately styled as a button (bordered, rectangular)
                rather than a status chip (filled, pill-shaped) so the two
                rows above and below it read as "what's true" vs. "what you
                can do about it" at a glance, not two stacked labels. Blank,
                not omitted, when there's nothing to advance. */}
            <Box sx={{ height: ACTION_ZONE_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>

                {nextStatus && (

                    <Button
                        size="small"
                        variant="outlined"
                        disabled={pendingAdvanceOrderIds?.has(primaryOrder.OrderId)}
                        endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={(event) => {
                            event.stopPropagation();
                            onQuickAdvance(primaryOrder.OrderId, nextStatus);
                        }}
                        sx={{ py: 0.25, fontSize: 11.5, lineHeight: 1.3 }}
                    >
                        {nextStatus}
                    </Button>

                )}

            </Box>

        </Card>

    );

}

function TableTiles({ tables, activeOrdersByTable, ...cardHandlers }) {

    return (

        <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, ${CARD_WIDTH}px)`, gap: 2, justifyContent: "start" }}>

            {tables.map((table) => (

                <TableCard
                    key={table.TableId}
                    table={table}
                    orders={activeOrdersByTable.get(table.TableName) || []}
                    {...cardHandlers}
                />

            ))}

        </Box>

    );

}

function PosTableGrid({ tables, activeOrdersByTable, onTableClick, onQuickAdvance, onAddOrder, onSettleBill, pendingAdvanceOrderIds }) {

    if (tables.length === 0) {

        return (
            <EmptyState
                icon={<TableRestaurantRoundedIcon />}
                title="No tables yet"
                description="Add tables under Tables to start seating Dine In orders here."
            />
        );

    }

    const cardHandlers = { onTableClick, onQuickAdvance, onAddOrder, onSettleBill, pendingAdvanceOrderIds };

    // Opt-in grouping: a tenant that's never set a Floor on any table sees
    // exactly the flat grid this always was, not an empty-label section
    // header sitting above the only group there is.
    const hasAnyFloor = tables.some((table) => table.Floor);

    if (!hasAnyFloor) {
        return <TableTiles tables={tables} activeOrdersByTable={activeOrdersByTable} {...cardHandlers} />;
    }

    // Tables arrive pre-sorted by Floor (NULLS LAST) from the backend, so
    // building groups in encounter order naturally puts unassigned tables
    // last without any extra sorting here.
    const groups = new Map();

    tables.forEach((table) => {

        const label = table.Floor || UNASSIGNED_FLOOR_LABEL;
        const existing = groups.get(label) || [];
        groups.set(label, [...existing, table]);

    });

    return (

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

            {[...groups.entries()].map(([floorLabel, floorTables]) => (

                <Box key={floorLabel}>

                    <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 12 }}>
                        {floorLabel}
                    </Typography>

                    <TableTiles tables={floorTables} activeOrdersByTable={activeOrdersByTable} {...cardHandlers} />

                </Box>

            ))}

        </Box>

    );

}

export default PosTableGrid;
