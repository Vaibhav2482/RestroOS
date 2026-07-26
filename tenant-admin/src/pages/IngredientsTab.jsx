import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
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
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import toast from "react-hot-toast";

import * as ingredientService from "../services/ingredientService";
import { unitLabel } from "../utils/units";
import IngredientDialog from "./IngredientDialog";
import EmptyState from "../components/EmptyState";

function IngredientsTab({ owner }) {

    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingIngredient, setEditingIngredient] = useState(null);
    const [saving, setSaving] = useState(false);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        loadIngredients();

    }, []);

    const loadIngredients = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await ingredientService.getAllIngredients();

            if (response.success) {
                setIngredients(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load ingredients.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleOpenCreate = () => {
        setEditingIngredient(null);
        setDialogOpen(true);
    };

    const handleOpenEdit = (ingredient) => {
        setEditingIngredient(ingredient);
        setDialogOpen(true);
    };

    const handleClose = () => {
        setDialogOpen(false);
        setEditingIngredient(null);
    };

    const handleSave = async (formData) => {

        try {

            setSaving(true);

            const response = editingIngredient
                ? await ingredientService.updateIngredient(editingIngredient.IngredientId, formData)
                : await ingredientService.createIngredient(formData);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(editingIngredient ? "Ingredient updated." : "Ingredient created.");
            handleClose();
            loadIngredients();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to save ingredient.");

        } finally {

            setSaving(false);

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }}>

                <Typography variant="body2" color="text.secondary">
                    Ingredients are shared across every branch of your restaurant.
                </Typography>

                {owner && (
                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenCreate}>
                        Add Ingredient
                    </Button>
                )}

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>

                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Base Unit</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Low Stock Threshold</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                {owner && <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>}
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={owner ? 7 : 6} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : ingredients.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={owner ? 7 : 6} sx={{ py: 0 }}>
                                        <EmptyState
                                            icon={<Inventory2OutlinedIcon />}
                                            title="No ingredients yet"
                                            description={owner ? "Add your first ingredient to start tracking stock." : "Ask an owner to add ingredients here."}
                                            action={owner && (
                                                <Button variant="outlined" size="small" startIcon={<AddRoundedIcon />} onClick={handleOpenCreate}>
                                                    Add Ingredient
                                                </Button>
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                ingredients.map((ingredient) => (

                                    <TableRow key={ingredient.IngredientId} hover>

                                        <TableCell>
                                            <Typography fontWeight={600}>{ingredient.Name}</Typography>
                                        </TableCell>

                                        <TableCell>{ingredient.SKU || "-"}</TableCell>

                                        <TableCell>{ingredient.Category || "-"}</TableCell>

                                        <TableCell>{unitLabel(ingredient.BaseUnit)}</TableCell>

                                        <TableCell>
                                            {ingredient.LowStockThreshold !== null && ingredient.LowStockThreshold !== undefined
                                                ? `${Number(ingredient.LowStockThreshold)} ${ingredient.BaseUnit}`
                                                : "-"}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={ingredient.IsActive ? "Active" : "Inactive"}
                                                color={ingredient.IsActive ? "success" : "default"}
                                                size="small"
                                            />
                                        </TableCell>

                                        {owner && (

                                            <TableCell align="right">
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => handleOpenEdit(ingredient)}>
                                                        <EditOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>

                                        )}

                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            </Paper>

            <IngredientDialog
                open={dialogOpen}
                onClose={handleClose}
                onSave={handleSave}
                editingIngredient={editingIngredient}
                saving={saving}
            />

        </Box>

    );

}

export default IngredientsTab;
