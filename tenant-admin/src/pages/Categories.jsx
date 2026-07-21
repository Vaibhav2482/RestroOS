import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import toast from "react-hot-toast";

import * as categoryService from "../services/categoryService";
import CategoryDialog from "./CategoryDialog";

function Categories() {

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {

        loadCategories();

    }, []);

    const loadCategories = async () => {

        try {

            setLoading(true);

            const response = await categoryService.getAllCategories();

            if (response.success) {
                setCategories(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load categories.");

        } finally {

            setLoading(false);

        }

    };

    const handleCreate = async (payload) => {

        try {

            const response = await categoryService.createCategory(payload);

            if (response.success) {
                await loadCategories();
                toast.success("Category created successfully.");
                setDialogOpen(false);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create category.");

        }

    };

    const handleUpdate = async (payload) => {

        try {

            const response = await categoryService.updateCategory(selectedCategory.CategoryId, payload);

            if (response.success) {
                await loadCategories();
                toast.success("Category updated successfully.");
                setDialogOpen(false);
                setSelectedCategory(null);
                setIsEditMode(false);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update category.");

        }

    };

    const handleDelete = async () => {

        if (!deleteTarget) {
            return;
        }

        try {

            setDeleting(true);

            const response = await categoryService.deleteCategory(deleteTarget.CategoryId);

            if (response.success) {
                await loadCategories();
                toast.success("Category deleted permanently.");
                setDeleteTarget(null);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to delete category.");

        } finally {

            setDeleting(false);

        }

    };

    const openAddDialog = () => {
        setSelectedCategory(null);
        setIsEditMode(false);
        setDialogOpen(true);
    };

    const openEditDialog = (category) => {
        setSelectedCategory(category);
        setIsEditMode(true);
        setDialogOpen(true);
    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Box>
                    <Typography variant="h4">
                        Categories
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Shared across every branch of your restaurant.
                    </Typography>
                </Box>

                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openAddDialog}>
                    Add Category
                </Button>

            </Box>

            {loading ? (

                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
                    <CircularProgress />
                </Box>

            ) : (

                <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                    <Table>

                        <TableHead>

                            <TableRow>
                                <TableCell>Category Name</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Display Order</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {categories.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">
                                            No categories yet. Add your first one to get started.
                                        </Typography>
                                    </TableCell>
                                </TableRow>

                            ) : (

                                categories.map((category) => (

                                    <TableRow key={category.CategoryId} hover>

                                        <TableCell>
                                            <Typography fontWeight={600}>
                                                {category.CategoryName}
                                            </Typography>
                                        </TableCell>

                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {category.Description || "-"}
                                            </Typography>
                                        </TableCell>

                                        <TableCell>
                                            {category.DisplayOrder}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={category.IsActive ? "Active" : "Inactive"}
                                                color={category.IsActive ? "success" : "default"}
                                                size="small"
                                            />
                                        </TableCell>

                                        <TableCell align="right">

                                            <Tooltip title="Edit">
                                                <IconButton color="primary" onClick={() => openEditDialog(category)}>
                                                    <EditRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>

                                            <Tooltip title="Delete permanently">
                                                <IconButton color="error" onClick={() => setDeleteTarget(category)}>
                                                    <DeleteRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>

                                        </TableCell>

                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            )}

            <CategoryDialog
                open={dialogOpen}
                onClose={() => {
                    setDialogOpen(false);
                    setSelectedCategory(null);
                    setIsEditMode(false);
                }}
                onSave={isEditMode ? handleUpdate : handleCreate}
                selectedCategory={selectedCategory}
                isEditMode={isEditMode}
            />

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">

                <DialogTitle>
                    Delete Category
                </DialogTitle>

                <DialogContent>

                    <Typography>
                        Are you sure you want to delete <strong>{deleteTarget?.CategoryName}</strong>?
                    </Typography>

                    <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                        This is permanent and cannot be undone — unlike other pages, there is no
                        way to restore a deleted category.
                    </Typography>

                </DialogContent>

                <DialogActions>

                    <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
                        Cancel
                    </Button>

                    <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
                        Delete Permanently
                    </Button>

                </DialogActions>

            </Dialog>

        </Box>

    );

}

export default Categories;
