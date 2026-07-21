import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
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
    Tooltip,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import toast from "react-hot-toast";

import * as menuService from "../services/menuService";
import * as categoryService from "../services/categoryService";
import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import MenuItemDialog from "./MenuItemDialog";
import MenuItemOptionsDialog from "./MenuItemOptionsDialog";

function ItemThumbnail({ imageUrl, itemName }) {

    if (imageUrl) {

        return (
            <Box
                component="img"
                src={imageUrl}
                alt={itemName}
                sx={{ width: 48, height: 48, borderRadius: 1.5, objectFit: "cover", border: "1px solid #E5E7EB", flexShrink: 0 }}
            />
        );

    }

    return (
        <Box
            sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                border: "1px solid #E5E7EB",
                bgcolor: "#F5F6FA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
            }}
        >
            <RestaurantOutlinedIcon sx={{ color: "#C7CBD6", fontSize: 22 }} />
        </Box>
    );

}

function Menu() {

    const { admin } = getStoredAuth() || {};
    const owner = isOwner(admin);

    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(owner ? "" : admin?.BranchId ?? "");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [searchText, setSearchText] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
    const [optionsTarget, setOptionsTarget] = useState(null);

    useEffect(() => {

        loadCategories();

        if (owner) {
            loadBranches();
        } else {
            loadMenuItems();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        if (owner && selectedBranchId) {
            loadMenuItems(selectedBranchId);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    const loadBranches = async () => {

        try {

            const response = await branchService.getAllBranches();

            if (response.success) {

                setBranches(response.data);

                if (response.data.length > 0) {
                    setSelectedBranchId(response.data[0].BranchId);
                } else {
                    setLoading(false);
                }

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load branches.");
            setLoading(false);

        }

    };

    const loadCategories = async () => {

        try {

            const response = await categoryService.getAllCategories();

            if (response.success) {
                setCategories(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load categories.");

        }

    };

    const loadMenuItems = async (branchId) => {

        try {

            setLoading(true);

            const response = await menuService.getAllMenuItems(branchId);

            if (response.success) {
                setMenuItems(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load menu items.");

        } finally {

            setLoading(false);

        }

    };

    const handleAddClick = () => {
        setEditingItem(null);
        setDialogOpen(true);
    };

    const handleEditClick = (item) => {
        setEditingItem(item);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        if (saving) return;
        setDialogOpen(false);
        setEditingItem(null);
    };

    const handleSave = async (payload) => {

        try {

            setSaving(true);

            const response = editingItem
                ? await menuService.updateMenuItem(editingItem.MenuItemId, payload)
                : await menuService.createMenuItem(
                    owner ? { ...payload, branchId: selectedBranchId } : payload
                );

            if (response.success) {

                toast.success(editingItem ? "Menu item updated." : "Menu item created.");
                setDialogOpen(false);
                setEditingItem(null);
                await loadMenuItems(owner ? selectedBranchId : undefined);

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Something went wrong.");

        } finally {

            setSaving(false);

        }

    };

    const handleDeleteClick = (item) => {
        setDeleteTarget(item);
    };

    const handleManageOptionsClick = (item) => {
        setOptionsTarget(item);
        setOptionsDialogOpen(true);
    };

    const handleOptionsDialogClose = () => {
        setOptionsDialogOpen(false);
        setOptionsTarget(null);
    };

    const handleDeleteConfirm = async () => {

        if (!deleteTarget) return;

        try {

            setDeleting(true);

            const response = await menuService.deleteMenuItem(deleteTarget.MenuItemId);

            if (response.success) {

                toast.success("Menu item deleted.");
                setDeleteTarget(null);
                await loadMenuItems(owner ? selectedBranchId : undefined);

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to delete menu item.");

        } finally {

            setDeleting(false);

        }

    };

    const filteredItems = useMemo(() => {

        return menuItems.filter((item) => {

            const matchesSearch = item.ItemName.toLowerCase().includes(searchText.trim().toLowerCase());
            const matchesCategory = categoryFilter === "all" ? true : item.CategoryId === categoryFilter;

            return matchesSearch && matchesCategory;

        });

    }, [menuItems, searchText, categoryFilter]);

    const groupedItems = useMemo(() => {

        const groups = new Map();

        filteredItems.forEach((item) => {

            const key = item.CategoryName || "Uncategorized";

            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key).push(item);

        });

        return Array.from(groups.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([categoryName, items]) => [
                categoryName,
                [...items].sort((a, b) => a.ItemName.localeCompare(b.ItemName))
            ]);

    }, [filteredItems]);

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Typography variant="h4">
                    Menu
                </Typography>

                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleAddClick}>
                    Add Item
                </Button>

            </Box>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mb: 3 }}>

                {owner && (

                    <FormControl size="small" sx={{ minWidth: 220 }}>

                        <InputLabel>Branch</InputLabel>

                        <Select
                            label="Branch"
                            value={selectedBranchId}
                            onChange={(event) => setSelectedBranchId(event.target.value)}
                        >

                            {branches.map((branch) => (

                                <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                    {branch.BranchName}
                                </MenuItem>

                            ))}

                        </Select>

                    </FormControl>

                )}

                <TextField
                    size="small"
                    placeholder="Search items..."
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    sx={{ minWidth: 220 }}
                />

                <FormControl size="small" sx={{ minWidth: 220 }}>

                    <InputLabel>Category</InputLabel>

                    <Select
                        label="Category"
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                    >

                        <MenuItem value="all">All Categories</MenuItem>

                        {categories.map((category) => (

                            <MenuItem key={category.CategoryId} value={category.CategoryId}>
                                {category.CategoryName}
                            </MenuItem>

                        ))}

                    </Select>

                </FormControl>

            </Box>

            {loading ? (

                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress />
                </Box>

            ) : groupedItems.length === 0 ? (

                <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", p: 6, textAlign: "center" }}>

                    <Typography color="text.secondary">
                        No menu items found.
                    </Typography>

                </Paper>

            ) : (

                <Stack spacing={3}>

                    {groupedItems.map(([categoryName, items]) => (

                        <Box key={categoryName}>

                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                                {categoryName}
                            </Typography>

                            <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                                <Table size="small">

                                    <TableHead>

                                        <TableRow>
                                            <TableCell sx={{ width: 64 }} />
                                            <TableCell>Item Name</TableCell>
                                            <TableCell>Price</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>

                                    </TableHead>

                                    <TableBody>

                                        {items.map((item) => (

                                            <TableRow key={item.MenuItemId} hover>

                                                <TableCell>
                                                    <ItemThumbnail imageUrl={item.ImageUrl} itemName={item.ItemName} />
                                                </TableCell>

                                                <TableCell>

                                                    <Stack direction="row" spacing={1} alignItems="center">

                                                        <Tooltip title={item.IsVeg ? "Veg" : "Non-Veg"}>
                                                            <Box
                                                                sx={{
                                                                    width: 12,
                                                                    height: 12,
                                                                    borderRadius: "3px",
                                                                    border: `1.5px solid ${item.IsVeg ? "#2E7D32" : "#C62828"}`,
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        width: 6,
                                                                        height: 6,
                                                                        borderRadius: "50%",
                                                                        backgroundColor: item.IsVeg ? "#2E7D32" : "#C62828"
                                                                    }}
                                                                />
                                                            </Box>
                                                        </Tooltip>

                                                        <Typography fontWeight={600}>
                                                            {item.ItemName}
                                                        </Typography>

                                                    </Stack>

                                                    {item.Description && (

                                                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                                                            {item.Description}
                                                        </Typography>

                                                    )}

                                                </TableCell>

                                                <TableCell>
                                                    &#8377;{Number(item.Price).toFixed(2)}
                                                </TableCell>

                                                <TableCell>

                                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>

                                                        <Chip
                                                            size="small"
                                                            label={item.IsAvailable ? "Available" : "Unavailable"}
                                                            color={item.IsAvailable ? "success" : "default"}
                                                            variant={item.IsAvailable ? "filled" : "outlined"}
                                                        />

                                                        {item.IsPopular && (
                                                            <Chip size="small" label="Popular" color="warning" />
                                                        )}

                                                        <Chip
                                                            size="small"
                                                            label={item.IsActive ? "Active" : "Inactive"}
                                                            color={item.IsActive ? "primary" : "default"}
                                                            variant={item.IsActive ? "filled" : "outlined"}
                                                        />

                                                    </Stack>

                                                </TableCell>

                                                <TableCell align="right">

                                                    <Tooltip title="Manage Options">
                                                        <IconButton size="small" onClick={() => handleManageOptionsClick(item)}>
                                                            <TuneOutlinedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Edit">
                                                        <IconButton size="small" onClick={() => handleEditClick(item)}>
                                                            <EditRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Delete">
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(item)}>
                                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>

                                                </TableCell>

                                            </TableRow>

                                        ))}

                                    </TableBody>

                                </Table>

                            </TableContainer>

                        </Box>

                    ))}

                </Stack>

            )}

            <MenuItemDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                onSave={handleSave}
                categories={categories}
                editingItem={editingItem}
                saving={saving}
            />

            <MenuItemOptionsDialog
                open={optionsDialogOpen}
                onClose={handleOptionsDialogClose}
                menuItem={optionsTarget}
            />

            <Dialog open={Boolean(deleteTarget)} onClose={() => (!deleting ? setDeleteTarget(null) : null)}>

                <DialogTitle>
                    Delete Menu Item
                </DialogTitle>

                <DialogContent>

                    <DialogContentText>
                        Are you sure you want to delete "{deleteTarget?.ItemName}"? This action is permanent and cannot be undone.
                    </DialogContentText>

                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2.5 }}>

                    <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
                        Cancel
                    </Button>

                    <Button variant="contained" color="error" onClick={handleDeleteConfirm} disabled={deleting}>
                        {deleting ? "Deleting..." : "Delete"}
                    </Button>

                </DialogActions>

            </Dialog>

        </Box>

    );

}

export default Menu;
