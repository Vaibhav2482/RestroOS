import { useEffect, useState } from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    Grid,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as menuOptionService from "../services/menuOptionService";

const emptyGroupForm = {
    groupName: "",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    displayOrder: 0
};

const emptyOptionForm = {
    optionName: "",
    priceDelta: 0,
    isDefault: false,
    displayOrder: 0,
    isActive: true
};

function getSelectLabel(group) {

    if (Number(group.MinSelect) === Number(group.MaxSelect)) {
        return `Select ${group.MinSelect}`;
    }

    return `Select up to ${group.MaxSelect}`;

}

function MenuItemOptionsDialog({ open, onClose, menuItem }) {

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [addGroupOpen, setAddGroupOpen] = useState(false);
    const [groupForm, setGroupForm] = useState(emptyGroupForm);

    const [editingGroupId, setEditingGroupId] = useState(null);
    const [editGroupForm, setEditGroupForm] = useState(emptyGroupForm);

    const [addOptionGroupId, setAddOptionGroupId] = useState(null);
    const [optionForm, setOptionForm] = useState(emptyOptionForm);

    const [editingOptionId, setEditingOptionId] = useState(null);
    const [editOptionForm, setEditOptionForm] = useState(emptyOptionForm);

    useEffect(() => {

        if (open && menuItem?.MenuItemId) {
            loadGroups();
        } else {
            resetLocalState();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, menuItem]);

    const resetLocalState = () => {

        setGroups([]);
        setAddGroupOpen(false);
        setGroupForm(emptyGroupForm);
        setEditingGroupId(null);
        setEditGroupForm(emptyGroupForm);
        setAddOptionGroupId(null);
        setOptionForm(emptyOptionForm);
        setEditingOptionId(null);
        setEditOptionForm(emptyOptionForm);

    };

    const loadGroups = async () => {

        try {

            setLoading(true);

            const response = await menuOptionService.getOptionGroupsByMenuItem(menuItem.MenuItemId);

            if (response.success) {
                setGroups(response.data || []);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load option groups.");

        } finally {

            setLoading(false);

        }

    };

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    // ---- Group: add ----

    const handleOpenAddGroup = () => {
        setGroupForm({ ...emptyGroupForm, displayOrder: groups.length });
        setAddGroupOpen(true);
    };

    const handleGroupFormChange = (event) => {

        const { name, value, checked, type } = event.target;

        setGroupForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

    };

    const handleCreateGroup = async () => {

        if (groupForm.groupName.trim() === "") {
            toast.error("Group name is required.");
            return;
        }

        try {

            setSaving(true);

            const response = await menuOptionService.createOptionGroup({
                menuItemId: menuItem.MenuItemId,
                groupName: groupForm.groupName.trim(),
                isRequired: groupForm.isRequired,
                minSelect: Number(groupForm.minSelect),
                maxSelect: Number(groupForm.maxSelect),
                displayOrder: Number(groupForm.displayOrder)
            });

            if (response.success) {

                toast.success("Option group added.");
                setAddGroupOpen(false);
                setGroupForm(emptyGroupForm);
                await loadGroups();

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create option group.");

        } finally {

            setSaving(false);

        }

    };

    // ---- Group: edit ----

    const handleOpenEditGroup = (group) => {

        setEditingGroupId(group.GroupId);
        setEditGroupForm({
            groupName: group.GroupName ?? "",
            isRequired: Boolean(group.IsRequired),
            minSelect: group.MinSelect ?? 1,
            maxSelect: group.MaxSelect ?? 1,
            displayOrder: group.DisplayOrder ?? 0
        });

    };

    const handleEditGroupFormChange = (event) => {

        const { name, value, checked, type } = event.target;

        setEditGroupForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

    };

    const handleUpdateGroup = async (groupId) => {

        if (editGroupForm.groupName.trim() === "") {
            toast.error("Group name is required.");
            return;
        }

        try {

            setSaving(true);

            const response = await menuOptionService.updateOptionGroup(groupId, {
                groupName: editGroupForm.groupName.trim(),
                isRequired: editGroupForm.isRequired,
                minSelect: Number(editGroupForm.minSelect),
                maxSelect: Number(editGroupForm.maxSelect),
                displayOrder: Number(editGroupForm.displayOrder)
            });

            if (response.success) {

                toast.success("Option group updated.");
                setEditingGroupId(null);
                await loadGroups();

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update option group.");

        } finally {

            setSaving(false);

        }

    };

    const handleDeleteGroup = async (group) => {

        if (!window.confirm(`Delete group "${group.GroupName}"? This will also delete its options.`)) {
            return;
        }

        try {

            setSaving(true);

            const response = await menuOptionService.deleteOptionGroup(group.GroupId);

            if (response.success) {

                toast.success("Option group deleted.");
                await loadGroups();

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to delete option group.");

        } finally {

            setSaving(false);

        }

    };

    // ---- Option: add ----

    const handleOpenAddOption = (group) => {
        setAddOptionGroupId(group.GroupId);
        setOptionForm({ ...emptyOptionForm, displayOrder: (group.Options || []).length });
    };

    const handleOptionFormChange = (event) => {

        const { name, value, checked, type } = event.target;

        setOptionForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

    };

    const handleCreateOption = async (groupId) => {

        if (optionForm.optionName.trim() === "") {
            toast.error("Option name is required.");
            return;
        }

        try {

            setSaving(true);

            const response = await menuOptionService.createOption(groupId, {
                optionName: optionForm.optionName.trim(),
                priceDelta: Number(optionForm.priceDelta),
                isDefault: optionForm.isDefault,
                displayOrder: Number(optionForm.displayOrder)
            });

            if (response.success) {

                toast.success("Option added.");
                setAddOptionGroupId(null);
                setOptionForm(emptyOptionForm);
                await loadGroups();

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create option.");

        } finally {

            setSaving(false);

        }

    };

    // ---- Option: edit ----

    const handleOpenEditOption = (option) => {

        setEditingOptionId(option.OptionId);
        setEditOptionForm({
            optionName: option.OptionName ?? "",
            priceDelta: option.PriceDelta ?? 0,
            isDefault: Boolean(option.IsDefault),
            displayOrder: option.DisplayOrder ?? 0,
            isActive: option.IsActive === undefined ? true : Boolean(option.IsActive)
        });

    };

    const handleEditOptionFormChange = (event) => {

        const { name, value, checked, type } = event.target;

        setEditOptionForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

    };

    const handleUpdateOption = async (optionId) => {

        if (editOptionForm.optionName.trim() === "") {
            toast.error("Option name is required.");
            return;
        }

        try {

            setSaving(true);

            const response = await menuOptionService.updateOption(optionId, {
                optionName: editOptionForm.optionName.trim(),
                priceDelta: Number(editOptionForm.priceDelta),
                isDefault: editOptionForm.isDefault,
                displayOrder: Number(editOptionForm.displayOrder),
                isActive: editOptionForm.isActive
            });

            if (response.success) {

                toast.success("Option updated.");
                setEditingOptionId(null);
                await loadGroups();

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update option.");

        } finally {

            setSaving(false);

        }

    };

    const handleDeleteOption = async (option) => {

        if (!window.confirm(`Delete option "${option.OptionName}"?`)) {
            return;
        }

        try {

            setSaving(true);

            const response = await menuOptionService.deleteOption(option.OptionId);

            if (response.success) {

                toast.success("Option deleted.");
                await loadGroups();

            } else {

                toast.error(response.message);

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to delete option.");

        } finally {

            setSaving(false);

        }

    };

    return (

        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">

            <DialogTitle>
                Manage Options{menuItem?.ItemName ? ` — ${menuItem.ItemName}` : ""}
            </DialogTitle>

            <DialogContent dividers>

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress />
                    </Box>

                ) : (

                    <Stack spacing={2}>

                        {groups.length === 0 && !addGroupOpen && (

                            <Typography color="text.secondary" sx={{ py: 2 }}>
                                No option groups yet. Add one to let customers customize this item (e.g. size, add-ons).
                            </Typography>

                        )}

                        {groups.map((group) => (

                            <Accordion key={group.GroupId} disableGutters>

                                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>

                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", flexGrow: 1, pr: 1 }}>

                                        <Typography fontWeight={600}>
                                            {group.GroupName}
                                        </Typography>

                                        <Chip
                                            size="small"
                                            label={group.IsRequired ? "Required" : "Optional"}
                                            color={group.IsRequired ? "primary" : "default"}
                                            variant={group.IsRequired ? "filled" : "outlined"}
                                        />

                                        <Chip size="small" label={getSelectLabel(group)} variant="outlined" />

                                        <Box sx={{ flexGrow: 1 }} />

                                        <Tooltip title="Edit Group">
                                            <IconButton
                                                size="small"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleOpenEditGroup(group);
                                                }}
                                            >
                                                <EditRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title="Delete Group">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleDeleteGroup(group);
                                                }}
                                            >
                                                <DeleteOutlineRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                    </Box>

                                </AccordionSummary>

                                <AccordionDetails>

                                    {editingGroupId === group.GroupId && (

                                        <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 1 }}>

                                            <Grid container spacing={2}>

                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="Group Name"
                                                        name="groupName"
                                                        value={editGroupForm.groupName}
                                                        onChange={handleEditGroupFormChange}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="number"
                                                        label="Min Select"
                                                        name="minSelect"
                                                        value={editGroupForm.minSelect}
                                                        onChange={handleEditGroupFormChange}
                                                        slotProps={{ htmlInput: { min: 0 } }}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="number"
                                                        label="Max Select"
                                                        name="maxSelect"
                                                        value={editGroupForm.maxSelect}
                                                        onChange={handleEditGroupFormChange}
                                                        slotProps={{ htmlInput: { min: 1 } }}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="number"
                                                        label="Display Order"
                                                        name="displayOrder"
                                                        value={editGroupForm.displayOrder}
                                                        onChange={handleEditGroupFormChange}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 6, md: 2 }} sx={{ display: "flex", alignItems: "center" }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                name="isRequired"
                                                                checked={editGroupForm.isRequired}
                                                                onChange={handleEditGroupFormChange}
                                                            />
                                                        }
                                                        label="Required"
                                                    />
                                                </Grid>

                                            </Grid>

                                            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                                                <Button size="small" onClick={() => setEditingGroupId(null)} disabled={saving}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => handleUpdateGroup(group.GroupId)}
                                                    disabled={saving}
                                                >
                                                    Save
                                                </Button>
                                            </Stack>

                                        </Box>

                                    )}

                                    <Stack spacing={1} divider={<Divider flexItem />}>

                                        {(group.Options || []).length === 0 && (

                                            <Typography variant="body2" color="text.secondary">
                                                No options yet.
                                            </Typography>

                                        )}

                                        {(group.Options || []).map((option) => (

                                            editingOptionId === option.OptionId ? (

                                                <Box key={option.OptionId} sx={{ p: 2, border: "1px solid #E5E7EB", borderRadius: 1 }}>

                                                    <Grid container spacing={2}>

                                                        <Grid size={{ xs: 12, md: 4 }}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label="Option Name"
                                                                name="optionName"
                                                                value={editOptionForm.optionName}
                                                                onChange={handleEditOptionFormChange}
                                                            />
                                                        </Grid>

                                                        <Grid size={{ xs: 6, md: 2 }}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                type="number"
                                                                label="Price Delta"
                                                                name="priceDelta"
                                                                value={editOptionForm.priceDelta}
                                                                onChange={handleEditOptionFormChange}
                                                                slotProps={{ htmlInput: { step: "0.01" } }}
                                                            />
                                                        </Grid>

                                                        <Grid size={{ xs: 6, md: 2 }}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                type="number"
                                                                label="Display Order"
                                                                name="displayOrder"
                                                                value={editOptionForm.displayOrder}
                                                                onChange={handleEditOptionFormChange}
                                                            />
                                                        </Grid>

                                                        <Grid size={{ xs: 6, md: 2 }} sx={{ display: "flex", alignItems: "center" }}>
                                                            <FormControlLabel
                                                                control={
                                                                    <Switch
                                                                        name="isDefault"
                                                                        checked={editOptionForm.isDefault}
                                                                        onChange={handleEditOptionFormChange}
                                                                    />
                                                                }
                                                                label="Default"
                                                            />
                                                        </Grid>

                                                        <Grid size={{ xs: 6, md: 2 }} sx={{ display: "flex", alignItems: "center" }}>
                                                            <FormControlLabel
                                                                control={
                                                                    <Switch
                                                                        name="isActive"
                                                                        checked={editOptionForm.isActive}
                                                                        onChange={handleEditOptionFormChange}
                                                                    />
                                                                }
                                                                label="Active"
                                                            />
                                                        </Grid>

                                                    </Grid>

                                                    <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                                                        <Button size="small" onClick={() => setEditingOptionId(null)} disabled={saving}>
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            onClick={() => handleUpdateOption(option.OptionId)}
                                                            disabled={saving}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Stack>

                                                </Box>

                                            ) : (

                                                <Box
                                                    key={option.OptionId}
                                                    sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", py: 0.5 }}
                                                >

                                                    <Typography sx={{ minWidth: 160 }}>
                                                        {option.OptionName}
                                                    </Typography>

                                                    <Typography color="text.secondary" sx={{ minWidth: 90 }}>
                                                        {Number(option.PriceDelta) >= 0 ? "+" : ""}&#8377;{Number(option.PriceDelta).toFixed(2)}
                                                    </Typography>

                                                    {option.IsDefault && (
                                                        <Chip size="small" label="Default" color="info" />
                                                    )}

                                                    <Chip
                                                        size="small"
                                                        label={option.IsActive ? "Active" : "Inactive"}
                                                        color={option.IsActive ? "success" : "default"}
                                                        variant={option.IsActive ? "filled" : "outlined"}
                                                    />

                                                    <Box sx={{ flexGrow: 1 }} />

                                                    <Tooltip title="Edit Option">
                                                        <IconButton size="small" onClick={() => handleOpenEditOption(option)}>
                                                            <EditRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Delete Option">
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteOption(option)}>
                                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>

                                                </Box>

                                            )

                                        ))}

                                    </Stack>

                                    {addOptionGroupId === group.GroupId ? (

                                        <Box sx={{ mt: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 1 }}>

                                            <Grid container spacing={2}>

                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="Option Name"
                                                        name="optionName"
                                                        value={optionForm.optionName}
                                                        onChange={handleOptionFormChange}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="number"
                                                        label="Price Delta"
                                                        name="priceDelta"
                                                        value={optionForm.priceDelta}
                                                        onChange={handleOptionFormChange}
                                                        slotProps={{ htmlInput: { step: "0.01" } }}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="number"
                                                        label="Display Order"
                                                        name="displayOrder"
                                                        value={optionForm.displayOrder}
                                                        onChange={handleOptionFormChange}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", alignItems: "center" }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                name="isDefault"
                                                                checked={optionForm.isDefault}
                                                                onChange={handleOptionFormChange}
                                                            />
                                                        }
                                                        label="Default"
                                                    />
                                                </Grid>

                                            </Grid>

                                            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                                                <Button size="small" onClick={() => setAddOptionGroupId(null)} disabled={saving}>
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => handleCreateOption(group.GroupId)}
                                                    disabled={saving}
                                                >
                                                    Add Option
                                                </Button>
                                            </Stack>

                                        </Box>

                                    ) : (

                                        <Button
                                            size="small"
                                            startIcon={<AddRoundedIcon />}
                                            onClick={() => handleOpenAddOption(group)}
                                            sx={{ mt: 2 }}
                                        >
                                            Add Option
                                        </Button>

                                    )}

                                </AccordionDetails>

                            </Accordion>

                        ))}

                        {addGroupOpen && (

                            <Box sx={{ p: 2, border: "1px solid #E5E7EB", borderRadius: 1 }}>

                                <Typography fontWeight={600} sx={{ mb: 1.5 }}>
                                    New Option Group
                                </Typography>

                                <Grid container spacing={2}>

                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Group Name"
                                            name="groupName"
                                            placeholder="e.g. Quantity, Add-ons"
                                            value={groupForm.groupName}
                                            onChange={handleGroupFormChange}
                                        />
                                    </Grid>

                                    <Grid size={{ xs: 6, md: 2 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            label="Min Select"
                                            name="minSelect"
                                            value={groupForm.minSelect}
                                            onChange={handleGroupFormChange}
                                            slotProps={{ htmlInput: { min: 0 } }}
                                        />
                                    </Grid>

                                    <Grid size={{ xs: 6, md: 2 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            label="Max Select"
                                            name="maxSelect"
                                            value={groupForm.maxSelect}
                                            onChange={handleGroupFormChange}
                                            slotProps={{ htmlInput: { min: 1 } }}
                                        />
                                    </Grid>

                                    <Grid size={{ xs: 6, md: 2 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="number"
                                            label="Display Order"
                                            name="displayOrder"
                                            value={groupForm.displayOrder}
                                            onChange={handleGroupFormChange}
                                        />
                                    </Grid>

                                    <Grid size={{ xs: 6, md: 2 }} sx={{ display: "flex", alignItems: "center" }}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    name="isRequired"
                                                    checked={groupForm.isRequired}
                                                    onChange={handleGroupFormChange}
                                                />
                                            }
                                            label="Required"
                                        />
                                    </Grid>

                                </Grid>

                                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                                    <Button size="small" onClick={() => setAddGroupOpen(false)} disabled={saving}>
                                        Cancel
                                    </Button>
                                    <Button size="small" variant="contained" onClick={handleCreateGroup} disabled={saving}>
                                        Add Group
                                    </Button>
                                </Stack>

                            </Box>

                        )}

                        {!addGroupOpen && (

                            <Button
                                variant="outlined"
                                startIcon={<AddRoundedIcon />}
                                onClick={handleOpenAddGroup}
                                sx={{ alignSelf: "flex-start" }}
                            >
                                Add Group
                            </Button>

                        )}

                    </Stack>

                )}

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>

                <Button onClick={handleClose} disabled={saving}>
                    Close
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default MenuItemOptionsDialog;
