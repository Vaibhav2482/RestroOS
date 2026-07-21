import { Box, Card, Chip, Grid, Typography } from "@mui/material";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";

import { POS_STATUS_COLOR } from "./posOrderStatus";

function PosTableGrid({ tables, activeOrdersByTable, onTableClick }) {

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

                return (

                    <Grid key={table.TableId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>

                        <Card
                            onClick={() => onTableClick(table, activeOrder)}
                            sx={{
                                p: 2.5,
                                cursor: "pointer",
                                textAlign: "center",
                                border: "2px solid",
                                borderColor: isOccupied ? "warning.main" : "success.main",
                                bgcolor: isOccupied ? "#FFF8E1" : "#F0FDF4",
                                transition: "transform .15s",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                minHeight: 160,
                                "&:hover": { transform: "translateY(-2px)" }
                            }}
                        >

                            <TableRestaurantRoundedIcon
                                sx={{ fontSize: 34, color: isOccupied ? "warning.main" : "success.main", mb: 1 }}
                            />

                            <Typography fontWeight={700}>
                                {table.TableName}
                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ minHeight: 18 }}>
                                {table.Capacity ? `Seats ${table.Capacity}` : " "}
                            </Typography>

                            <Box sx={{ mt: 1, minHeight: 40 }}>

                                {isOccupied ? (

                                    <>
                                        <Chip
                                            label={activeOrder.OrderStatus}
                                            color={POS_STATUS_COLOR[activeOrder.OrderStatus] || "default"}
                                            size="small"
                                        />

                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                            #{activeOrder.OrderId} &middot; ₹ {Number(activeOrder.TotalAmount).toFixed(2)}
                                        </Typography>
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
