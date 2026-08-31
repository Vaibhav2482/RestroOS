import { useCallback, useEffect, useRef, useState } from "react";
import {
    Box,
    CircularProgress,
    FormControl,
    InputAdornment,
    MenuItem,
    Pagination,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import toast from "react-hot-toast";

import * as customerService from "../services/customerService";
import EmptyState from "../components/EmptyState";
import CustomerDetailDialog from "./CustomerDetailDialog";
import { formatCurrency } from "./orderStatusUtils";

function Customers() {

    const [customers, setCustomers] = useState([]);
    // Server-reported total for the current filtered set (not
    // customers.length, which is just the current page) - drives the
    // pagination footer, same as Orders.jsx's totalCount.
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [search, setSearch] = useState("");
    // The value actually sent to the server - updated 400ms after typing
    // stops, so a server-filtered search doesn't fire a request per
    // keystroke.
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        const timeout = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timeout);

    }, [search]);

    // Keep the page in range whenever the search term changes - otherwise a
    // search that shrinks the result set can leave the user stranded on an
    // empty page.
    useEffect(() => {

        setPage((prev) => (prev === 0 ? prev : 0));

    }, [debouncedSearch]);

    const loadCustomers = useCallback(async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await customerService.getAllCustomers({
                page: page + 1, // server is 1-indexed
                limit: rowsPerPage,
                search: debouncedSearch.trim() || undefined
            });

            if (response.success) {
                setCustomers(response.data.customers);
                setTotalCount(response.data.total);
            } else {
                toast.error(response.message || "Failed to load customers.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load customers.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    }, [page, rowsPerPage, debouncedSearch]);

    useEffect(() => {

        loadCustomers();

    }, [loadCustomers]);

    const handleRowClick = (customer) => {
        setSelectedCustomer(customer);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setSelectedCustomer(null);
    };

    const hasActiveSearch = Boolean(debouncedSearch.trim());

    return (

        <Box>

            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 3 }}>

                <Typography variant="h4" sx={{ flexShrink: 0 }}>Customers</Typography>

                <TextField
                    size="small"
                    placeholder="Search by name, phone or email"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRoundedIcon fontSize="small" sx={{ color: "text.disabled" }} />
                                </InputAdornment>
                            )
                        }
                    }}
                    sx={{ flexGrow: 1, minWidth: 240, maxWidth: 340 }}
                />

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>

                {loading ? (

                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexGrow: 1, py: 8 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : (

                    <TableContainer sx={{ maxHeight: { xs: "none", md: "calc(100vh - 120px)" }, flexGrow: 1 }}>

                        <Table stickyHeader size="small">

                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }} align="right">Orders</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }} align="right">Total Spent</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Joined</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>

                                {customers.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ py: 0 }}>
                                            <EmptyState
                                                icon={<PersonOutlineOutlinedIcon />}
                                                title={hasActiveSearch ? "No customers match your search" : "No customers yet"}
                                                description={hasActiveSearch ? "Try a different name, phone, or email." : "Customers appear here once they place their first order."}
                                            />
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    customers.map((customer) => (

                                        <TableRow key={customer.CustomerId} hover sx={{ cursor: "pointer" }} onClick={() => handleRowClick(customer)}>
                                            <TableCell>
                                                <Typography fontWeight={600}>{customer.FullName}</Typography>
                                            </TableCell>
                                            <TableCell>{customer.Phone || "-"}</TableCell>
                                            <TableCell>{customer.Email || "-"}</TableCell>
                                            <TableCell align="right">{customer.OrderCount}</TableCell>
                                            <TableCell align="right">{formatCurrency(customer.TotalSpent)}</TableCell>
                                            <TableCell>{new Date(customer.CreatedAt).toLocaleDateString()}</TableCell>
                                        </TableRow>

                                    ))

                                )}

                            </TableBody>

                        </Table>

                    </TableContainer>

                )}

                {!loading && totalCount > 0 && (

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 1,
                            borderTop: "1px solid #E5E7EB",
                            bgcolor: "#FAFAFB",
                            pl: 2
                        }}
                    >

                        <Typography variant="body2" color="text.secondary">
                            Showing {Math.min(page * rowsPerPage + 1, totalCount)}–{Math.min((page + 1) * rowsPerPage, totalCount)} of {totalCount} customer{totalCount === 1 ? "" : "s"}
                        </Typography>

                        <Stack direction="row" spacing={2.5} alignItems="center" sx={{ py: 1 }}>

                            <FormControl size="small" variant="standard">

                                <Select
                                    value={rowsPerPage}
                                    onChange={(event) => {
                                        setRowsPerPage(Number(event.target.value));
                                        setPage(0);
                                    }}
                                    disableUnderline
                                >

                                    {[10, 25, 50, 100, 200].map((option) => (
                                        <MenuItem key={option} value={option}>{option} / page</MenuItem>
                                    ))}

                                </Select>

                            </FormControl>

                            <Pagination
                                count={Math.max(1, Math.ceil(totalCount / rowsPerPage))}
                                page={page + 1}
                                onChange={(event, newPage) => setPage(newPage - 1)}
                                color="primary"
                                shape="rounded"
                                size="small"
                                showFirstButton
                                showLastButton
                                siblingCount={1}
                                boundaryCount={1}
                            />

                        </Stack>

                    </Box>

                )}

            </Paper>

            <CustomerDetailDialog
                open={dialogOpen}
                customer={selectedCustomer}
                onClose={handleDialogClose}
            />

        </Box>

    );

}

export default Customers;
