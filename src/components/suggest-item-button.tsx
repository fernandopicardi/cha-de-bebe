
"use client";

import React, { useState, useCallback, useEffect } from "react";
import Image from 'next/image'; // Import Image
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Send, Image as ImageIcon, XCircle } from "lucide-react"; // Added icons
import { addSuggestion } from "@/data/gift-store";

// Constants for file validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];


// Define validation schema for adding an item
const AddItemSchema = z.object({
  itemName: z
    .string()
    .min(3, { message: "Nome do item muito curto (mínimo 3 caracteres)." })
    .max(100, { message: "Nome do item muito longo (máximo 100 caracteres)." }),
  itemDescription: z
    .string()
    .max(200, { message: "Descrição muito longa (máximo 200 caracteres)." })
    .optional(),
  suggesterName: z
    .string()
    .min(2, { message: "Por favor, insira seu nome (mínimo 2 caracteres)." })
    .max(50, { message: "Nome muito longo (máximo 50 caracteres)." }),
  imageUrl: z.string().optional().nullable(), // For storing the data URI
  imageFile: z.any().optional().nullable(), // For file input, handled separately
});

type AddItemFormData = z.infer<typeof AddItemSchema>;

// Add prop for callback
interface SuggestItemButtonProps {
    onSuggestionAdded?: () => void; // Callback to notify parent
}

