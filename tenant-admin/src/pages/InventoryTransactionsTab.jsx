import { useEffect, useRef, useState } from "react";
import {
    Box,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import toast from "react-hot-toast";

import * as inventoryService from "../services/inventoryService";
import * as ingredientService from "../services/ingredientService";
import { TRANSACTION_TYPE_COLORS, TRANSACTION_TYPE_LABELS } from "../utils/units";
import EmptyState from "../components/EmptyState";

const formatDateTime = (value) => new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
});

const referenceLabel = (row) => {

    if (!row.ReferenceType || !row.ReferenceId) {
        return "-";
    }

    return row.ReferenceType === "ORDER" ? `Order #${row.ReferenceId}` : `${row.ReferenceType} #${row.ReferenceId}`;

};

function InventoryTransactionsTab({ branchId }) {

    const [transactions, setTransactions] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);

    const [ingredientFilter, setIngredientFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Real server-side paging now - a busy branch writes a CONSUMPTION row
    // on every order, so the backend no longer hands back a flat "first 200
    // rows, take it or leave it"; each page is its own request, and
    // TablePagination's count reflects the true filtered total instead of
    // however many of a 200-row cap happened to match.
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const hasLoadedRef = useRef(false);
    // Tracks the filter values as of the last completed load, so a filter
    // change can be told apart from a plain page/rowsPerPage change - only
    // the former should reset back to page 0. Comparing against this
    // (rather than depending on `page` conditionally) is what lets a single
    // effect handle both without either double-fetching or missing a page
    // change entirely.
    const lastFiltersRef = useRef({ ingredientFilter, typeFilter, fromDate, toDate });

    useEffect(() => {

        ingredientService.getAllIngredients()
            .then((response) => { if (response.success) setIngredients(response.data); })
            .catch(() => {});

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        const previous = lastFiltersRef.current;
        const filtersChanged = previous.ingredientFilter !== ingredientFilter ||
            previous.typeFilter !== typeFilter || previous.fromDate !== fromDate || previous.toDate !== toDate;

        lastFiltersRef.current = { ingredientFilter, typeFilter, fromDate, toDate };

        // Bail without fetching - the page=0 update below re-triggers this
        // same effect, which will then fall through to the fetch exactly
        // once instead of firing here too with the stale page number.
        if (filtersChanged && page !== 0) {
            setPage(0);
            return;
        }

        if (branchId) {
            loadTransactions();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, ingredientFilter, typeFilter, fromDate, toDate, page, rowsPerPage]);

    const loadTransactions = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await inventoryService.getTransactions(branchId, {
                ingredientId: ingredientFilter === "all" ? undefined : ingredientFilter,
                transactionType: typeFilter === "all" ? undefined : typeFilter,
                from: fromDate || undefined,
                to: toDate || undefined,
                page,
                limit: rowsPerPage
            });

            if (response.success) {
                setTransactions(response.data.transactions);
                setTotalCount(response.data.totalCount);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load transactions.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mb: 2 }}>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Ingredient</InputLabel>
                    <Select label="Ingredient" value={ingredientFilter} onChange={(event) => setIngredientFilter(event.target.value)}>
                        <MenuItem value="all">All Ingredients</MenuItem>
                        {ingredients.map((ingredient) => (
                            <MenuItem key={ingredient.IngredientId} value={ingredient.IngredientId}>{ingredient.Name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Type</InputLabel>
                    <Select label="Type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                        <MenuItem value="all">All Types</MenuItem>
                        {Object.entries(TRANSACTION_TYPE_LABELS).map(([code, label]) => (
                            <MenuItem key={code} value={code}>{label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField
                    size="small"
                    type="date"
                    label="From"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                />

                <TextField
                    size="small"
                    type="date"
                    label="To"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                />

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table size="small">

                        <TableHead>

                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Ingredient</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Quantity</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Balance</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Reference</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>By</TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : totalCount === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={7} sx={{ py: 0 }}>
                                        <EmptyState
                                            icon={<HistoryOutlinedIcon />}
                                            title="No stock movements found"
                                            description="Try widening the date range or clearing a filter."
                                        />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                transactions.map((row) => (

                                    <TableRow key={row.TransactionId} hover>

                                        <TableCell>{formatDateTime(row.CreatedAt)}</TableCell>

                                        <TableCell>{row.IngredientName}</TableCell>

                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={TRANSACTION_TYPE_LABELS[row.TransactionType] || row.TransactionType}
                                                color={TRANSACTION_TYPE_COLORS[row.TransactionType] || "default"}
                                                variant="outlined"
                                            />
                                        </TableCell>

                                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                            {Number(row.QuantityBase) > 0 ? "+" : Number(row.QuantityBase) < 0 ? "-" : ""}{Number(row.EnteredQuantity)} {row.EnteredUnit}
                                        </TableCell>

                                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                            {row.PriorQuantityBase !== null
                                                ? `${Number(row.PriorQuantityBase)} → ${Number(row.PostQuantityBase)} ${row.BaseUnit}`
                                                : "-"}
                                        </TableCell>

                                        <TableCell>{referenceLabel(row)}</TableCell>

                                        <TableCell>{row.ActorType === "System" ? "System" : row.ActorName || "-"}</TableCell>

                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

                {totalCount > 0 && (

                    <TablePagination
                        component="div"
                        count={totalCount}
                        page={page}
                        onPageChange={(event, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(Number(event.target.value));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                    />

                )}

            </Paper>

        </Box>

    );

}

export default InventoryTransactionsTab;
