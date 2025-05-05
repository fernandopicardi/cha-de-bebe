"use client";

import React, { useState } from "react";
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
import { Loader2, PlusCircle, Send } from "lucide-react";
import { addSuggestion } from "@/data/gift-store";

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
});

type AddItemFormData = z.infer<typeof AddItemSchema>;

// No longer needs onSuggestionAdded prop
interface SuggestItemButtonProps {}

export default function SuggestItemButton({}: SuggestItemButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddItemFormData>({
    resolver: zodResolver(AddItemSchema),
    defaultValues: {
      itemName: "",
      itemDescription: "",
      suggesterName: "",
    },
  });

  const onSubmit: SubmitHandler<AddItemFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      // addSuggestion now handles revalidation internally
      const newItem = await addSuggestion({
        itemName: data.itemName,
        itemDescription: data.itemDescription,
        suggesterName: data.suggesterName,
      });

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
      reset();
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao adicionar item:", error);
      toast({
        title: "Ops! Algo deu errado.",
        description: "Não foi possível adicionar seu item. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      reset();
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
