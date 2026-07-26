import { useEffect, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as menuItemRecipeService from "../services/menuItemRecipeService";
import * as ingredientService from "../services/ingredientService";
import { compatibleUnits } from "../utils/units";

const emptyLine = () => ({ key: crypto.randomUUID(), ingredientId: "", quantity: "", unit: "" });

function MenuItemRecipeDialog({ open, onClose, menuItem }) {

    const [ingredients, setIngredients] = useState([]);
    const [lines, setLines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {

        if (open && menuItem?.MenuItemId) {
            loadData();
        } else {
            setLines([]);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, menuItem]);

    const loadData = async () => {

        try {

            setLoading(true);

            const [ingredientsResponse, recipeResponse] = await Promise.all([
                ingredientService.getAllIngredients(),
                menuItemRecipeService.getRecipe(menuItem.MenuItemId)
            ]);

            if (ingredientsResponse.success) {
                setIngredients(ingredientsResponse.data);
            }

            if (recipeResponse.success) {

                const existingLines = recipeResponse.data.map((line) => ({
                    key: crypto.randomUUID(),
                    ingredientId: line.IngredientId,
                    quantity: line.Quantity,
                    unit: line.Unit
                }));

                setLines(existingLines.length > 0 ? existingLines : [emptyLine()]);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load recipe.");

        } finally {

            setLoading(false);

        }

    };

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    const handleAddLine = () => {

        setLines((prev) => {

            // Pre-fill with the first ingredient not already on the recipe
            // (and its default compatible unit) rather than a blank row -
            // most recipes just need "pick the next one," not "pick
            // everything from scratch" on every line.
            const usedIds = new Set(prev.map((line) => line.ingredientId));
            const nextIngredient = ingredients.find((ingredient) => !usedIds.has(ingredient.IngredientId));

            if (!nextIngredient) {
                return [...prev, emptyLine()];
            }

            return [...prev, {
                ...emptyLine(),
                ingredientId: nextIngredient.IngredientId,
                unit: compatibleUnits(nextIngredient.BaseUnit)[0]?.code || ""
            }];

        });

    };

    const handleRemoveLine = (key) => {
        setLines((prev) => prev.filter((line) => line.key !== key));
    };

    const handleLineChange = (key, field, value) => {

        setLines((prev) => prev.map((line) => {

            if (line.key !== key) {
                return line;
            }

            const updated = { ...line, [field]: value };

            // Switching ingredient can invalidate a previously-picked unit
            // from a different UnitType (e.g. was "kg", new ingredient is
            // measured in "ml") - reset it so an incompatible pair can't be
            // submitted silently.
            if (field === "ingredientId") {

                const ingredient = ingredients.find((item) => item.IngredientId === value);
                updated.unit = ingredient ? compatibleUnits(ingredient.BaseUnit)[0]?.code || "" : "";

            }

            return updated;

        }));

    };

    const handleSave = async () => {

        const usableLines = lines.filter((line) => line.ingredientId && line.quantity !== "" && line.unit);

        if (usableLines.length === 0) {

            try {
                setSaving(true);
                const response = await menuItemRecipeService.saveRecipe(menuItem.MenuItemId, []);
                if (!response.success) { toast.error(response.message); return; }
                toast.success("Recipe cleared.");
                onClose();
            } catch (error) {
                toast.error(error.response?.data?.message || "Failed to save recipe.");
            } finally {
                setSaving(false);
            }

            return;

        }

        const ingredientIds = usableLines.map((line) => line.ingredientId);

        if (new Set(ingredientIds).size !== ingredientIds.length) {
            toast.error("Each ingredient can only appear once in a recipe.");
            return;
        }

        if (usableLines.some((line) => Number(line.quantity) <= 0)) {
            toast.error("Every quantity must be greater than 0.");
            return;
        }

        try {

            setSaving(true);

            const response = await menuItemRecipeService.saveRecipe(
                menuItem.MenuItemId,
                usableLines.map((line) => ({ ingredientId: line.ingredientId, quantity: Number(line.quantity), unit: line.unit }))
            );

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Recipe saved.");
            onClose();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to save recipe.");

        } finally {

            setSaving(false);

        }

    };

    return (

        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ fontWeight: 700 }}>
                Recipe{menuItem?.ItemName ? ` — ${menuItem.ItemName}` : ""}
            </DialogTitle>

            <DialogContent dividers>

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress />
                    </Box>

                ) : ingredients.length === 0 ? (

                    <Typography color="text.secondary" sx={{ py: 2 }}>
                        No ingredients yet - add ingredients under Inventory → Ingredients first, then come back to build this recipe.
                    </Typography>

                ) : (

                    <Stack spacing={2}>

                        <Typography variant="body2" color="text.secondary">
                            One serving of this item consumes the ingredients below. Stock is deducted automatically once an order reaches "Preparing".
                        </Typography>

                        {lines.map((line) => {

                            const selectedIngredient = ingredients.find((item) => item.IngredientId === line.ingredientId);
                            const units = selectedIngredient ? compatibleUnits(selectedIngredient.BaseUnit) : [];

                            return (

                                <Grid container spacing={1.5} key={line.key} alignItems="center">

                                    <Grid size={{ xs: 12, sm: 5 }}>
                                        <TextField
                                            select
                                            fullWidth
                                            size="small"
                                            label="Ingredient"
                                            value={line.ingredientId}
                                            onChange={(event) => handleLineChange(line.key, "ingredientId", event.target.value)}
                                        >
                                            {ingredients.map((ingredient) => (
                                                <MenuItem key={ingredient.IngredientId} value={ingredient.IngredientId}>
                                                    {ingredient.Name}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>

                                    <Grid size={{ xs: 6, sm: 3 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            label="Quantity"
                                            value={line.quantity}
                                            onChange={(event) => handleLineChange(line.key, "quantity", event.target.value)}
                                            inputProps={{ min: 0, step: "0.001" }}
                                        />
                                    </Grid>

                                    <Grid size={{ xs: 5, sm: 3 }}>
                                        <TextField
                                            select
                                            fullWidth
                                            size="small"
                                            label="Unit"
                                            value={line.unit}
                                            disabled={!selectedIngredient}
                                            onChange={(event) => handleLineChange(line.key, "unit", event.target.value)}
                                        >
                                            {units.map((unit) => (
                                                <MenuItem key={unit.code} value={unit.code}>{unit.label}</MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>

                                    <Grid size={{ xs: 1 }}>
                                        <IconButton size="small" color="error" onClick={() => handleRemoveLine(line.key)}>
                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                        </IconButton>
                                    </Grid>

                                </Grid>

                            );

                        })}

                        <Button
                            variant="outlined"
                            startIcon={<AddRoundedIcon />}
                            onClick={handleAddLine}
                            sx={{ alignSelf: "flex-start" }}
                        >
                            Add Ingredient
                        </Button>

                    </Stack>

                )}

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={handleClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving || loading}>
                    {saving ? "Saving..." : "Save Recipe"}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default MenuItemRecipeDialog;
