
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"; // Added useEffect and useMemo
import Image from 'next/image'; // Import next/image
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Import Label
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Trash2,
  Edit,
  PlusCircle,
  Save,
  Ban,
  RotateCcw,
  Loader2,
  Image as ImageIcon, // Import Image icon
  XCircle, // Import XCircle for remove button
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  addGift,
  updateGift,
  deleteGift,
  revertSelection,
  markGiftAsNotNeeded,
  type GiftItem,
} from "@/data/gift-store";
import * as z from "zod";
import { useForm, Controller } from "react-hook-form";

interface AdminItemManagementTableProps {
  gifts: GiftItem[]; // Expecting gifts array
  onDataChange?: () => void; // Callback for parent component refresh
}

// Constants for file validation (used client-side)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];


// Validation Schema for the Add/Edit Form
const giftFormSchema = z.object({
  name: z
    .string()
    .min(3, "Nome precisa ter pelo menos 3 caracteres.")
    .max(100, "Nome muito longo"),
  description: z
    .string()
    .max(200, "Descrição muito longa")
    .optional()
    .or(z.literal("")), // Allow empty string, map to null later
  category: z.string().min(1, "Categoria é obrigatória."),
  status: z.enum(["available", "selected", "not_needed"]), // Status is now required
  selectedBy: z
    .string()
    .max(50, "Nome do selecionador muito longo")
    .optional()
    .or(z.literal("")), // Allow selectedBy editing, map to null later
  imageUrl: z.string().optional().nullable(), // Store image URL (data URI or path)
  // Field for file input (not directly validated by Zod schema, handled in component)
  imageFile: z.any().optional().nullable(),
});

type GiftFormData = z.infer<typeof giftFormSchema>;

// Available categories
const categories = ["Roupas", "Higiene", "Brinquedos", "Alimentação", "Outros"];
// Available statuses for selection in the edit dialog
const statuses: GiftItem["status"][] = ["available", "selected", "not_needed"];

