/**
 * Manages gift items within the admin panel, allowing for CRUD operations.
 * Features:
 * - Displays a table of existing gift items.
 * - Allows adding new items via a dialog.
 * - Allows editing existing items via a dialog.
 * - Handles image upload/preview/removal for items.
 * - Supports quantity-based items and single items.
 * - Provides actions to delete, revert selection, or mark items as not needed.
 * - Uses Zod for form validation and React Hook Form for form management.
 * - Communicates with `gift-store.ts` for data persistence.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"; // Added useEffect and useMemo
import Image from "next/image"; // Import next/image
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
} from "@/components/ui/dialog"; // Removed DialogTrigger as it's handled by button onClick
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
  Package, // Icon for quantity
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
  addGiftAdmin, // Use specific admin add function
  updateGift,
  deleteGift,
  revertSelection,
  markGiftAsNotNeeded,
  type GiftItem,
} from "@/data/gift-store";
import { getGifts } from "@/data/gift-store";
import * as z from "zod";
import { useForm, Controller } from "react-hook-form";

interface AdminItemManagementTableProps {
  gifts: GiftItem[]; // Expecting gifts array
  onDataChange?: () => void; // Callback for parent component refresh
}
// Constants for file validation (used client-side) - Updated to 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "video/mp4", // Add video types
  "video/quicktime",
  "image/webp",
  "image/gif",
];

// Validation Schema for the Add/Edit Form
// Use z.any() for file to avoid SSR errors
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
  // Holds existing URL, new data URI, or null for removal
  imageUrl: z.string().optional().nullable(),
  // Captures file input - Use z.any() or z.unknown() for SSR safety
  imageFile: z.any().optional().nullable(), // Use z.any() for FileList
  // Quantity field - optional, must be a positive integer if provided
  totalQuantity: z.preprocess(
    (val) => (val === "" ? null : Number(val)), // Convert empty string to null, otherwise to number
    z
      .number()
      .int()
      .positive("Quantidade deve ser um número positivo.")
      .nullable()
      .optional() // Allow null or positive int
  ),
});

type GiftFormData = z.infer<typeof giftFormSchema>;

// Available categories
const categories = ["Roupas", "Higiene", "Brinquedos", "Alimentação", "Outros"];
// Available statuses for selection in the edit dialog
const statuses: GiftItem["status"][] = ["available", "selected", "not_needed"];

export default function AdminItemManagementTable({

  onDataChange,
}: AdminItemManagementTableProps) {
    
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null); // State for image preview in dialog
  const [isClient, setIsClient] = useState(false); // Track client mount

  useEffect(() => {
    setIsClient(true); // Component has mounted
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const result = await getGifts();
      setGifts(result);
    };
    fetchData();
  }, []);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    trigger, // Add trigger for manual validation
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
      totalQuantity: null, // Default quantity
    },
  });

  // Watch status to conditionally show/require selectedBy
  const watchedStatus = watch("status");
  const watchedImageFile = watch("imageFile");
  const watchedTotalQuantity = watch("totalQuantity"); // Watch quantity changes

  // Handle image preview updates
  useEffect(() => {
    // Ensure this runs only on the client where FileList and File are defined
    if (!isClient) return;

    // Safely check if watchedImageFile is a FileList
    let fileList: FileList | null = null;
    if (
      typeof FileList !== "undefined" &&
      watchedImageFile instanceof FileList
    ) {
      fileList = watchedImageFile;
    } else if (watchedImageFile === null || watchedImageFile === undefined) {
      // If imageFile is null or undefined (e.g., cleared or never selected),
      // ensure dataUri and preview reflect the initial state or lack of image.
      const initialUrl = editingItem?.imageUrl || null;
      const currentRHFUrl = getValues("imageUrl");
      if (currentRHFUrl && currentRHFUrl.startsWith("data:")) {
        // Only revert if a file *was* staged (RHF imageUrl is a data URI)
        console.log(
          "AdminItemManagementTable Dialog: imageFile cleared, reverting preview/URL to initial state:",
          initialUrl
        );
        setValue("imageUrl", initialUrl);
        setImagePreview(initialUrl);
      } else if (!currentRHFUrl && !initialUrl) {
        // No file, no initial URL. Ensure preview is null.
        setImagePreview(null);
        setValue("imageUrl", null);
      }
      return; // Don't proceed if it's not a valid FileList
    } else {
      console.warn(
        "AdminItemManagementTable Dialog: Watched imageFile is not a FileList, null, or undefined:",
        watchedImageFile
      );
      // Attempt to reset to initial state if it's some other unexpected value
      const initialUrl = editingItem?.imageUrl || null;
      setValue("imageFile", null); // Clear the invalid RHF imageFile value
      setValue("imageUrl", initialUrl);
      setImagePreview(initialUrl);
      return;
    }

    const file = fileList?.[0];

    if (file) {
      // Ensure it's a File object before proceeding
      if (!(file instanceof File)) {
        console.warn(
          "AdminItemManagementTable Dialog: Watched imageFile is not a File object:",
          file
        );
        setValue("imageFile", null); // Clear if not a File
        const initialUrl = editingItem?.imageUrl || null;
        setValue("imageUrl", initialUrl);
        setImagePreview(initialUrl);
        return;
      }

      // Client-side validation (critical now that Zod schema is less strict)
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Erro de Arquivo",
          description: `Máx ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        setValue("imageFile", null); // Clear invalid file
        const initialUrl = editingItem?.imageUrl || null;
        setValue("imageUrl", initialUrl);
        setImagePreview(initialUrl);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Erro de Arquivo",
          description: "Tipo inválido (JPG, PNG, GIF, WebP, MP4, MOV).",
          variant: "destructive",
        });
        setValue("imageFile", null);
        const initialUrl = editingItem?.imageUrl || null;
        setValue("imageUrl", initialUrl);
        setImagePreview(initialUrl);
        return;
      }

      // Generate data URI for preview and store in RHF's imageUrl field
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log(
          "AdminItemManagementTable Dialog: Generated data URI preview."
        );
        setValue("imageUrl", result); // Store data URI
        setImagePreview(result);
      };
      reader.onerror = (err) => {
        console.error("FileReader error:", err);
        toast({
          title: "Erro ao Ler Arquivo",
          description: "Não foi possível carregar a prévia.",
          variant: "destructive",
        });
        // Revert to initial state on reader error
        const initialUrl = editingItem?.imageUrl || null;
        setValue("imageFile", null);
        setValue("imageUrl", initialUrl);
        setImagePreview(initialUrl);
      };
      reader.readAsDataURL(file);
    }
    // No 'else if' for fileList === null here as it's handled at the top of the useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watchedImageFile,
    isClient,
    setValue,
    toast,
    editingItem,
    getValues,
    trigger,
  ]);

  const handleOpenAddDialog = () => {
    console.log("AdminItemManagementTable: Opening ADD dialog.");
    reset({
      // Reset form for adding a new item
      name: "",
      description: "",
      category: "",
      status: "available",
      selectedBy: "",
      imageUrl: null,
      imageFile: null,
      totalQuantity: null, // Reset quantity
    });
    setEditingItem(null);
    setImagePreview(null);
    setIsAddEditDialogOpen(true);
  };

  const handleOpenEditDialog = (item: GiftItem) => {
    console.log(
      `AdminItemManagementTable: Opening EDIT dialog for item ID: ${item.id}`,
      item
    );
    setEditingItem(item);
    reset({
      // Populate form with the selected item's data
      name: item.name,
      description: item.description || "",
      category: item.category,
      status: item.status,
      selectedBy: item.selectedBy || "",
      imageUrl: item.imageUrl || null, // Set initial image URL
      imageFile: null, // Reset file input
      totalQuantity: item.totalQuantity ?? null, // Set initial quantity
    });
    setImagePreview(item.imageUrl || null); // Set initial preview
    setIsAddEditDialogOpen(true);
  };

  const handleDialogClose = () => {
    console.log("AdminItemManagementTable: Closing dialog.");
    setIsAddEditDialogOpen(false);
    setEditingItem(null);
    setImagePreview(null);
    reset({
      name: "",
      description: "",
      category: "",
      status: "available",
      selectedBy: "",
      imageUrl: null,
      imageFile: null,
      totalQuantity: null,
    });
  };

  // Function to remove the image (sets imageUrl to null for submission)
  const removeImage = useCallback(() => {
    console.log("AdminItemManagementTable Dialog: Requesting image removal.");
    setValue("imageFile", null); // Clear file input state
    setValue("imageUrl", null); // Set URL to null for removal signal
    setImagePreview(null); // Clear preview state
    const fileInput = document.getElementById(
      "imageFile-dialog"
    ) as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    // trigger("imageFile"); // Re-validate after removing (optional)
  }, [setValue, trigger]);

  // Show toast and trigger parent refresh after data store mutation completes
  const handleSuccess = (message: string) => {
    console.log(
      `AdminItemManagementTable: Operation successful - ${message}. Triggering onDataChange.`
    );
    toast({ title: "Sucesso!", description: message });
    onDataChange?.();
    
    const fetchData = async () => {
      const result = await getGifts();
      setGifts(result);
    };
    fetchData();
    
    handleDialogClose();
  };

  const handleError = (
    operation: string,
    itemName: string, 
    errorDetails?: any
  ) => {
    console.error(
      `AdminItemManagementTable: Error during ${operation} for "${itemName}":`,
      errorDetails
    );
    // Check for specific Firebase error messages
    let description = `Falha ao ${operation.toLowerCase()} o item "${itemName}". Verifique o console.`;
    if (errorDetails instanceof Error) {
      if (errorDetails.message.includes("invalid data")) {
        description = `Dados inválidos fornecidos para ${operation.toLowerCase()} "${itemName}". Verifique os campos.`;
      } else if (errorDetails.message.includes("PERMISSION_DENIED")) {
        description = `Permissão negada para ${operation.toLowerCase()} "${itemName}". Verifique as regras do Firestore.`;
      }
    } else if (errorDetails?.code === "permission-denied") {
      description = `Permissão negada para ${operation.toLowerCase()} "${itemName}". Verifique as regras do Firestore.`;
    }
    toast({ title: "Erro!", description: description, variant: "destructive" });
  };

  // Form submission for Add/Edit
  const onSubmit = async (data: GiftFormData) => {
    const operation = editingItem ? "atualizar" : "adicionar";
    const itemName =
      data.name || (editingItem ? editingItem.name : "Novo Item");
    console.log(
      `AdminItemManagementTable: Submitting form to ${operation} item: ${itemName}`
    );

    const isQuantityItem =
      typeof data.totalQuantity === "number" && data.totalQuantity > 0;

    // Validate that 'selectedBy' is provided if status is 'selected' AND it's NOT a quantity item
    if (
      !isQuantityItem &&
      data.status === "selected" &&
      (!data.selectedBy || data.selectedBy.trim() === "")
    ) {
      toast({
        title: "Erro de Validação",
        description: "Informe quem selecionou.",
        variant: "destructive",
      });
      return;
    }

    // If it's a quantity item, don't allow 'selected' status directly in the form
    // The status will be derived based on selected vs total quantities in the backend/display
    if (isQuantityItem && data.status === "selected") {
      console.warn(
        "AdminItemManagementTable: Cannot manually set status to 'selected' for quantity items via admin form. Status will be derived."
      );
      data.status = "available"; // Force status to available for quantity items added/edited via admin
    }

    // The imageUrl field now holds either existing URL, data URI, or null
    const imageValue = data.imageUrl;

    // Create the payload
    const finalPayload: Partial<GiftItem> & {
      imageDataUri?: string | null;
    } = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category,
      status: data.status,
      // SelectedBy is only relevant for non-quantity items or is set by user selection
      selectedBy: isQuantityItem
        ? null
        : data.status === "selected"
        ? data.selectedBy?.trim() || "Admin"
        : null,
      totalQuantity: isQuantityItem ? data.totalQuantity : null, // Include total quantity
      // Pass image information based on operation and content of imageValue
      ...(editingItem
        ? { imageUrl: imageValue } // For updates, pass the current imageUrl (could be data URI, existing URL, or null)
        : { imageDataUri: imageValue }), // For adds, pass as imageDataUri (could be data URI or null)
    };

    try {
      if (editingItem) {
        console.log(
          `AdminItemManagementTable: Calling updateGift for ID: ${editingItem.id}`,
          finalPayload
        );
        await updateGift(editingItem.id, finalPayload);
        handleSuccess(`Item "${finalPayload.name}" atualizado.`);
        
        setGifts((prevGifts) =>
          prevGifts.map((g) => (g.id === editingItem.id ? { ...g, ...finalPayload } : g))
        );
        
      } else {
        console.log("AdminItemManagementTable: Calling addGiftAdmin");
        // Use addGiftAdmin for adding items from the admin panel
        const newItem = await addGiftAdmin(finalPayload);
        setGifts((prevGifts) => [...prevGifts, newItem]);

        
        handleSuccess(`Item "${finalPayload.name}" adicionado.`);
      }
    } catch (error) {
      handleError(operation, itemName, error);
    }
  };

  // Row Action: Delete
  const handleDelete = async (item: GiftItem) => {
    if (actionLoading) return;
    console.log(
      `AdminItemManagementTable: Attempting to delete item ID: ${item.id}`
    );
    if (confirm(`Excluir "${item.name}"? Ação irreversível.`)) {
      setActionLoading(`delete-${item.id}`);
      try {
        // deleteGift now handles image deletion and revalidation
        const success = await deleteGift(item.id);

        if (success) {
          setGifts((prevGifts) => prevGifts.filter((g) => g.id !== item.id));
          handleSuccess(`Item "${item.name}" excluído.`);
        } else {
          handleError("excluir", item.name, "Delete operation failed.");
          
          
          
        }
      } catch (error) {
        handleError("excluir", item.name, error);
      } finally {
        setActionLoading(null);
      }
    } else {
      console.log(
        `AdminItemManagementTable: Delete cancelled for item ID: ${item.id}`
      );
    }
  };

  // Row Action: Revert to Available
  // Note: Reverting quantity items needs more complex logic (e.g., tracking individual selections)
  // For now, disable revert for quantity items in the UI.
  const handleRevert = async (item: GiftItem) => {
    if (actionLoading) return;
    if (item.status !== "selected" && item.status !== "not_needed") return;
    // Disable revert for quantity items for now
    if (item.totalQuantity != null && item.totalQuantity > 0) {
      toast({
        title: "Ação Indisponível",
        description:
          "Reversão de itens com quantidade não suportada nesta versão.",
        variant: "default",
      });
      return;
    }

    const actionText =
      item.status === "selected" ? "reverter seleção" : 'remover "Não Precisa"';
    const guestNameInfo = item.selectedBy ? ` por ${item.selectedBy}` : "";
    console.log(
      `AdminItemManagementTable: Attempting to revert item ID: ${item.id}`
    );
    if (
      confirm(
        `Tem certeza que deseja ${actionText} de "${item.name}"${guestNameInfo}?`
      )
    ) {
      setActionLoading(`revert-${item.id}`);
      try {
        await revertSelection(item.id);
        handleSuccess(`Item "${item.name}" revertido para disponível.`);
        setGifts((prevGifts) =>
          prevGifts.map((g) => (g.id === item.id ? { ...g, status: 'available', selectedBy:null } : g))
        );
      } catch (error) {
        handleError("reverter", item.name, error);
      } finally {
        setActionLoading(null);
      }
    } else {
      console.log(
        `AdminItemManagementTable: Revert cancelled for item ID: ${item.id}`
      );
    }
  };

  // Row Action: Mark as Not Needed
  const handleMarkNotNeeded = async (item: GiftItem) => {
    if (actionLoading) return;
    if (item.status === "not_needed") return;
    console.log(
      `AdminItemManagementTable: Attempting to mark item ID: ${item.id} as not needed.`
    );
    if (confirm(`Marcar "${item.name}" como "Não Precisa"?`)) {
      setActionLoading(`mark-${item.id}`);
      try {
        await markGiftAsNotNeeded(item.id);
        handleSuccess(`Item "${item.name}" marcado como "Não Precisa".`);
        setGifts((prevGifts) =>
          prevGifts.map((g) => (g.id === item.id ? { ...g, status: 'not_needed' } : g))
        );
        
      } catch (error) {
        handleError('marcar como "Não Precisa"', item.name, error);
      } finally {
        setActionLoading(null);
      }
    } else {
      console.log(
        `AdminItemManagementTable: Mark as not needed cancelled for item ID: ${item.id}`
      );
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
            Sugestão Disponível
          </Badge>
        );
      case "selected":
        return (
          <Badge
            variant="secondary"
            className="bg-secondary text-secondary-foreground"
          >
            Já Escolhido
          </Badge>
        );
      case "not_needed":
        return (
          <Badge
            variant="destructive"
            className="bg-destructive/80 text-destructive-foreground"
          >
            Preferimos Não Utilizar
          </Badge>
        );
      default:
        return <Badge variant="outline">Indefinido</Badge>;
    }
  };

  const formatDateTime = (isoString: string | null | undefined): string => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      // Format as DD/MM/YYYY, HH:MM
      return isNaN(date.getTime())
        ? "-"
        : date.toLocaleString("pt-BR", {
            year: "numeric", // Changed from 2-digit
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
    } catch (e) {
      return "-";
    }
  };

  console.log(
    `AdminItemManagementTable: Rendering table. Number of safeGifts: ${gifts.length}`
  );

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
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]"></TableHead> {/* Image col */}
              <TableHead>Nome</TableHead>
              <TableHead className="hidden lg:table-cell">Descrição</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quantidade</TableHead> {/* New Quantity Column */}
              <TableHead className="hidden xl:table-cell">
                Selecionado Por
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  
                  {/* Updated colSpan */}
                  Nenhum item na lista ainda. Adicione um item acima.
                </TableCell>
              </TableRow>
            ) : (
              safeGifts.map((item) => {
                const isQuantityItem =
                  item.totalQuantity !== null && item.totalQuantity > 0;
                const displayedStatus =
                  isQuantityItem &&
                  item.selectedQuantity !== undefined &&
                  item.totalQuantity != null &&
                  item.selectedQuantity >= item.totalQuantity
                    ? "selected"
                    : item.status;
                const canRevert =
                  !isQuantityItem &&
                  (displayedStatus === "selected" ||
                    displayedStatus === "not_needed");

                return (
                  <TableRow                
                    key={item.id}
                    className={
                      actionLoading?.endsWith(item.id)
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                  >
                    <TableCell>
                      <div className="relative h-10 w-10 rounded-md overflow-hidden border bg-muted/50 flex-shrink-0">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={`Imagem de ${item.name}`}
                            fill
                            style={{ objectFit: "cover" }}
                            sizes="40px"
                            unoptimized={item.imageUrl.startsWith("data:")} // Still needed if data URIs are used for previews
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "";
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }} // Basic error handling
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {item.name}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-xs truncate">
                      {item.description || "-"} 
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.category}
                    </TableCell>
                    <TableCell>{getStatusBadge(displayedStatus)}</TableCell>
                    <TableCell className="text-center text-sm">
                      {isQuantityItem ? (
                        <span className="whitespace-nowrap">
                          {item.selectedQuantity ?? 0} /{" "}
                          {item.totalQuantity ?? 0}
                        </span>
                      ) : item.totalQuantity != null &&
                        item.totalQuantity > 0 ? (
                        (item.selectedQuantity ?? 0) +
                        " / " +
                        item.totalQuantity
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                      {/* Show selectedBy only if NOT a quantity item or if fully selected */}
                      {(!isQuantityItem || displayedStatus === "selected") &&
                      item.selectedBy ? (
                        <>
                          {item.selectedBy}
                          {item.selectionDate && (
                            <div className="text-[10px]">
                              ({formatDateTime(item.selectionDate)}){" "}
                              {/* Format date here */}
                            </div>
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
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
                            aria-label={`Editar ${item.name}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {/* Revert Button - Disabled for quantity items */}
                          {canRevert && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRevert(item)}
                              title="Reverter para Disponível"
                              disabled={!!actionLoading}
                              aria-label={`Reverter ${item.name}`}
                            >
                              <RotateCcw className="h-4 w-4 text-orange-600" />
                            </Button>
                          )}
                          {/* Mark as Not Needed Button */}
                          {(displayedStatus === "available" ||
                            displayedStatus === "selected") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkNotNeeded(item)}
                              title="Marcar como Não Precisa"
                              disabled={!!actionLoading}
                              aria-label={`Marcar ${item.name} como não precisa`}
                            >
                              <Ban className="h-4 w-4 text-yellow-600" />
                            </Button>
                          )}
                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            title="Excluir Item"
                            disabled={!!actionLoading}
                            aria-label={`Excluir ${item.name}`}
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
              {editingItem ? "Modifique os detalhes." : "Preencha os detalhes."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name-dialog" className="text-right">
                Nome*
              </Label>
              <div className="col-span-3">
                <Input
                  id="name-dialog"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                  maxLength={100}
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>
            {/* Description */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description-dialog" className="text-right pt-2">
                Descrição
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="description-dialog"
                  {...register("description")}
                  rows={3}
                  maxLength={200}
                  disabled={isSubmitting}
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.description.message}
                  </p>
                )}
              </div>
            </div>
            {/* Category */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category-dialog" className="text-right">
                Categoria*
              </Label>
              <div className="col-span-3">
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: "Categoria é obrigatória." }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue=""
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        id="category-dialog"
                        className={errors.category ? "border-destructive" : ""}
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
                  <p className="text-sm text-destructive mt-1">
                    {errors.category.message}
                  </p>
                )}
              </div>
            </div>

            {/* Total Quantity */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="totalQuantity-dialog" className="text-right">
                Qtd. Total
              </Label>
              <div className="col-span-3">
                <Input
                  id="totalQuantity-dialog"
                  type="number"
                  placeholder="Deixe vazio para item único"
                  {...register("totalQuantity")}
                  className={errors.totalQuantity ? "border-destructive" : ""}
                  min="1" // HTML5 validation for positive number
                  disabled={isSubmitting || watchedStatus === "selected"} // Disable if status is selected
                />
                {errors.totalQuantity && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.totalQuantity.message}
                  </p>
                )}
                {watchedStatus === "selected" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Status 'Selecionado' não pode ter quantidade.
                  </p>
                )}
              </div>
            </div>

            {/* Image Upload */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="imageFile-dialog" className="text-right pt-2">
                Imagem
              </Label>
              <div className="col-span-3">
                <div className="flex items-center gap-4">
                  {imagePreview && (
                    <div className="relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0">
                      <Image
                        key={imagePreview}
                        src={imagePreview}
                        alt="Prévia da imagem"
                        fill
                        style={{ objectFit: "cover" }}
                        sizes="64px"
                        unoptimized={imagePreview.startsWith("data:")} // Unoptimize data URIs
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
                      id="imageFile-dialog"
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      {...register("imageFile")} // Register directly
                      className={`${
                        errors.imageFile ? "border-destructive" : ""
                      } file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, GIF, WebP (Máx 50MB).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vídeos (MP4, MOV) também são aceitos.
                    </p>
                    {errors.imageFile &&
                      typeof errors.imageFile.message === "string" && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.imageFile.message}
                        </p>
                      )}
                    {errors.imageUrl && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.imageUrl.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status-dialog" className="text-right">
                Status*
              </Label>
              <div className="col-span-3">
                <Controller
                  name="status"
                  control={control}
                  defaultValue={editingItem?.status || "available"}
                  rules={{ required: "Status é obrigatório." }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "available"}
                      // Disable 'selected' if it's a quantity item
                      disabled={
                        isSubmitting ||
                        (!!watchedTotalQuantity && watchedTotalQuantity > 0)
                      }
                    >
                      <SelectTrigger
                        id="status-dialog"
                        className={errors.status ? "border-destructive" : ""}
                      >
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((stat) => (
                          <SelectItem
                            key={stat}
                            value={stat}
                            // Disable 'selected' option for quantity items
                            disabled={
                              stat === "selected" &&
                              !!watchedTotalQuantity &&
                              watchedTotalQuantity > 0
                            }
                          >
                            {stat === "available" && "Sugestão Disponível"}
                            {stat === "selected" && "Já Escolhido"}
                            {stat === "not_needed" && "Preferimos Não Utilizar"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.status && (
                  <p
                    id="status-error"
                    className="text-sm text-destructive mt-1"
                  >
                    {errors.status.message}
                  </p>
                )}
                {!!watchedTotalQuantity && watchedTotalQuantity > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Status é definido automaticamente para itens com quantidade.
                  </p>
                )}
              </div>
            </div>

            {/* Selected By - Conditionally shown only for non-quantity items */}
            {watchedStatus === "selected" &&
              (!watchedTotalQuantity || watchedTotalQuantity <= 0) && (
                <div className="grid grid-cols-4 items-center gap-4 animate-fade-in">
                  <Label htmlFor="selectedBy-dialog" className="text-right">
                    Selecionado Por*
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="selectedBy-dialog"
                      {...register("selectedBy")}
                      className={errors.selectedBy ? "border-destructive" : ""}
                      placeholder="Nome de quem selecionou"
                      maxLength={50}
                      disabled={isSubmitting}
                    />
                    {errors.selectedBy ? (
                      <p className="text-sm text-destructive mt-1">
                        {errors.selectedBy.message}
                      </p>
                    ) : (
                      watchedStatus === "selected" &&
                      !watch("selectedBy") && (
                        <p className="text-sm text-destructive mt-1">
                          Nome obrigatório.
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
