import { useEffect, useState } from "react";
import { Box, FormControl, InputLabel, MenuItem, Select, Tab, Tabs, Typography } from "@mui/material";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { defaultDateRange, toDateInputValue } from "../utils/dateRange";
import DayEndReportTab from "./DayEndReportTab";
import TaxSummaryReportTab from "./TaxSummaryReportTab";
import PaymentBreakdownReportTab from "./PaymentBreakdownReportTab";
import InventoryValuationReportTab from "./InventoryValuationReportTab";
import MenuProfitabilityReportTab from "./MenuProfitabilityReportTab";
import SalesSummaryReportTab from "./SalesSummaryReportTab";
import CategorySalesReportTab from "./CategorySalesReportTab";
import StaffSalesReportTab from "./StaffSalesReportTab";
import CouponUsageReportTab from "./CouponUsageReportTab";
import CancelledOrdersReportTab from "./CancelledOrdersReportTab";

const TABS = [
    "Day-End Report",
    "Sales Summary",
    "Category Sales",
    "Staff Sales",
    "Tax Summary",
    "Payment Breakdown",
    "Coupon Usage",
    "Cancelled Orders",
    "Inventory Valuation",
    "Menu Profitability"
];

function Reports() {

    const { admin } = getStoredAuth() || {};
    const owner = isOwner(admin);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(owner ? "" : admin?.BranchId ?? "");
    const [tab, setTab] = useState(0);
    // Shared across every date-ranged tab below so switching tabs keeps
    // whatever range the owner picked instead of silently resetting it back
    // to the last-30-days default each time.
    const [range, setRange] = useState(() => defaultDateRange(30));
    // Day-End Report is a single calendar day, not a range - its own state,
    // defaulting to today.
    const [dayEndDate, setDayEndDate] = useState(() => toDateInputValue(new Date()));

    useEffect(() => {

        if (owner) {
            loadBranches();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadBranches = async () => {

        try {

            const response = await branchService.getAllBranches();

            if (response.success) {

                setBranches(response.data);

                if (response.data.length > 0) {
                    setSelectedBranchId(response.data[0].BranchId);
                }

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load branches.");

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2, "@media print": { display: "none" } }}>

                <Box>
                    <Typography variant="h4">Reports</Typography>
                    <Typography color="text.secondary">
                        Tax filing, cash-up reconciliation, stock value, and menu margins - exportable for your accountant.
                    </Typography>
                </Box>

                {owner && (

                    <FormControl size="small" sx={{ minWidth: 220 }}>

                        <InputLabel>Branch</InputLabel>

                        <Select
                            label="Branch"
                            value={selectedBranchId}
                            onChange={(event) => setSelectedBranchId(event.target.value)}
                        >

                            {branches.map((branch) => (
                                <MenuItem key={branch.BranchId} value={branch.BranchId}>{branch.BranchName}</MenuItem>
                            ))}

                        </Select>

                    </FormControl>

                )}

            </Box>

            <Tabs
                value={tab}
                onChange={(event, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                    mb: 3,
                    borderBottom: "1px solid #E5E7EB",
                    minHeight: 44,
                    // This many report tabs don't all fit at typical desktop
                    // widths - without this, the tab straddling the scroll
                    // edge gets hard-clipped mid-word (a bare "M" of "Menu
                    // Profitability") instead of fading out cleanly.
                    "& .MuiTabs-scroller": {
                        maskImage: "linear-gradient(to right, #000 calc(100% - 32px), transparent)",
                        WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 32px), transparent)"
                    },
                    "& .MuiTab-root": {
                        minHeight: 44,
                        textTransform: "none",
                        fontWeight: 600
                    },
                    "@media print": { display: "none" }
                }}
            >
                {TABS.map((label) => <Tab key={label} label={label} />)}
            </Tabs>

            {tab === 0 && <DayEndReportTab branchId={selectedBranchId} date={dayEndDate} onDateChange={setDayEndDate} />}
            {tab === 1 && <SalesSummaryReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 2 && <CategorySalesReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 3 && <StaffSalesReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 4 && <TaxSummaryReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 5 && <PaymentBreakdownReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 6 && <CouponUsageReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 7 && <CancelledOrdersReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 8 && <InventoryValuationReportTab branchId={selectedBranchId} />}
            {tab === 9 && <MenuProfitabilityReportTab branchId={selectedBranchId} />}

        </Box>

    );

}

export default Reports;
