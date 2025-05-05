
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image"; // Import next/image
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Image as ImageIcon, XCircle } from "lucide-react"; // Added icons
import {
  getEventSettings,
  updateEventSettings,
  type EventSettings,
} from "@/data/gift-store";

interface AdminEventSettingsFormProps {
  initialSettings: EventSettings | null; // Receive initial settings as prop
  onSave?: () => void; // Callback to trigger parent refresh
  isLoading?: boolean; // Add loading state prop
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

// Zod schema WITHOUT FileList validation (this part runs server-side during build)
const settingsFormSchema = z
  .object({
    title: z
      .string()
      .min(5, "Título muito curto.")
      .max(100, "Título muito longo."), // Added max length
    babyName: z.string().optional().nullable().or(z.literal("")), // Allow empty string or null
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (AAAA-MM-DD)."),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:MM)."),
    location: z
      .string()
      .min(3, "Local muito curto.")
      .max(100, "Local muito longo."), // Added max length
    address: z
      .string()
      .min(10, "Endereço muito curto.")
      .max(200, "Endereço muito longo."), // Added max length
    welcomeMessage: z
      .string()
      .min(10, "Mensagem de boas-vindas muito curta.")
      .max(500, "Mensagem muito longa."), // Increased max length
    headerImageUrl: z.string().optional().nullable(), // Allow string URL or data URI or null
    // headerImageFile is handled by react-hook-form but not validated by this schema directly anymore
    headerImageFile: z.any().optional().nullable(), // Use z.any() for RHF; validation happens in onSubmit
  })
  .refine(
    (data) => {
      // Validate existing URL if no file is being uploaded
      // Skip this if headerImageFile exists (its validation happens in onSubmit)
      if (
        data.headerImageFile &&
        typeof data.headerImageFile === "object" &&
        data.headerImageFile.length > 0
      ) {
        return true; // File is present, validation happens later
      }
      // Validate existing URL if no file is present
      return (
        !data.headerImageUrl ||
        data.headerImageUrl.startsWith("data:image/") ||
        data.headerImageUrl.startsWith("http")
      );
    },
    {
      message:
        "URL da imagem inválido. Deve ser um URL http(s) ou uma imagem carregada.",
      path: ["headerImageUrl"], // Path for the error message
    },
  );

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export default function AdminEventSettingsForm({
  initialSettings,
  onSave,
  isLoading, // Receive loading state
}: AdminEventSettingsFormProps) {
  const { toast } = useToast();
  // isLoading might not be needed if initialSettings are always provided
  const [imagePreview, setImagePreview] = useState<string | null>(null); // State for client-side preview
  const [isClient, setIsClient] = useState(false); // Track if component has mounted

  useEffect(() => {
    setIsClient(true); // Set client state after mount
    // Set initial preview based on the passed prop
    if (initialSettings) {
       console.log("EventSettingsForm: Setting initial preview from prop:", initialSettings.headerImageUrl?.substring(0, 50) + "...");
      setImagePreview(initialSettings.headerImageUrl || null);
    } else {
        console.log("EventSettingsForm: No initial settings provided, clearing preview.");
        setImagePreview(null);
    }
  }, [initialSettings]); // Rerun effect when initialSettings prop changes

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema), // Use the schema without FileList validation
    // Use initialSettings prop for defaultValues
    defaultValues: initialSettings
      ? {
          ...initialSettings,
          headerImageUrl: initialSettings.headerImageUrl || null,
          headerImageFile: null,
          babyName: initialSettings.babyName || "",
        }
      : { // Provide defaults if initialSettings is null
          title: "Chá de Bebê",
          babyName: "",
          date: "",
          time: "",
          location: "",
          address: "",
          welcomeMessage: "",
          headerImageUrl: null,
          headerImageFile: null,
        },
  });

   // Reset form if initialSettings prop changes after initial mount
   useEffect(() => {
    if (initialSettings && isClient) { // Ensure reset happens only on client and when settings change
        console.log("EventSettingsForm: Resetting form with new initialSettings prop.", initialSettings.title);
        reset({
            ...initialSettings,
            headerImageUrl: initialSettings.headerImageUrl || null,
            headerImageFile: null, // Always reset file input
            babyName: initialSettings.babyName || "",
        });
        setImagePreview(initialSettings.headerImageUrl || null); // Update preview as well
    }
   }, [initialSettings, reset, isClient]);

  // Watch the FileList from the input
  const watchedFileList = watch("headerImageFile");

  // Update preview and RHF URL field when file selection changes (Client-side only)
  useEffect(() => {
    if (!isClient) return; // Only run on the client

    const fileList = watchedFileList as FileList | null | undefined; // Explicitly type
    const file = fileList?.[0]; // Get the first file from the FileList

    if (file) {
      // Manual Client-Side Validation (redundant if done in onSubmit, but good for early feedback)
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Erro de Arquivo",
          description: `Tamanho máximo do arquivo é ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        setValue("headerImageFile", null, { shouldValidate: true }); // Clear invalid file
        // Restore previous URL if available, otherwise null
         const prevUrl = initialSettings?.headerImageUrl || null;
         setValue("headerImageUrl", prevUrl);
         setImagePreview(prevUrl);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Erro de Arquivo",
          description: "Tipo de arquivo inválido. Use JPG, PNG, GIF, WebP.",
          variant: "destructive",
        });
         setValue("headerImageFile", null, { shouldValidate: true });
         const prevUrl = initialSettings?.headerImageUrl || null;
         setValue("headerImageUrl", prevUrl);
         setImagePreview(prevUrl);
        return;
      }

      // Generate data URI for preview and store it in headerImageUrl
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log("EventSettingsForm: Generated data URI preview.");
        setValue("headerImageUrl", result, { shouldValidate: true }); // Store data URI in headerImageUrl
        setImagePreview(result); // Update client-side preview state
      };
      reader.onerror = (err) => {
        console.error("useEffect: FileReader error:", err);
        toast({
          title: "Erro",
          description: "Falha ao ler o arquivo de imagem.",
          variant: "destructive",
        });
        setValue("headerImageFile", null, { shouldValidate: true });
         const prevUrl = initialSettings?.headerImageUrl || null;
         setValue("headerImageUrl", prevUrl);
         setImagePreview(prevUrl);
      };
      reader.readAsDataURL(file);
    } else if (
      fileList === null ||
      (typeof fileList === "object" && fileList?.length === 0)
    ) {
      // File was explicitly cleared or reset
      // If headerImageUrl still holds a valid http URL from initialSettings, restore the preview for it
      const currentUrl = initialSettings?.headerImageUrl;
      if (currentUrl && currentUrl.startsWith("http")) {
         console.log("EventSettingsForm: File cleared, restoring preview to initial URL:", currentUrl);
        setImagePreview(currentUrl);
        setValue("headerImageUrl", currentUrl); // Ensure RHF state also reverts
      } else {
         // If the file was cleared and there was no HTTP URL, clear preview/state
         // Check if the current RHF value is a data URI (meaning a file was previously selected but now cleared)
         const rhfUrl = getValues("headerImageUrl");
         if (rhfUrl && rhfUrl.startsWith("data:")) {
             console.log("EventSettingsForm: File cleared, clearing data URI and preview.");
             setImagePreview(null);
             setValue("headerImageUrl", null); // Ensure RHF state also clears
         } else {
             // Keep existing non-data URL if present, otherwise null
              console.log("EventSettingsForm: File cleared, keeping existing non-data URL or null:", rhfUrl);
             setImagePreview(rhfUrl || null);
             setValue("headerImageUrl", rhfUrl || null);
         }
      }
    }
    // else: Initial load or no file selected - preview is managed by defaultValues/reset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFileList, isClient, setValue, toast, initialSettings]); // Add initialSettings dependency

  const removeImage = useCallback(async () => {
    console.log("EventSettingsForm: Removing image.");
    setValue("headerImageFile", null, { shouldValidate: true }); // Clear the FileList in RHF state
    setValue("headerImageUrl", null, { shouldValidate: true }); // Clear the URL in RHF state
    setImagePreview(null); // Clear the preview state
    // Manually clear the file input element itself
    const fileInput = document.getElementById(
      "headerImageFile",
    ) as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = "";
    }
  }, [setValue]);

  const onSubmit = async (data: SettingsFormData) => {
    console.log("EventSettingsForm: Submitting form data...", { ...data, headerImageUrl: data.headerImageUrl?.substring(0, 50) + "..." }); // Log truncated URI
    // --- Client-Side File Validation ---
    const fileList = data.headerImageFile as FileList | null | undefined;
    const file = fileList?.[0];

    let finalImageUrl: string | null = data.headerImageUrl; // Start with the value from RHF (could be data URI or original URL)

    if (file) {
      console.log("EventSettingsForm: File detected during submission.");
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Erro de Envio",
          description: `Tamanho máximo do arquivo é ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        return; // Stop submission
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Erro de Envio",
          description: "Tipo de arquivo inválido. Use JPG, PNG, GIF, WebP.",
          variant: "destructive",
        });
        return; // Stop submission
      }
       // If file is valid, the data URI should already be in finalImageUrl via RHF state
       console.log("EventSettingsForm: Using data URI from RHF for headerImageUrl.");
    } else {
        console.log("EventSettingsForm: No new file detected. Using current headerImageUrl value:", finalImageUrl?.substring(0, 50) + "...");
    }
    // --- End Client-Side File Validation ---

    // Prepare data for saving (excluding the FileList reference)
    const settingsToSave: Partial<EventSettings> = {
      title: data.title,
      babyName: data.babyName || null,
      date: data.date,
      time: data.time,
      location: data.location,
      address: data.address,
      welcomeMessage: data.welcomeMessage,
      // Use the finalImageUrl determined above
      headerImageUrl: finalImageUrl,
    };

     console.log("EventSettingsForm: Calling updateEventSettings with:", { ...settingsToSave, headerImageUrl: settingsToSave.headerImageUrl?.substring(0, 50) + "..." });

    try {
      // updateEventSettings now handles revalidation internally
      const updatedSettings = await updateEventSettings(settingsToSave);
      console.log("EventSettingsForm: updateEventSettings successful. Result:", updatedSettings);

      toast({
        title: "Sucesso!",
        description: "Detalhes do evento atualizados.",
      });

      // Trigger parent refresh AFTER successful update and revalidation
      console.log("EventSettingsForm: Save successful, calling onSave callback.");
      onSave?.();

      // Clear the file input field visually after successful save
      const fileInput = document.getElementById(
        "headerImageFile",
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      // RHF reset will happen when the parent re-fetches and passes new initialSettings


    } catch (error) {
      console.error("Error saving event settings:", error);
      toast({
        title: "Erro!",
        description: "Falha ao salvar os detalhes do evento.",
        variant: "destructive",
      });
    }
  };

  // Show loader if parent indicates data is loading OR if initial settings haven't arrived yet on client
  if (isLoading || (!isClient && !initialSettings)) {
     console.log("EventSettingsForm: Initial loading state (isLoading:", isLoading, ", !isClient:", !isClient, ", !initialSettings:", !initialSettings, ")");
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="ml-2 text-muted-foreground">
          Carregando configurações...
        </p>
      </div>
    );
  }

   console.log("EventSettingsForm: Rendering form. Image preview:", imagePreview?.substring(0, 50) + "...");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-2">
        <Label htmlFor="title">Título do Evento*</Label>
        <Input
          id="title"
          {...register("title")}
          className={errors.title ? "border-destructive" : ""}
          maxLength={100}
          disabled={isSubmitting} // Disable during submission
        />
        {errors.title && (
          <p className="text-sm text-destructive mt-1">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="babyName">Nome do Bebê (Opcional)</Label>
        <Input
          id="babyName"
          {...register("babyName")}
          placeholder="Ex: da Maria, do João..."
          className={errors.babyName ? "border-destructive" : ""}
          disabled={isSubmitting} // Disable during submission
        />
        {errors.babyName && (
          <p className="text-sm text-destructive mt-1">
            {errors.babyName.message}
          </p>
        )}
      </div>

      {/* Header Image Upload */}
      <div className="grid gap-2">
        <Label htmlFor="headerImageFile">Foto do Cabeçalho (Opcional)</Label>
        <div className="flex items-center gap-4">
          {/* Use client-side imagePreview state */}
          {imagePreview && (
            <div className="relative w-24 h-24 border rounded-md overflow-hidden shadow-inner bg-muted/50">
              <Image
                key={imagePreview} // Use preview URL as key to force re-render
                src={imagePreview}
                alt="Prévia da imagem do cabeçalho"
                fill
                style={{ objectFit: "cover" }}
                sizes="96px" // Fixed size for preview
                data-ai-hint="baby celebration banner"
                onError={(e) => {
                  console.error(
                    "Error loading image preview:",
                    imagePreview.substring(0, 50) + "...",
                    e,
                  );
                  toast({
                    title: "Erro",
                    description:
                      "Não foi possível carregar a prévia da imagem.",
                    variant: "destructive",
                  });
                  setImagePreview(null); // Clear preview on error
                }}
                 unoptimized={imagePreview.startsWith('data:image/')} // Disable optimization for data URIs
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 z-10 rounded-full opacity-70 hover:opacity-100"
                onClick={removeImage}
                title="Remover Imagem"
                disabled={isSubmitting}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex-1">
            {/* Let react-hook-form handle the file input directly */}
            <Input
              id="headerImageFile"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")} // Use defined constants
              {...register("headerImageFile")} // Register directly
              className={` ${errors.headerImageFile ? "border-destructive" : ""} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer`}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Envie uma imagem (JPG, PNG, GIF, WebP). Máx 5MB.
            </p>
            {/* Display error from Zod schema validation (excluding file for now) */}
            {errors.headerImageFile &&
              typeof errors.headerImageFile.message === "string" && (
                <p className="text-sm text-destructive mt-1">
                  {errors.headerImageFile.message}
                </p>
              )}
            {/* Display error for the URL field */}
            {errors.headerImageUrl && (
              <p className="text-sm text-destructive mt-1">
                {errors.headerImageUrl.message}
              </p>
            )}
            {/* Display hint about existing image only if no file is staged and there's a non-data URL */}
            {!watchedFileList?.length &&
              imagePreview &&
              !imagePreview.startsWith("data:") && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Usando imagem salva anteriormente. Envie nova para substituir
                  ou clique em remover.
                </p>
              )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="date">Data* (AAAA-MM-DD)</Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
            className={errors.date ? "border-destructive" : ""}
            disabled={isSubmitting} // Disable during submission
          />
          {errors.date && (
            <p className="text-sm text-destructive mt-1">
              {errors.date.message}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="time">Hora* (HH:MM)</Label>
          <Input
            id="time"
            type="time"
            {...register("time")}
            className={errors.time ? "border-destructive" : ""}
            disabled={isSubmitting} // Disable during submission
          />
          {errors.time && (
            <p className="text-sm text-destructive mt-1">
              {errors.time.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="location">Local*</Label>
        <Input
          id="location"
          {...register("location")}
          className={errors.location ? "border-destructive" : ""}
          maxLength={100}
          disabled={isSubmitting} // Disable during submission
        />
        {errors.location && (
          <p className="text-sm text-destructive mt-1">
            {errors.location.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="address">Endereço Completo*</Label>
        <Input
          id="address"
          {...register("address")}
          className={errors.address ? "border-destructive" : ""}
          maxLength={200}
          disabled={isSubmitting} // Disable during submission
        />
        {errors.address && (
          <p className="text-sm text-destructive mt-1">
            {errors.address.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="welcomeMessage">Mensagem de Boas-Vindas*</Label>
        <Textarea
          id="welcomeMessage"
          {...register("welcomeMessage")}
          className={errors.welcomeMessage ? "border-destructive" : ""}
          rows={4} // Set default rows
          maxLength={500}
          disabled={isSubmitting} // Disable during submission
        />
        {errors.welcomeMessage && (
          <p className="text-sm text-destructive mt-1">
            {errors.welcomeMessage.message}
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting || isLoading}> {/* Also disable if parent is loading */}
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Salvar Detalhes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

    