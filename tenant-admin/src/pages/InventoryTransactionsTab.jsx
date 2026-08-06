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
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);

    const [ingredientFilter, setIngredientFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Client-side paging over the already-fetched (filtered) result set -
    // the backend has no page/limit param on this endpoint.
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        ingredientService.getAllIngredients()
            .then((response) => { if (response.success) setIngredients(response.data); })
            .catch(() => {});

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        if (branchId) {
            loadTransactions();
        }

        setPage(0);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, ingredientFilter, typeFilter, fromDate, toDate]);

    const loadTransactions = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await inventoryService.getTransactions(branchId, {
                ingredientId: ingredientFilter === "all" ? undefined : ingredientFilter,
                transactionType: typeFilter === "all" ? undefined : typeFilter,
                from: fromDate || undefined,
                to: toDate || undefined
            });

            if (response.success) {
                setTransactions(response.data);
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
                    InputLabelProps={{ shrink: true }}
                />

                <TextField
                    size="small"
                    type="date"
                    label="To"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    InputLabelProps={{ shrink: true }}
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

                            ) : transactions.length === 0 ? (

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

                                transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row) => (

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

                {transactions.length > 0 && (

                    <TablePagination
                        component="div"
                        count={transactions.length}
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
