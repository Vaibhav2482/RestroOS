import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Stack,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import toast from "react-hot-toast";

import * as addressService from "../services/addressService";
import { useStorefront } from "../context/StorefrontContext";
import AddressDialog from "./AddressDialog";

function Addresses() {

    const { customer } = useStorefront();

    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {

        loadAddresses();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadAddresses = async () => {

        try {

            setLoading(true);

            const response = await addressService.getAddresses(customer.CustomerId);

            if (response.success) {
                setAddresses(response.data);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load addresses.");

        } finally {

            setLoading(false);

        }

    };

    const openCreateDialog = () => {
        setEditingAddress(null);
        setDialogOpen(true);
    };

    const openEditDialog = (address) => {
        setEditingAddress(address);
        setDialogOpen(true);
    };

    const handleSave = async (formData) => {

        try {

            setSaving(true);

            const response = editingAddress
                ? await addressService.updateAddress(editingAddress.AddressId, formData)
                : await addressService.createAddress({ customerId: customer.CustomerId, ...formData });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(editingAddress ? "Address updated." : "Address added.");
            setDialogOpen(false);
            await loadAddresses();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to save address.");

        } finally {

            setSaving(false);

        }

    };

    const handleDeleteConfirm = async () => {

        if (!deleteTarget) {
            return;
        }

        try {

            setDeleting(true);

            const response = await addressService.deleteAddress(deleteTarget.AddressId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Address deleted.");
            setDeleteTarget(null);
            await loadAddresses();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to delete address.");

        } finally {

            setDeleting(false);

        }

    };

    if (loading) {

        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress />
            </Box>
        );

    }

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>

                <Typography variant="h5" fontWeight={800}>
                    My Addresses
                </Typography>

                <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={openCreateDialog}>
                    Add Address
                </Button>

            </Box>

            {addresses.length === 0 ? (

                <Card sx={{ p: 5, textAlign: "center" }}>
                    <PlaceOutlinedIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
                    <Typography color="text.secondary">
                        You haven't saved any addresses yet.
                    </Typography>
                </Card>

            ) : (

                <Stack spacing={2}>

                    {addresses.map((address) => (

                        <Card key={address.AddressId} sx={{ p: 3 }}>

                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>

                                <Box sx={{ minWidth: 0 }}>

                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                        <Typography fontWeight={700}>{address.AddressTitle}</Typography>
                                        {address.IsDefault && <Chip label="Default" size="small" color="primary" />}
                                    </Stack>

                                    <Typography variant="body2" color="text.secondary">
                                        {address.FullAddress}, {address.City}, {address.State} - {address.Pincode}
                                    </Typography>

                                    {address.Landmark && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Landmark: {address.Landmark}
                                        </Typography>
                                    )}

                                </Box>

                                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>

                                    <IconButton size="small" onClick={() => openEditDialog(address)}>
                                        <EditRoundedIcon fontSize="small" />
                                    </IconButton>

                                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(address)}>
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                    </IconButton>

                                </Stack>

                            </Box>

                        </Card>

                    ))}

                </Stack>

            )}

            <AddressDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={handleSave}
                address={editingAddress}
                saving={saving}
            />

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>

                <DialogTitle fontWeight={800}>Delete Address</DialogTitle>

                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete "{deleteTarget?.AddressTitle}"? This can't be undone.
                    </DialogContentText>
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setDeleteTarget(null)} color="inherit">Cancel</Button>
                    <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={deleting}>
                        {deleting ? "Deleting..." : "Delete"}
                    </Button>
                </DialogActions>

            </Dialog>

        </Box>

    );

}

export default Addresses;