export default function SuggestItemButton({ onSuggestionAdded }: SuggestItemButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<AddItemFormData>({
    resolver: zodResolver(AddItemSchema),
    defaultValues: {
      itemName: "",
      itemDescription: "",
      suggesterName: "",
      imageUrl: null,
      imageFile: null,
    },
  });

  const watchedImageFile = watch("imageFile");

  // Handle image preview updates
  useEffect(() => {
    if (!isClient) return;

    const fileList = watchedImageFile as FileList | null | undefined;
    const file = fileList?.[0];

    if (file) {
      // Client-side validation
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Erro de Arquivo",
          description: `Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        setValue("imageFile", null);
        setValue("imageUrl", getValues("imageUrl")); // Keep existing URL if any
        setImagePreview(getValues("imageUrl"));
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Erro de Arquivo",
          description: "Tipo inválido. Use JPG, PNG, GIF, WebP.",
          variant: "destructive",
        });
        setValue("imageFile", null);
         setValue("imageUrl", getValues("imageUrl"));
        setImagePreview(getValues("imageUrl"));
        return;
      }

      // Generate preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setValue("imageUrl", result, { shouldValidate: true }); // Store data URI
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    } else if (fileList === null || (typeof fileList === "object" && fileList?.length === 0)) {
      // File explicitly cleared, reset preview if it was showing a file preview
      const currentUrl = getValues("imageUrl");
      if (currentUrl && currentUrl.startsWith("data:image/")) {
         setValue("imageUrl", null);
         setImagePreview(null);
      } else {
          // Keep potential non-data URL (though unlikely in this context)
          setImagePreview(currentUrl || null);
      }

    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedImageFile, isClient, setValue, toast, getValues]);


  const removeImage = useCallback(() => {
    setValue("imageFile", null);
    setValue("imageUrl", null);
    setImagePreview(null);
    const fileInput = document.getElementById("imageFile-suggest") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
  }, [setValue]);

  const onSubmit: SubmitHandler<AddItemFormData> = async (data) => {
    setIsSubmitting(true);
    console.log("SuggestItemButton: Submitting suggestion:", {
      ...data,
      imageUrl: data.imageUrl ? data.imageUrl.substring(0, 50) + '...' : null,
      imageFile: data.imageFile ? '[File object]' : null
    });
    try {
      // addSuggestion now handles revalidation internally
      const newItem = await addSuggestion({
        itemName: data.itemName,
        itemDescription: data.itemDescription,
        suggesterName: data.suggesterName,
        imageUrl: data.imageUrl, // Pass the data URI
      });
      console.log("SuggestItemButton: Suggestion added successfully:", newItem);

      toast({
        title: (
          <div className="flex items-center gap-2">
            {" "}
            <PlusCircle className="h-5 w-5 text-success-foreground" /> Item
            Adicionado!{" "}
          </div>
        ),
        description: `Obrigado, ${data.suggesterName}! O item "${data.itemName}" foi adicionado à lista e marcado como escolhido por você.`,
        variant: "default",
        className: "bg-success text-success-foreground border-success",
      });

      // Call the callback function AFTER successful operation
      console.log("SuggestItemButton: Calling onSuggestionAdded callback.");
      onSuggestionAdded?.();

      reset(); // Reset form only after success
      setImagePreview(null); // Clear preview on success
      setIsOpen(false); // Close dialog only after success

    } catch (error) {
      console.error("Erro ao adicionar item:", error);
      toast({
        title: "Ops! Algo deu errado.",
        description: "Não foi possível adicionar seu item. Tente novamente.",
        variant: "destructive",
      });
      // Don't close dialog or reset form on error
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      reset(); // Reset form when dialog is closed
      setImagePreview(null); // Clear preview when dialog closes
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-accent text-accent-foreground hover:bg-accent/10"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar um Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-card">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Item à Lista</DialogTitle>
          <DialogDescription>
            Não encontrou o que procurava? Adicione um item à lista. Ele será
            automaticamente marcado como escolhido por você.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          {/* Item Name */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="itemName" className="text-right pt-2">
              Nome do Item*
            </Label>
            <div className="col-span-3">
              <Input
                id="itemName"
                {...register("itemName")}
                className={`${errors.itemName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                disabled={isSubmitting}
                aria-invalid={errors.itemName ? "true" : "false"}
              />
              {errors.itemName && (
                <p className="text-sm text-destructive mt-1">
                  {errors.itemName.message}
                </p>
              )}
            </div>
          </div>

          {/* Item Description (Optional) */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="itemDescription" className="text-right pt-2">
              Descrição
            </Label>
            <div className="col-span-3">
              <Textarea
                id="itemDescription"
                placeholder="Ex: Marca específica, cor, tamanho, link..."
                {...register("itemDescription")}
                className={`${errors.itemDescription ? "border-destructive focus-visible:ring-destructive" : ""}`}
                disabled={isSubmitting}
                aria-invalid={errors.itemDescription ? "true" : "false"}
              />
              {errors.itemDescription && (
                <p className="text-sm text-destructive mt-1">
                  {errors.itemDescription.message}
                </p>
              )}
            </div>
          </div>

          {/* Image Upload */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="imageFile-suggest" className="text-right pt-2">
              Imagem (Opc.)
            </Label>
            <div className="col-span-3">
               <div className="flex items-center gap-4">
                 {imagePreview && (
                    <div className="relative w-16 h-16 border rounded-md overflow-hidden shadow-inner bg-muted/50 flex-shrink-0">
                       <Image
                         key={imagePreview} // Force re-render on change
                         src={imagePreview}
                         alt="Prévia da imagem"
                         fill
                         style={{ objectFit: 'cover' }}
                         sizes="64px"
                         unoptimized={imagePreview.startsWith('data:image/')}
                         onError={() => setImagePreview(null)}
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
                      id="imageFile-suggest"
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      {...register("imageFile")}
                      className={` ${errors.imageFile ? "border-destructive" : ""} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
                      disabled={isSubmitting}
                    />
                     <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, GIF, WebP (Máx 5MB).
                    </p>
                     {errors.imageFile && typeof errors.imageFile.message === 'string' &&(
                       <p className="text-sm text-destructive mt-1">{errors.imageFile.message}</p>
                     )}
                      {errors.imageUrl && (
                        <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>
                     )}
                  </div>
               </div>
            </div>
          </div>


          {/* Suggester/Selector Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="suggesterName" className="text-right">
              Seu Nome*
            </Label>
            <div className="col-span-3">
              <Input
                id="suggesterName"
                {...register("suggesterName")}
                className={`${errors.suggesterName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                disabled={isSubmitting}
                aria-invalid={errors.suggesterName ? "true" : "false"}
              />
              {errors.suggesterName && (
                <p className="text-sm text-destructive mt-1">
                  {errors.suggesterName.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Adicionar e Escolher Item
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
