import { useEffect, useState } from "react";
import {
    Box,
    CircularProgress,
    InputAdornment,
    Paper,
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
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import toast from "react-hot-toast";

import * as customerService from "../services/customerService";
import EmptyState from "../components/EmptyState";
import CustomerDetailDialog from "./CustomerDetailDialog";
import { formatCurrency } from "./orderStatusUtils";

function Customers() {

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Client-side paging/search over the already-fetched list - the backend
    // has no page/limit/search param on GET /customers.
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    useEffect(() => {

        loadCustomers();

    }, []);

    const loadCustomers = async () => {

        try {

            setLoading(true);

            const response = await customerService.getAllCustomers();

            if (response.success) {
                setCustomers(response.data);
            } else {
                toast.error(response.message || "Failed to load customers.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load customers.");

        } finally {

            setLoading(false);

        }

    };

    const handleRowClick = (customer) => {
        setSelectedCustomer(customer);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setSelectedCustomer(null);
    };

    const searchTerm = search.trim().toLowerCase();

    const filteredCustomers = customers.filter((customer) => {

        if (!searchTerm) {
            return true;
        }

        return (
            customer.FullName?.toLowerCase().includes(searchTerm) ||
            customer.Phone?.toLowerCase().includes(searchTerm) ||
            customer.Email?.toLowerCase().includes(searchTerm)
        );

    });

    const pagedCustomers = filteredCustomers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Typography variant="h4">Customers</Typography>

                <TextField
                    size="small"
                    placeholder="Search by name, phone or email"
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                    }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchRoundedIcon fontSize="small" />
                                </InputAdornment>
                            )
                        }
                    }}
                    sx={{ minWidth: 280 }}
                />

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

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

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : filteredCustomers.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={6} sx={{ py: 0 }}>
                                        <EmptyState
                                            icon={<PersonOutlineOutlinedIcon />}
                                            title={customers.length === 0 ? "No customers yet" : "No customers match your search"}
                                            description={customers.length === 0 ? "Customers appear here once they place their first order." : "Try a different name, phone, or email."}
                                        />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                pagedCustomers.map((customer) => (

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

                {!loading && filteredCustomers.length > 0 && (

                    <TablePagination
                        component="div"
                        count={filteredCustomers.length}
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

            <CustomerDetailDialog
                open={dialogOpen}
                customer={selectedCustomer}
                onClose={handleDialogClose}
            />

        </Box>

    );

}

export default Customers;
