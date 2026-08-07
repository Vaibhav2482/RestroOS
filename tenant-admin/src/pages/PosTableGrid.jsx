import { motion } from "framer-motion";
import { Table2, Users, Plus, ArrowRight } from "lucide-react";

import { cn } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { POS_STATUS_COLOR, getPosForwardStatuses } from "./posOrderStatus";
import { formatCurrency } from "./orderStatusUtils";

const STATUS_BADGE_VARIANT = {
    success: "success",
    warning: "warning",
    error: "destructive",
    default: "outline"
};

// The single next status only (never skip-ahead) - jumping multiple steps
// or cancelling still requires opening the full order details dialog, so
// this quick action can't be used to fast-forward past a step by mistake.
function PosTableGrid({ tables, activeOrdersByTable, onTableClick, onQuickAdvance, onAddOrder, pendingAdvanceOrderIds }) {

    if (tables.length === 0) {

        return (

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Table2 className="h-6 w-6" />
                </div>
                <p className="font-semibold text-foreground">No tables yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                    Add tables under Tables to start seating Dine In orders here.
                </p>
            </div>

        );

    }

    return (

        <TooltipProvider delayDuration={200}>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">

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
                    const statusVariant = STATUS_BADGE_VARIANT[POS_STATUS_COLOR[primaryOrder?.OrderStatus] || "default"];

                    return (

                        <motion.div
                            key={table.TableId}
                            whileHover={{ y: -4 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            onClick={() => onTableClick(table, orders)}
                            className={cn(
                                "group relative flex h-52 cursor-pointer flex-col items-center rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg",
                                isOccupied ? "border-l-4 border-l-warning border-y-border border-r-border" : "border-l-4 border-l-success border-y-border border-r-border"
                            )}
                        >

                            {/* A direct shortcut to start another round on this
                                table - previously the only way there was through
                                the details dialog, costing staff an extra tap on
                                the single-order case that happens on almost every
                                table. */}
                            {isOccupied && (

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onAddOrder(table);
                                            }}
                                            className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-all hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Start another order for this table</TooltipContent>
                                </Tooltip>

                            )}

                            <div className="flex flex-col items-center pt-6">

                                <div className={cn(
                                    "flex h-11 w-11 items-center justify-center rounded-2xl",
                                    isOccupied ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                                )}>
                                    <Table2 className="h-5 w-5" />
                                </div>

                                <p className="mt-2 font-bold text-foreground">{table.TableName}</p>

                                {table.Capacity && (
                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Users className="h-3 w-3" /> Seats {table.Capacity}
                                    </p>
                                )}

                            </div>

                            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-3 pb-4">

                                {hasMultipleOrders ? (

                                    <>
                                        <Badge variant="warning">{orders.length} Orders</Badge>
                                        <p className="max-w-full truncate text-xs text-muted-foreground">
                                            {formatCurrency(combinedTotal)} total
                                        </p>
                                    </>

                                ) : isOccupied ? (

                                    <>
                                        <Badge variant={statusVariant}>{primaryOrder.OrderStatus}</Badge>

                                        <p className="max-w-full truncate text-xs text-muted-foreground">
                                            #{primaryOrder.OrderId} &middot; {formatCurrency(primaryOrder.TotalAmount)}
                                        </p>

                                        {nextStatus && (

                                            <button
                                                type="button"
                                                disabled={pendingAdvanceOrderIds?.has(primaryOrder.OrderId)}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onQuickAdvance(primaryOrder.OrderId, nextStatus);
                                                }}
                                                className="mt-0.5 flex items-center gap-0.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                                            >
                                                {nextStatus} <ArrowRight className="h-3 w-3" />
                                            </button>

                                        )}
                                    </>

                                ) : (

                                    <Badge variant="success">Available</Badge>

                                )}

                            </div>

                        </motion.div>

                    );

                })}

            </div>

        </TooltipProvider>

    );

}

export default PosTableGrid;
