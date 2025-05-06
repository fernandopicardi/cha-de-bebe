"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Removed Checkbox import
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Minus, Plus } from "lucide-react"; // Added Minus, Plus
import type { GiftItem } from "@/data/gift-store"; // Import type

// Interface now uses the imported type
interface SelectItemDialogProps {
  item: GiftItem; // Use imported type
  isOpen: boolean;
  onClose: () => void;
  // Updated onSuccess to remove email-related parameters
  onSuccess: (
    itemId: string,
    guestName: string,
    quantity: number,
  ) => Promise<void>;
}

// Define validation schema without quantity and email fields
const FormSchema = z.object({
  guestName: z
    .string()
    .min(2, { message: "Por favor, insira seu nome (mínimo 2 caracteres)." })
    .max(50, { message: "Nome muito longo (máximo 50 caracteres)." }),
  // Quantity is required, minimum 1
  quantity: z.number().min(1, "Selecione pelo menos 1 unidade."),
});
// Removed email validation logic

type FormData = z.infer<typeof FormSchema>;

export default function SelectItemDialog({
  item,
  isOpen,
  onClose,
  onSuccess,
}: SelectItemDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const isQuantityItem =
    typeof item.totalQuantity === "number" && item.totalQuantity > 0;
  const availableQuantity = isQuantityItem
    ? (item.totalQuantity ?? 0) - (item.selectedQuantity ?? 0)
    : 1;

  const {
    register,
    handleSubmit,
    watch, // Watch form values
    setValue, // Set form values programmatically
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      guestName: "",
      quantity: 1, // Default quantity to 1
    },
  });

  // Watch relevant fields
  const watchQuantity = watch("quantity");

  // Adjust quantity based on available amount
  useEffect(() => {
    if (watchQuantity > availableQuantity) {
      setValue("quantity", availableQuantity); // Adjust if exceeds available
    }
    if (watchQuantity < 1 && availableQuantity >= 1) {
      setValue("quantity", 1); // Ensure minimum is 1 if available
    }
  }, [watchQuantity, availableQuantity, setValue]);

  const incrementQuantity = () => {
    if (watchQuantity < availableQuantity) {
      setValue("quantity", watchQuantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (watchQuantity > 1) {
      setValue("quantity", watchQuantity - 1);
    }
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    // Validate quantity again just before submitting
    if (data.quantity > availableQuantity) {
      toast({
        title: "Erro",
        description: `Quantidade selecionada (${data.quantity}) excede a disponível (${availableQuantity}).`,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Call the success callback passed from the parent without email info
      await onSuccess(item.id, data.guestName, data.quantity);

      // Toast is handled within the onSuccess callback in gift-list.tsx after mutation completes
      reset(); // Reset form fields
      onClose(); // Close the dialog
    } catch (error: any) {
      console.error("Erro ao selecionar item:", error);
      toast({
        title: "Ops! Algo deu errado.",
        description:
          error.message ||
          "Não foi possível registrar sua seleção. Pode ser que alguém já tenha escolhido. Tente atualizar a página ou escolher outro item.", // More informative error
        variant: "destructive",
      });
      // Keep dialog open on error? Optional. onClose(); could be removed from finally.
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when dialog closes or item changes
  React.useEffect(() => {
    if (!isOpen) {
      reset({
        guestName: "",
        quantity: 1,
      }); // Ensure reset clears the field
    } else {
      // When opening, reset quantity to 1 if available
      reset({
        guestName: "",
        quantity: availableQuantity >= 1 ? 1 : 0,
      });
    }
  }, [isOpen, reset, item, availableQuantity]); // Add item and availableQuantity dependency

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>Confirmar Seleção</DialogTitle>
          <DialogDescription>
            Você escolheu o presente: <strong>{item.name}</strong>.
            {isQuantityItem && ` (${availableQuantity} disponíveis)`}
            Por favor, insira seu nome e a quantidade desejada para confirmar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          {/* Guest Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="guestName" className="text-right">
              Seu Nome
            </Label>
            <div className="col-span-3">
              <Input
                id="guestName"
                {...register("guestName")}
                className={`col-span-3 ${errors.guestName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                disabled={isSubmitting}
                aria-invalid={errors.guestName ? "true" : "false"}
                aria-describedby="guestName-error"
              />
              {errors.guestName && (
                <p
                  id="guestName-error"
                  className="text-sm text-destructive mt-1"
                >
                  {errors.guestName.message}
                </p>
              )}
            </div>
          </div>

          {/* Quantity Selector (only if isQuantityItem) */}
          {isQuantityItem && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantidade
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={decrementQuantity}
                  disabled={watchQuantity <= 1 || isSubmitting}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                {/* Hidden input to register the value with react-hook-form */}
                <Input
                  id="quantity"
                  type="number" // Keep as number for validation
                  {...register("quantity", { valueAsNumber: true })} // Register with valueAsNumber
                  className="w-16 text-center"
                  disabled={true} // Visually disabled, value managed by state/buttons
                  aria-invalid={errors.quantity ? "true" : "false"}
                  aria-describedby="quantity-error"
                />
                {/* Display the watched value visually */}
                {/* <span className="w-16 text-center border rounded-md px-3 py-2">{watchQuantity}</span> */}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={incrementQuantity}
                  disabled={watchQuantity >= availableQuantity || isSubmitting}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  de {availableQuantity}
                </span>
              </div>
              {/* Display quantity error message below the controls */}
              {errors.quantity && (
                <div className="col-start-2 col-span-3">
                  <p
                    id="quantity-error"
                    className="text-sm text-destructive mt-1"
                  >
                    {errors.quantity.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Removed Email Reminder Section */}

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              // Disable if trying to select 0 or less
              disabled={isSubmitting || watchQuantity <= 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Confirmar{" "}
                  {isQuantityItem ? `${watchQuantity} Unidade(s)` : "Presente"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}