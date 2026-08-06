import { useEffect, useState } from "react";
import { Box, FormControl, InputLabel, MenuItem, Select, Tab, Tabs, Typography } from "@mui/material";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import { defaultDateRange } from "../utils/dateRange";
import TaxSummaryReportTab from "./TaxSummaryReportTab";
import PaymentBreakdownReportTab from "./PaymentBreakdownReportTab";
import InventoryValuationReportTab from "./InventoryValuationReportTab";
import MenuProfitabilityReportTab from "./MenuProfitabilityReportTab";
import SalesSummaryReportTab from "./SalesSummaryReportTab";
import CategorySalesReportTab from "./CategorySalesReportTab";
import CouponUsageReportTab from "./CouponUsageReportTab";
import CancelledOrdersReportTab from "./CancelledOrdersReportTab";

const TABS = [
    "Sales Summary",
    "Category Sales",
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

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

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
                sx={{ mb: 3, borderBottom: "1px solid #E5E7EB" }}
            >
                {TABS.map((label) => <Tab key={label} label={label} />)}
            </Tabs>

            {tab === 0 && <SalesSummaryReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 1 && <CategorySalesReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 2 && <TaxSummaryReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 3 && <PaymentBreakdownReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 4 && <CouponUsageReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 5 && <CancelledOrdersReportTab branchId={selectedBranchId} range={range} onRangeChange={setRange} />}
            {tab === 6 && <InventoryValuationReportTab branchId={selectedBranchId} />}
            {tab === 7 && <MenuProfitabilityReportTab branchId={selectedBranchId} />}

        </Box>

    );

}

export default Reports;
