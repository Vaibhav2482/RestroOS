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

import * as auditService from "../services/auditService";
import * as adminService from "../services/adminService";
import { ACTION_LABELS, ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS } from "../utils/auditLog";
import EmptyState from "../components/EmptyState";

const formatDateTime = (value) => new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
});

function AuditLog() {

    const [logs, setLogs] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);

    const [entityTypeFilter, setEntityTypeFilter] = useState("all");
    const [actorFilter, setActorFilter] = useState("all");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Client-side paging over the already-fetched (filtered) result set -
    // the backend has no page/limit param on this endpoint.
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        adminService.getAllAdmins()
            .then((response) => { if (response.success) setAdmins(response.data); })
            .catch(() => {});

    }, []);

    useEffect(() => {

        loadLogs();
        setPage(0);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityTypeFilter, actorFilter, fromDate, toDate]);

    const loadLogs = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await auditService.getLogs({
                entityType: entityTypeFilter === "all" ? undefined : entityTypeFilter,
                actorAdminId: actorFilter === "all" ? undefined : actorFilter,
                from: fromDate || undefined,
                to: toDate || undefined
            });

            if (response.success) {
                setLogs(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load the activity log.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    return (

        <Box>

            <Box sx={{ mb: 3 }}>
                <Typography variant="h4">Activity Log</Typography>
                <Typography color="text.secondary">
                    Every staff, coupon, branch, and menu change made in this account, and who made it.
                </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mb: 2 }}>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Type</InputLabel>
                    <Select label="Type" value={entityTypeFilter} onChange={(event) => setEntityTypeFilter(event.target.value)}>
                        <MenuItem value="all">All Types</MenuItem>
                        {Object.entries(ENTITY_TYPE_LABELS).map(([code, label]) => (
                            <MenuItem key={code} value={code}>{label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Staff Member</InputLabel>
                    <Select label="Staff Member" value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
                        <MenuItem value="all">Everyone</MenuItem>
                        {admins.map((admin) => (
                            <MenuItem key={admin.AdminId} value={admin.AdminId}>{admin.FullName}</MenuItem>
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
                                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>What happened</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>By</TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : logs.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={4} sx={{ py: 0 }}>
                                        <EmptyState
                                            icon={<HistoryOutlinedIcon />}
                                            title="No activity found"
                                            description="Try widening the date range or clearing a filter."
                                        />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                logs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((log) => (

                                    <TableRow key={log.AuditLogId} hover>

                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(log.CreatedAt)}</TableCell>

                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={ENTITY_TYPE_LABELS[log.EntityType] || log.EntityType}
                                                color={ENTITY_TYPE_COLORS[log.EntityType] || "default"}
                                                variant="outlined"
                                            />
                                        </TableCell>

                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>
                                                {ACTION_LABELS[log.Action] || log.Action}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {log.Summary}
                                            </Typography>
                                        </TableCell>

                                        <TableCell>{log.ActorType === "System" ? "System" : log.ActorName || "-"}</TableCell>

                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

                {logs.length > 0 && (

                    <TablePagination
                        component="div"
                        count={logs.length}
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

export default AuditLog;
