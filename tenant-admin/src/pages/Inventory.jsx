import { useEffect, useState } from "react";
import { Box, FormControl, InputLabel, MenuItem, Select, Tab, Tabs, Typography } from "@mui/material";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";
import { hasPermission, isOwner } from "../utils/adminAuth";
import { useStoredAuth } from "../hooks/useStoredAuth";
import InventoryDashboardTab from "./InventoryDashboardTab";
import IngredientsTab from "./IngredientsTab";
import BranchStockTab from "./BranchStockTab";
import InventoryTransactionsTab from "./InventoryTransactionsTab";

const TABS = ["Dashboard", "Ingredients", "Branch Stock", "Transactions"];

function Inventory() {

    const { admin } = useStoredAuth() || {};
    const owner = isOwner(admin);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(owner ? "" : admin?.BranchId ?? "");
    const [tab, setTab] = useState(0);

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
                    <Typography variant="h4">Inventory</Typography>
                    <Typography color="text.secondary">
                        Track ingredient stock, recipes, and every stock movement across your kitchen.
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
                sx={{ mb: 3, borderBottom: "1px solid #E5E7EB" }}
            >
                {TABS.map((label) => <Tab key={label} label={label} />)}
            </Tabs>

            {tab === 0 && <InventoryDashboardTab branchId={selectedBranchId} onNavigate={setTab} />}
            {tab === 1 && <IngredientsTab canManage={hasPermission(admin, "manage_ingredients")} />}
            {tab === 2 && <BranchStockTab branchId={selectedBranchId} />}
            {tab === 3 && <InventoryTransactionsTab branchId={selectedBranchId} />}

        </Box>

    );

}

export default Inventory;
