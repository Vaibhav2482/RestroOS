import { Box, Button, Card, Chip, IconButton, Grid, Tooltip, Typography } from "@mui/material";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { POS_STATUS_COLOR, getPosForwardStatuses } from "./posOrderStatus";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

// The single next status only (never skip-ahead) - jumping multiple steps
// or cancelling still requires opening the full order details dialog, so
// this quick action can't be used to fast-forward past a step by mistake.
function PosTableGrid({ tables, activeOrdersByTable, onTableClick, onQuickAdvance, onAddOrder, pendingAdvanceOrderIds }) {

    if (tables.length === 0) {

        return (
            <EmptyState
                icon={<TableRestaurantRoundedIcon />}
                title="No tables yet"
                description="Add tables under Tables to start seating Dine In orders here."
            />
        );

    }

    return (

        <Grid container spacing={2}>

            {tables.map((table) => {

                const orders = activeOrdersByTable.get(table.TableName) || [];
                const isOccupied = orders.length > 0;
                const hasMultipleOrders = orders.length > 1;
                // The card can only summarize one status at a glance - with
                // more than one active order at the table, the quick-advance
                // shortcut is ambiguous (which order?), so it's only offered
                // for the single-order case; multiple orders route through
                // the table's chooser dialog instead.
                const primaryOrder = orders[0];
                const nextStatus = isOccupied && !hasMultipleOrders ? getPosForwardStatuses(primaryOrder.OrderStatus)[0] : null;
                const combinedTotal = orders.reduce((sum, order) => sum + Number(order.TotalAmount), 0);

                return (

                    <Grid key={table.TableId} size={{ xs: 4, sm: 3, md: 2, lg: 1.5 }}>

                        {/* A fixed height (not just a floor) is deliberate - an
                            occupied table's extra content (status/price/button)
                            used to grow the card taller than an idle "Available"
                            neighbor, so every table on the floor changed size as
                            orders moved through the kitchen. Fixed top zone
                            (icon/name/seats) plus a fixed-height, vertically
                            centered status zone keeps every card identical
                            regardless of what's happening at that table. */}
                        <Card
                            onClick={() => onTableClick(table, orders)}
                            sx={{
                                position: "relative",
                                // Was 208px in a 6-column-on-phone grid, so seven
                                // tables filled an entire tablet screen. A floor
                                // plan is scanned, not read - the tile only has to
                                // carry a number, a state and (when running) an
                                // amount, which fits comfortably in half that.
                                // minHeight, never a fixed height. Tables that
                                // carry a "Seats N" line have one more row of
                                // content than those that don't, and a fixed box
                                // pushed the status pill outside the card edge on
                                // exactly those. Letting the card grow costs a
                                // little unevenness and cannot clip.
                                minHeight: 138,
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

                            {/* A direct shortcut to start another round on this
                                table - previously the only way there was through
                                the details dialog, costing staff an extra tap on
                                the single-order case that happens on almost every
                                table. */}
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

                            <Box sx={{ pt: 2.5, px: 2 }}>

                                <TableRestaurantRoundedIcon
                                    sx={{ fontSize: 32, color: isOccupied ? "warning.main" : "success.main" }}
                                />

                                <Typography fontWeight={700} sx={{ mt: 0.5 }}>
                                    {table.TableName}
                                </Typography>

                                <Typography variant="caption" color="text.secondary">
                                    {table.Capacity ? `Seats ${table.Capacity}` : " "}
                                </Typography>

                            </Box>

                            <Box
                                sx={{
                                    flex: 1,
                                    width: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.5,
                                    px: 1.5,
                                    pb: 2
                                }}
                            >

                                {hasMultipleOrders ? (

                                    <>
                                        <Chip
                                            label={`${orders.length} Orders`}
                                            color="warning"
                                            size="small"
                                        />

                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: "100%" }}>
                                            {formatCurrency(combinedTotal)} total
                                        </Typography>
                                    </>

                                ) : isOccupied ? (

                                    <>
                                        <Chip
                                            label={primaryOrder.OrderStatus}
                                            color={POS_STATUS_COLOR[primaryOrder.OrderStatus] || "default"}
                                            size="small"
                                        />

                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: "100%" }}>
                                            #{primaryOrder.OrderId} &middot; {formatCurrency(primaryOrder.TotalAmount)}
                                        </Typography>

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
                                                sx={{ mt: 0.25, py: 0.25, fontSize: 11.5, lineHeight: 1.3 }}
                                            >
                                                {nextStatus}
                                            </Button>

                                        )}
                                    </>

                                ) : (

                                    <Chip label="Available" color="success" size="small" />

                                )}

                            </Box>

                        </Card>

                    </Grid>

                );

            })}

        </Grid>

    );

}

export default PosTableGrid;
