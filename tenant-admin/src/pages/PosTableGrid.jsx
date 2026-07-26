import { Box, Button, Card, Chip, Grid, Typography } from "@mui/material";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import { POS_STATUS_COLOR, getPosForwardStatuses } from "./posOrderStatus";
import { formatCurrency } from "./orderStatusUtils";

// The single next status only (never skip-ahead) - jumping multiple steps
// or cancelling still requires opening the full order details dialog, so
// this quick action can't be used to fast-forward past a step by mistake.
function PosTableGrid({ tables, activeOrdersByTable, onTableClick, onQuickAdvance }) {

    if (tables.length === 0) {

        return (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
                No active tables set up for this branch yet.
            </Typography>
        );

    }

    return (

        <Grid container spacing={2}>

            {tables.map((table) => {

                const activeOrder = activeOrdersByTable.get(table.TableName);
                const isOccupied = Boolean(activeOrder);
                const nextStatus = isOccupied ? getPosForwardStatuses(activeOrder.OrderStatus)[0] : null;

                return (

                    <Grid key={table.TableId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>

                        {/* A fixed height (not just a floor) is deliberate - an
                            occupied table's extra content (status/price/button)
                            used to grow the card taller than an idle "Available"
                            neighbor, so every table on the floor changed size as
                            orders moved through the kitchen. Fixed top zone
                            (icon/name/seats) plus a fixed-height, vertically
                            centered status zone keeps every card identical
                            regardless of what's happening at that table. */}
                        <Card
                            onClick={() => onTableClick(table, activeOrder)}
                            sx={{
                                height: 208,
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

                                {isOccupied ? (

                                    <>
                                        <Chip
                                            label={activeOrder.OrderStatus}
                                            color={POS_STATUS_COLOR[activeOrder.OrderStatus] || "default"}
                                            size="small"
                                        />

                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: "100%" }}>
                                            #{activeOrder.OrderId} &middot; {formatCurrency(activeOrder.TotalAmount)}
                                        </Typography>

                                        {nextStatus && (

                                            <Button
                                                size="small"
                                                variant="outlined"
                                                endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onQuickAdvance(activeOrder.OrderId, nextStatus);
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