export default function AdminItemManagementTable({
  gifts, // Receive gifts directly
  onDataChange,
}: AdminItemManagementTableProps) {
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Track loading state for row actions
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null); // State for image preview in dialog
  const [isClient, setIsClient] = useState(false); // Track client mount

  useEffect(() => {
    setIsClient(true); // Component has mounted
  }, []);

  // Log received gifts when the prop changes
  useEffect(() => {
    console.log(`AdminItemManagementTable: Received gifts prop update. Count: ${gifts?.length ?? 0}`);
    // console.log("AdminItemManagementTable: Sample gifts received in prop:", gifts?.slice(0, 3));
  }, [gifts]);

  // Ensure gifts is always an array before using it
  const safeGifts = useMemo(() => {
      const result = Array.isArray(gifts) ? gifts : [];
      console.log(`AdminItemManagementTable: Memoized safeGifts. Count: ${result.length}`);
      // console.log("AdminItemManagementTable: safeGifts content:", result.slice(0, 3));
      return result;
  }, [gifts]);


  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<GiftFormData>({
    resolver: zodResolver(giftFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      status: "available", // Default for new items
      selectedBy: "", // Default empty
      imageUrl: null,
      imageFile: null,
    },
  });

  // Watch status to conditionally show/require selectedBy
  const watchedStatus = watch("status");
  const watchedImageFile = watch("imageFile");

  // Handle image preview updates
  useEffect(() => {
    if (!isClient) return; // Only run client-side

    const fileList = watchedImageFile as FileList | null | undefined;
    const file = fileList?.[0];

    if (file) {
      // Client-side validation
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Erro de Arquivo",
          description: `Tamanho máximo do arquivo é ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        setValue("imageFile", null); // Clear invalid file
        const prevUrl = editingItem?.imageUrl || null;
        setValue("imageUrl", prevUrl);
        setImagePreview(prevUrl);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Erro de Arquivo",
          description: "Tipo de arquivo inválido. Use JPG, PNG, GIF, WebP.",
          variant: "destructive",
        });
        setValue("imageFile", null);
        const prevUrl = editingItem?.imageUrl || null;
        setValue("imageUrl", prevUrl);
        setImagePreview(prevUrl);
        return;
      }

      // Generate data URI for preview and store in RHF
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log("AdminItemManagementTable Dialog: Generated data URI preview.");
        setValue("imageUrl", result, { shouldValidate: true });
        setImagePreview(result);
      };
      reader.onerror = (err) => console.error("FileReader error:", err);
      reader.readAsDataURL(file);
    } else if (
      fileList === null ||
      (typeof fileList === "object" && fileList?.length === 0)
    ) {
        // File explicitly cleared
        const currentUrl = editingItem?.imageUrl;
        console.log("AdminItemManagementTable Dialog: File cleared. Setting preview to current item URL (if any):", currentUrl);
        setImagePreview(currentUrl || null);
        setValue("imageUrl", currentUrl || null); // Reset RHF state
    }
    // Initial load: preview is set in handleOpenEditDialog or cleared in handleOpenAddDialog
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedImageFile, isClient, setValue, toast, editingItem]);


  const handleOpenAddDialog = () => {
    console.log("AdminItemManagementTable: Opening ADD dialog.");
    reset({ // Reset form for adding a new item
      name: "",
      description: "",
      category: "",
      status: "available", // Ensure default status is 'available'
      selectedBy: "",
      imageUrl: null,
      imageFile: null,
    });
    setEditingItem(null);
    setImagePreview(null); // Clear preview for new item
    setIsAddEditDialogOpen(true);
  };

  const handleOpenEditDialog = (item: GiftItem) => {
    console.log(`AdminItemManagementTable: Opening EDIT dialog for item ID: ${item.id}`, item);
    setEditingItem(item);
    reset({ // Populate form with the selected item's data
      name: item.name,
      description: item.description || "",
      category: item.category,
      status: item.status, // Use the item's current status
      selectedBy: item.selectedBy || "",
      imageUrl: item.imageUrl || null, // Set initial image URL
      imageFile: null, // Reset file input
    });
    setImagePreview(item.imageUrl || null); // Set initial preview
    setIsAddEditDialogOpen(true);
  };

  const handleDialogClose = () => {
    console.log("AdminItemManagementTable: Closing dialog.");
    setIsAddEditDialogOpen(false);
    setEditingItem(null);
    setImagePreview(null); // Clear preview on close
    reset({ // Reset form to defaults when closing
        name: "",
        description: "",
        category: "",
        status: "available",
        selectedBy: "",
        imageUrl: null,
        imageFile: null,
      });
  };

  // Function to remove the image (clears preview and RHF state)
  const removeImage = useCallback(() => {
    console.log("AdminItemManagementTable Dialog: Removing image.");
    setValue("imageFile", null); // Clear file input
    setValue("imageUrl", null); // Clear URL state
    setImagePreview(null); // Clear preview state
    // Manually clear the file input element
    const fileInput = document.getElementById("imageFile-dialog") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
  }, [setValue]);

  // Show toast and trigger parent refresh after data store mutation completes
  const handleSuccess = (message: string) => {
     console.log(`AdminItemManagementTable: Operation successful - ${message}. Triggering onDataChange.`);
     toast({ title: "Sucesso!", description: message });
     // Call parent refresh AFTER toast/logging
     onDataChange?.();
     handleDialogClose(); // Close dialog on success
  };

  const handleError = (
    operation: string,
    itemName: string,
    errorDetails?: any,
  ) => {
    // Log the specific error for debugging
    console.error(`AdminItemManagementTable: Error during ${operation} for "${itemName}":`, errorDetails);
    toast({
      title: "Erro!",
      description: `Falha ao ${operation.toLowerCase()} o item "${itemName}". Verifique o console para mais detalhes.`,
      variant: "destructive",
    });
     // Optionally keep dialog open on error?
     // handleDialogClose();
  };

  // Form submission for Add/Edit
  const onSubmit = async (data: GiftFormData) => {
    const operation = editingItem ? "atualizar" : "adicionar";
    const itemName = data.name || (editingItem ? editingItem.name : 'Novo Item'); // Use item name for logging
    console.log(`AdminItemManagementTable: Submitting form to ${operation} item: ${itemName}`, {
        ...data,
        imageUrl: data.imageUrl ? data.imageUrl.substring(0, 50) + '...' : null, // Log truncated URI
        imageFile: data.imageFile ? '[File object]' : null // Avoid logging large file object
    });


    // Validate that 'selectedBy' is provided if status is 'selected'
    if (
      data.status === "selected" &&
      (!data.selectedBy || data.selectedBy.trim() === "")
    ) {
        console.warn("AdminItemManagementTable: Validation failed - 'selectedBy' is required for 'selected' status.");
        toast({
        title: "Erro de Validação",
        description: "Por favor, informe quem selecionou o item.",
        variant: "destructive",
      });
      return; // Prevent submission
    }

    // Prepare data for the store functions, ensuring nulls for empty strings
    // Note: The structure passed to addGift/updateGift should match their expected types
    const storeData: Partial<Omit<GiftItem, "id" | "createdAt" | "selectionDate">> & { selectionDate?: any } = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category: data.category, // Already required by schema
        status: data.status, // Status is now required by schema
        selectedBy: data.status === "selected" ? (data.selectedBy?.trim() || "Admin") : null, // Set null if not selected, default if selected but empty
        // selectionDate is handled by the store functions (serverTimestamp) or passed if status is selected
        imageUrl: data.imageUrl || null, // Pass the final image URL (data URI or null)
    };
     // Pass selectionDate only if status is 'selected' and potentially null (handled by store)
     if (storeData.status === 'selected') {
        // Let the store handle the timestamp creation if not explicitly provided
        // storeData.selectionDate = serverTimestamp(); // Or pass a date if needed
     } else {
         delete storeData.selectionDate; // Don't pass selectionDate if status is not 'selected'
     }


    try {
      if (editingItem) {
        console.log(`AdminItemManagementTable: Calling updateGift for ID: ${editingItem.id} with data:`, { ...storeData, imageUrl: storeData.imageUrl ? storeData.imageUrl.substring(0, 50) + '...' : null });
        // Pass only the necessary fields for update
        await updateGift(editingItem.id, storeData);
        handleSuccess(`Item "${storeData.name}" atualizado.`);
      } else {
        console.log("AdminItemManagementTable: Calling addGift with data:", { ...storeData, imageUrl: storeData.imageUrl ? storeData.imageUrl.substring(0, 50) + '...' : null });
        // Cast to the expected type for addGift, removing potentially undefined fields
        const giftToAdd = {
           name: storeData.name!, // name is required
           category: storeData.category!, // category is required
           status: storeData.status!, // status is required
           description: storeData.description, // Optional
           selectedBy: storeData.selectedBy, // Optional, handled based on status
           imageUrl: storeData.imageUrl, // Add image URL
           // selectionDate is handled by addGift based on status
         } as Omit<GiftItem, "id" | "createdAt" | "selectionDate">; // Ensure type matches addGift expectation

         console.log("AdminItemManagementTable: Final data for addGift:", { ...giftToAdd, imageUrl: giftToAdd.imageUrl ? giftToAdd.imageUrl.substring(0, 50) + '...' : null });
        await addGift(giftToAdd); // Pass the correctly typed object
        handleSuccess(`Item "${storeData.name}" adicionado.`);
      }
    } catch (error) {
      handleError(operation, itemName, error); // Pass the error object
    }
  };

  // Row Action: Delete
  const handleDelete = async (item: GiftItem) => {
    if (actionLoading) return;
    console.log(`AdminItemManagementTable: Attempting to delete item ID: ${item.id}`);
    if (
      confirm(
        `Tem certeza que deseja excluir o item "${item.name}"? Esta ação não pode ser desfeita.`
      )
    ) {
      setActionLoading(`delete-${item.id}`);
      try {
        // deleteGift now handles revalidation
        const success = await deleteGift(item.id);
        if (success) {
            handleSuccess(`Item "${item.name}" excluído.`);
        } else {
            // Error handled implicitly if deleteGift throws, or explicitly if it returns false
             handleError("excluir", item.name, "Delete operation returned false.");
        }
      } catch (error) {
        handleError("excluir", item.name, error);
      } finally {
        setActionLoading(null);
      }
    } else {
        console.log(`AdminItemManagementTable: Delete cancelled for item ID: ${item.id}`);
    }
  };

  // Row Action: Revert to Available
  const handleRevert = async (item: GiftItem) => {
    if (actionLoading) return;
    if (item.status !== "selected" && item.status !== "not_needed") {
        console.warn(`AdminItemManagementTable: Cannot revert item ID: ${item.id}, status is already '${item.status}'.`);
        return;
    }
    const actionText =
      item.status === "selected"
        ? "reverter a seleção"
        : 'remover a marcação "Não Precisa"';
    const guestNameInfo = item.selectedBy ? ` por ${item.selectedBy}` : "";
     console.log(`AdminItemManagementTable: Attempting to revert item ID: ${item.id}`);
    if (
      confirm(
        `Tem certeza que deseja ${actionText} do item "${item.name}"${guestNameInfo}? O item voltará a ficar disponível.`
      )
    ) {
      setActionLoading(`revert-${item.id}`);
      try {
        // revertSelection now handles revalidation
        await revertSelection(item.id);
        handleSuccess(`Item "${item.name}" revertido para disponível.`);
      } catch (error) {
        handleError("reverter", item.name, error);
      } finally {
        setActionLoading(null);
      }
    } else {
         console.log(`AdminItemManagementTable: Revert cancelled for item ID: ${item.id}`);
    }
  };

  // Row Action: Mark as Not Needed
  const handleMarkNotNeeded = async (item: GiftItem) => {
    if (actionLoading) return;
    if (item.status === "not_needed") {
        console.warn(`AdminItemManagementTable: Item ID: ${item.id} is already marked as not needed.`);
        return; // Avoid action if already in the target state
    }
     console.log(`AdminItemManagementTable: Attempting to mark item ID: ${item.id} as not needed.`);
    if (
      confirm(
        `Tem certeza que deseja marcar o item "${item.name}" como "Não Precisa"?`
      )
    ) {
      setActionLoading(`mark-${item.id}`);
      try {
        // markGiftAsNotNeeded now handles revalidation
        await markGiftAsNotNeeded(item.id);
        handleSuccess(`Item "${item.name}" marcado como "Não Precisa".`);
      } catch (error) {
        handleError('marcar como "Não Precisa"', item.name, error);
      } finally {
        setActionLoading(null);
      }
    } else {
        console.log(`AdminItemManagementTable: Mark as not needed cancelled for item ID: ${item.id}`);
    }
  };

  const getStatusBadge = (status: GiftItem["status"]) => {
    switch (status) {
      case "available":
        return (
          <Badge
            variant="default"
            className="bg-success text-success-foreground"
          >
            Disponível
          </Badge>
        );
      case "selected":
        return (
          <Badge
            variant="secondary"
            className="bg-secondary text-secondary-foreground"
          >
            Selecionado
          </Badge>
        );
      case "not_needed":
        return (
          <Badge
            variant="destructive"
            className="bg-destructive/80 text-destructive-foreground"
          >
            Não Precisa
          </Badge>
        );
      default:
        console.warn(`AdminItemManagementTable: Unknown status in getStatusBadge: ${status}`);
        return <Badge variant="outline">Indefinido</Badge>;
    }
  };

  console.log(`AdminItemManagementTable: Rendering table. Number of safeGifts: ${safeGifts.length}`);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={handleOpenAddDialog}
          size="sm"
          disabled={isSubmitting || !!actionLoading}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Item
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
                {/* Added Image column */}
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">
                Selecionado Por
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeGifts.length === 0 ? ( // Use safeGifts
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center"> {/* Updated colSpan */}
                  Nenhum item na lista ainda. Adicione um item acima.
                </TableCell>
              </TableRow>
            ) : (
              safeGifts.map((item) => {
                // Add log for each item being rendered in the table
                // console.log("AdminItemManagementTable: Rendering table row for item:", item);
                return (
                <TableRow
                  key={item.id}
                  className={
                    actionLoading?.endsWith(item.id)
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }
                >
                    {/* Image Cell */}
                 <TableCell>
                   <div className="relative h-10 w-10 rounded-md overflow-hidden border bg-muted/50">
                     {item.imageUrl ? (
                       <Image
                         src={item.imageUrl}
                         alt={`Imagem de ${item.name}`}
                         fill
                         style={{ objectFit: "cover" }}
                         sizes="40px"
                         unoptimized={item.imageUrl.startsWith('data:image/')}
                       />
                     ) : (
                       <div className="flex items-center justify-center h-full w-full">
                         <ImageIcon className="h-5 w-5 text-muted-foreground" />
                       </div>
                     )}
                   </div>
                 </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {item.description || "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {item.category}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {item.selectedBy || "-"}
                    {item.selectionDate && typeof item.selectionDate === 'string' && (
                      <div className="text-[10px]">
                        (
                        {new Date(item.selectionDate).toLocaleDateString(
                          "pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' }
                        )}
                        )
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {actionLoading?.endsWith(item.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin inline-block text-muted-foreground" />
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(item)}
                          title="Editar Item"
                          disabled={!!actionLoading}
                          aria-label={`Editar item ${item.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {(item.status === "selected" ||
                          item.status === "not_needed") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevert(item)}
                            title="Reverter para Disponível"
                            disabled={!!actionLoading}
                            aria-label={`Reverter item ${item.name} para disponível`}
                          >
                            <RotateCcw className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                         {/* Show "Mark as Not Needed" only if item is 'available' or 'selected' */}
                         {(item.status === "available" || item.status === "selected") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMarkNotNeeded(item)}
                            title="Marcar como Não Precisa"
                            disabled={!!actionLoading}
                            aria-label={`Marcar item ${item.name} como não precisa`}
                          >
                            <Ban className="h-4 w-4 text-yellow-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          title="Excluir Item"
                          disabled={!!actionLoading}
                          aria-label={`Excluir item ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddEditDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Item" : "Adicionar Novo Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Modifique os detalhes do item, incluindo seu status e quem o selecionou."
                : "Preencha os detalhes do novo item para a lista."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name-dialog" className="text-right text-sm font-medium">
                Nome*
              </Label>
              <div className="col-span-3">
                <Input
                  id="name-dialog" // Unique ID for dialog input
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                  maxLength={100}
                  aria-required="true"
                  aria-invalid={!!errors.name}
                  aria-describedby="name-error"
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>
            {/* Description */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label
                htmlFor="description-dialog"
                className="text-right text-sm font-medium pt-2"
              >
                Descrição
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="description-dialog" // Unique ID
                  {...register("description")}
                  rows={3}
                  maxLength={200}
                  aria-invalid={!!errors.description}
                  aria-describedby="description-error"
                   disabled={isSubmitting}
                />
                {errors.description && (
                  <p id="description-error" className="text-sm text-destructive mt-1">
                    {errors.description.message}
                  </p>
                )}
              </div>
            </div>
            {/* Category */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="category-dialog" // Unique ID
                className="text-right text-sm font-medium"
              >
                Categoria*
              </Label>
              <div className="col-span-3">
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: "Categoria é obrigatória." }} // Add rule here too
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue=""
                      aria-required="true"
                       disabled={isSubmitting}
                    >
                      <SelectTrigger
                       id="category-dialog" // Unique ID
                        className={errors.category ? "border-destructive" : ""}
                        aria-invalid={!!errors.category}
                        aria-describedby="category-error"
                      >
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && (
                  <p id="category-error" className="text-sm text-destructive mt-1">
                    {errors.category.message}
                  </p>
                )}
              </div>
            </div>

            {/* Image Upload */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label
                htmlFor="imageFile-dialog"
                className="text-right text-sm font-medium pt-2"
              >
                Imagem
              </Label>
              <div className="col-span-3">
                <div className="flex items-center gap-4">
                  {imagePreview && (
                    <div className="relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0">
                       <Image
                         key={imagePreview}
                         src={imagePreview}
                         alt="Prévia da imagem do item"
                         fill
                         style={{ objectFit: 'cover' }}
                         sizes="64px"
                         unoptimized={imagePreview.startsWith('data:image/')}
                         onError={() => setImagePreview(null)} // Clear preview on error
                       />
                       <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-0.5 right-0.5 h-5 w-5 z-10 rounded-full opacity-70 hover:opacity-100"
                          onClick={removeImage}
                          title="Remover Imagem"
                          disabled={isSubmitting}
                       >
                          <XCircle className="h-3 w-3" />
                       </Button>
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="imageFile-dialog" // Unique ID
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      {...register("imageFile")} // Register directly
                      className={` ${errors.imageFile ? "border-destructive" : ""} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, GIF, WebP (Máx 5MB).
                    </p>
                     {errors.imageFile && typeof errors.imageFile.message === 'string' && (
                      <p className="text-sm text-destructive mt-1">{errors.imageFile.message}</p>
                    )}
                     {errors.imageUrl && (
                        <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>
                     )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="status-dialog" // Unique ID
                className="text-right text-sm font-medium"
              >
                Status* {/* Made status mandatory */}
              </Label>
              <div className="col-span-3">
                <Controller
                  name="status"
                  control={control}
                   defaultValue={editingItem?.status || "available"} // Set default
                   rules={{ required: "Status é obrigatório." }} // Add required rule
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "available"} // Ensure a value is always selected
                       disabled={isSubmitting}
                    >
                      <SelectTrigger
                         id="status-dialog" // Unique ID
                         className={errors.status ? "border-destructive" : ""} // Add error styling
                         aria-invalid={!!errors.status}
                         aria-describedby="status-error"
                         aria-required="true" // Indicate required
                      >
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((stat) => (
                          <SelectItem key={stat} value={stat}>
                            {stat === "available" && "Disponível"}
                            {stat === "selected" && "Selecionado"}{" "}
                            {stat === "not_needed" && "Não Precisa"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                 {errors.status && (
                  <p id="status-error" className="text-sm text-destructive mt-1">
                    {errors.status.message}
                  </p>
                )}
              </div>
            </div>

            {/* Selected By - Conditionally shown and required */}
            {watchedStatus === "selected" && (
              <div className="grid grid-cols-4 items-center gap-4 animate-fade-in">
                <Label
                  htmlFor="selectedBy-dialog" // Unique ID
                  className="text-right text-sm font-medium"
                >
                  Selecionado Por*
                </Label>
                <div className="col-span-3">
                  <Input
                    id="selectedBy-dialog" // Unique ID
                    {...register("selectedBy")}
                    className={errors.selectedBy ? "border-destructive" : ""}
                    placeholder="Nome de quem selecionou"
                    maxLength={50}
                    aria-required={watchedStatus === "selected"}
                    aria-invalid={!!errors.selectedBy}
                    aria-describedby="selectedBy-error"
                     disabled={isSubmitting}
                  />
                  {/* Specific error message if status is selected but name is missing */}
                  {errors.selectedBy ? (
                     <p id="selectedBy-error" className="text-sm text-destructive mt-1">
                       {errors.selectedBy.message}
                     </p>
                  ) : (
                    watchedStatus === 'selected' && !watch('selectedBy') && (
                      <p id="selectedBy-error" className="text-sm text-destructive mt-1">
                         Nome é obrigatório quando o status é "Selecionado".
                      </p>
                    )
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Salvar Item
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
