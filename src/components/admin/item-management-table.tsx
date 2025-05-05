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
  // Holds existing URL, new data URI, or null for removal
  imageUrl: z.string().optional().nullable(),
  // Captures file input
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
        toast({ title: "Erro de Arquivo", description: `Máx ${MAX_FILE_SIZE / 1024 / 1024}MB.`, variant: "destructive" });
        setValue("imageFile", null); // Clear invalid file
        const initialUrl = editingItem?.imageUrl || null;
        setValue("imageUrl", initialUrl);
        setImagePreview(initialUrl);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ title: "Erro de Arquivo", description: "Tipo inválido (JPG, PNG, GIF, WebP).", variant: "destructive" });
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
        console.log("AdminItemManagementTable Dialog: Generated data URI preview.");
        setValue("imageUrl", result, { shouldValidate: true }); // Store data URI
        setImagePreview(result);
      };
      reader.onerror = (err) => console.error("FileReader error:", err);
      reader.readAsDataURL(file);
    } else if (fileList === null || (typeof fileList === "object" && fileList?.length === 0)) {
        // File cleared, revert preview/URL to initial state if a file *was* staged
         const initialUrl = editingItem?.imageUrl || null;
         const currentRHFUrl = getValues("imageUrl");
         if (currentRHFUrl && currentRHFUrl.startsWith("data:")) {
             console.log("AdminItemManagementTable Dialog: File selection cleared, reverting preview/URL to initial state:", initialUrl);
             setValue("imageUrl", initialUrl);
             setImagePreview(initialUrl);
         }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedImageFile, isClient, setValue, toast, editingItem, getValues]);


  const handleOpenAddDialog = () => {
    console.log("AdminItemManagementTable: Opening ADD dialog.");
    reset({ // Reset form for adding a new item
      name: "",
      description: "",
      category: "",
      status: "available",
      selectedBy: "",
      imageUrl: null,
      imageFile: null,
    });
    setEditingItem(null);
    setImagePreview(null);
    setIsAddEditDialogOpen(true);
  };

  const handleOpenEditDialog = (item: GiftItem) => {
    console.log(`AdminItemManagementTable: Opening EDIT dialog for item ID: ${item.id}`, item);
    setEditingItem(item);
    reset({ // Populate form with the selected item's data
      name: item.name,
      description: item.description || "",
      category: item.category,
      status: item.status,
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
    setImagePreview(null);
    reset({
        name: "", description: "", category: "", status: "available",
        selectedBy: "", imageUrl: null, imageFile: null,
      });
  };

  // Function to remove the image (sets imageUrl to null for submission)
  const removeImage = useCallback(() => {
    console.log("AdminItemManagementTable Dialog: Requesting image removal.");
    setValue("imageFile", null); // Clear file input
    setValue("imageUrl", null); // Set URL to null for removal signal
    setImagePreview(null); // Clear preview state
    const fileInput = document.getElementById("imageFile-dialog") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
  }, [setValue]);

  // Show toast and trigger parent refresh after data store mutation completes
  const handleSuccess = (message: string) => {
     console.log(`AdminItemManagementTable: Operation successful - ${message}. Triggering onDataChange.`);
     toast({ title: "Sucesso!", description: message });
     onDataChange?.();
     handleDialogClose();
  };

  const handleError = (operation: string, itemName: string, errorDetails?: any) => {
    console.error(`AdminItemManagementTable: Error during ${operation} for "${itemName}":`, errorDetails);
    toast({ title: "Erro!", description: `Falha ao ${operation.toLowerCase()} "${itemName}". Verifique console.`, variant: "destructive" });
  };

  // Form submission for Add/Edit
  const onSubmit = async (data: GiftFormData) => {
    const operation = editingItem ? "atualizar" : "adicionar";
    const itemName = data.name || (editingItem ? editingItem.name : 'Novo Item');
    console.log(`AdminItemManagementTable: Submitting form to ${operation} item: ${itemName}`);

    // Validate that 'selectedBy' is provided if status is 'selected'
    if (data.status === "selected" && (!data.selectedBy || data.selectedBy.trim() === "")) {
      toast({ title: "Erro de Validação", description: "Informe quem selecionou.", variant: "destructive" });
      return;
    }

    // Prepare data for the store functions
    // Pass data.imageUrl directly - it contains existing URL, new data URI, or null
    const giftPayload = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category: data.category,
        status: data.status,
        selectedBy: data.status === "selected" ? (data.selectedBy?.trim() || "Admin") : null,
        // Pass the image data (data URI or null) or the existing URL
        // For updates, pass the imageUrl field from the form.
        // For adds, pass the imageDataUri field (which is stored in imageUrl by the useEffect).
        [editingItem ? 'imageUrl' : 'imageDataUri']: data.imageUrl, // Use correct field name based on operation
    };


    // Remove the imageFile property before sending to backend
     const { imageFile, ...storeData } = data;

     // Create the payload with potentially the imageDataUri for adds, or imageUrl for updates
     const finalPayload = {
        ...storeData,
        name: storeData.name.trim(),
        description: storeData.description?.trim() || null,
        selectedBy: storeData.status === 'selected' ? (storeData.selectedBy?.trim() || "Admin") : null,
        // imageUrl now holds either existing URL, data URI, or null
        ...(editingItem ? { imageUrl: storeData.imageUrl } : { imageDataUri: storeData.imageUrl }),
     };

     // Remove the other unnecessary image field depending on the operation
     if (editingItem) {
       delete (finalPayload as any).imageDataUri;
     } else {
       delete (finalPayload as any).imageUrl; // Remove imageUrl for adds, pass imageDataUri
     }


    try {
      if (editingItem) {
        console.log(`AdminItemManagementTable: Calling updateGift for ID: ${editingItem.id}`);
        // Pass the full payload for update, including the potentially new imageUrl (data URI or null)
        await updateGift(editingItem.id, finalPayload as Partial<GiftItem> & { imageDataUri?: string | null });
        handleSuccess(`Item "${finalPayload.name}" atualizado.`);
      } else {
        console.log("AdminItemManagementTable: Calling addGift");
        // Pass the payload with imageDataUri for adds
        await addGift(finalPayload as Omit<GiftItem, "id" | "createdAt" | "selectionDate"> & { imageDataUri?: string | null });
        handleSuccess(`Item "${finalPayload.name}" adicionado.`);
      }
    } catch (error) {
      handleError(operation, itemName, error);
    }
  };

  // Row Action: Delete
  const handleDelete = async (item: GiftItem) => {
    if (actionLoading) return;
    console.log(`AdminItemManagementTable: Attempting to delete item ID: ${item.id}`);
    if (confirm(`Excluir "${item.name}"? Ação irreversível.`)) {
      setActionLoading(`delete-${item.id}`);
      try {
        // deleteGift now handles image deletion and revalidation
        const success = await deleteGift(item.id);
        if (success) {
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
        console.log(`AdminItemManagementTable: Delete cancelled for item ID: ${item.id}`);
    }
  };

  // Row Action: Revert to Available
  const handleRevert = async (item: GiftItem) => {
    if (actionLoading) return;
    if (item.status !== "selected" && item.status !== "not_needed") return;
    const actionText = item.status === "selected" ? "reverter seleção" : 'remover "Não Precisa"';
    const guestNameInfo = item.selectedBy ? ` por ${item.selectedBy}` : "";
     console.log(`AdminItemManagementTable: Attempting to revert item ID: ${item.id}`);
    if (confirm(`Tem certeza que deseja ${actionText} de "${item.name}"${guestNameInfo}?`)) {
      setActionLoading(`revert-${item.id}`);
      try {
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
    if (item.status === "not_needed") return;
     console.log(`AdminItemManagementTable: Attempting to mark item ID: ${item.id} as not needed.`);
    if (confirm(`Marcar "${item.name}" como "Não Precisa"?`)) {
      setActionLoading(`mark-${item.id}`);
      try {
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
        return <Badge variant="default" className="bg-success text-success-foreground">Disponível</Badge>;
      case "selected":
        return <Badge variant="secondary" className="bg-secondary text-secondary-foreground">Selecionado</Badge>;
      case "not_needed":
        return <Badge variant="destructive" className="bg-destructive/80 text-destructive-foreground">Não Precisa</Badge>;
      default:
        return <Badge variant="outline">Indefinido</Badge>;
    }
  };

  console.log(`AdminItemManagementTable: Rendering table. Number of safeGifts: ${safeGifts.length}`);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleOpenAddDialog} size="sm" disabled={isSubmitting || !!actionLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Item
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]"></TableHead> {/* Image col */}
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Selecionado Por</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeGifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center"> {/* Updated colSpan */}
                  Nenhum item na lista ainda. Adicione um item acima.
                </TableCell>
              </TableRow>
            ) : (
              safeGifts.map((item) => (
                <TableRow
                  key={item.id}
                  className={actionLoading?.endsWith(item.id) ? "opacity-50 pointer-events-none" : ""}
                >
                  <TableCell>
                    <div className="relative h-10 w-10 rounded-md overflow-hidden border bg-muted/50">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={`Imagem de ${item.name}`}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="40px"
                          unoptimized={item.imageUrl.startsWith('data:')} // Still needed if data URIs are used for previews
                          onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display='none'; }} // Basic error handling
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full w-full">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{item.description || "-"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{item.category}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {item.selectedBy || "-"}
                    {item.selectionDate && typeof item.selectionDate === 'string' && (
                      <div className="text-[10px]">
                        ({new Date(item.selectionDate).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' })})
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {actionLoading?.endsWith(item.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin inline-block text-muted-foreground" />
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(item)} title="Editar Item" disabled={!!actionLoading} aria-label={`Editar ${item.name}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {(item.status === "selected" || item.status === "not_needed") && (
                          <Button variant="ghost" size="icon" onClick={() => handleRevert(item)} title="Reverter para Disponível" disabled={!!actionLoading} aria-label={`Reverter ${item.name}`}>
                            <RotateCcw className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                         {(item.status === "available" || item.status === "selected") && (
                          <Button variant="ghost" size="icon" onClick={() => handleMarkNotNeeded(item)} title="Marcar como Não Precisa" disabled={!!actionLoading} aria-label={`Marcar ${item.name} como não precisa`}>
                            <Ban className="h-4 w-4 text-yellow-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} title="Excluir Item" disabled={!!actionLoading} aria-label={`Excluir ${item.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddEditDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Adicionar Novo Item"}</DialogTitle>
            <DialogDescription>{editingItem ? "Modifique os detalhes." : "Preencha os detalhes."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name-dialog" className="text-right">Nome*</Label>
              <div className="col-span-3">
                <Input id="name-dialog" {...register("name")} className={errors.name ? "border-destructive" : ""} maxLength={100} disabled={isSubmitting} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
            </div>
            {/* Description */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description-dialog" className="text-right pt-2">Descrição</Label>
              <div className="col-span-3">
                <Textarea id="description-dialog" {...register("description")} rows={3} maxLength={200} disabled={isSubmitting}/>
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>
            </div>
            {/* Category */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category-dialog" className="text-right">Categoria*</Label>
              <div className="col-span-3">
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: "Categoria é obrigatória." }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} defaultValue="" disabled={isSubmitting}>
                      <SelectTrigger id="category-dialog" className={errors.category ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
              </div>
            </div>

            {/* Image Upload */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="imageFile-dialog" className="text-right pt-2">Imagem</Label>
              <div className="col-span-3">
                <div className="flex items-center gap-4">
                  {imagePreview && (
                    <div className="relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0">
                       <Image
                         key={imagePreview}
                         src={imagePreview}
                         alt="Prévia da imagem"
                         fill
                         style={{ objectFit: 'cover' }}
                         sizes="64px"
                         unoptimized={imagePreview.startsWith('data:')} // Unoptimize data URIs
                         onError={() => setImagePreview(null)} // Clear preview on error
                       />
                       <Button type="button" variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5 z-10 rounded-full opacity-70 hover:opacity-100" onClick={removeImage} title="Remover Imagem" disabled={isSubmitting}>
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
                      className={`${errors.imageFile ? "border-destructive" : ""} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF, WebP (Máx 5MB).</p>
                     {errors.imageFile && typeof errors.imageFile.message === 'string' && (<p className="text-sm text-destructive mt-1">{errors.imageFile.message}</p>)}
                     {errors.imageUrl && (<p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>)}
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status-dialog" className="text-right">Status*</Label>
              <div className="col-span-3">
                <Controller
                  name="status"
                  control={control}
                  defaultValue={editingItem?.status || "available"}
                  rules={{ required: "Status é obrigatório." }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || "available"} disabled={isSubmitting}>
                      <SelectTrigger id="status-dialog" className={errors.status ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((stat) => (<SelectItem key={stat} value={stat}>{stat === "available" && "Disponível"}{stat === "selected" && "Selecionado"} {stat === "not_needed" && "Não Precisa"}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                />
                 {errors.status && <p id="status-error" className="text-sm text-destructive mt-1">{errors.status.message}</p>}
              </div>
            </div>

            {/* Selected By - Conditionally shown */}
            {watchedStatus === "selected" && (
              <div className="grid grid-cols-4 items-center gap-4 animate-fade-in">
                <Label htmlFor="selectedBy-dialog" className="text-right">Selecionado Por*</Label>
                <div className="col-span-3">
                  <Input id="selectedBy-dialog" {...register("selectedBy")} className={errors.selectedBy ? "border-destructive" : ""} placeholder="Nome de quem selecionou" maxLength={50} disabled={isSubmitting} />
                  {errors.selectedBy ? (<p className="text-sm text-destructive mt-1">{errors.selectedBy.message}</p>) : (watchedStatus === 'selected' && !watch('selectedBy') && (<p className="text-sm text-destructive mt-1">Nome obrigatório.</p>))}
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>) : (<><Save className="mr-2 h-4 w-4" /> Salvar Item</>)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
