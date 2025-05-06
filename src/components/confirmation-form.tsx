"use client";

import React, { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { addConfirmation } from "@/data/gift-store"; // Import the server action

// Schema for the confirmation form
const ConfirmationSchema = z.object({
  names: z
    .string()
    .min(2, { message: "Por favor, insira pelo menos um nome." })
    .max(200, { message: "Lista de nomes muito longa." })
    .refine(
      (value) => value.split(",").every((name) => name.trim().length > 0),
      {
        message:
          "Certifique-se de que todos os nomes separados por vírgula são válidos.",
      },
    ),
});

type ConfirmationFormData = z.infer<typeof ConfirmationSchema>;

interface ConfirmationFormProps {
  onSuccess?: () => void; // Optional callback on successful confirmation
}

export default function ConfirmationForm({ onSuccess }: ConfirmationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ConfirmationFormData>({
    resolver: zodResolver(ConfirmationSchema),
    defaultValues: { names: "" },
  });

  const onSubmit: SubmitHandler<ConfirmationFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      // Split the input string by comma and trim whitespace
      const namesArray = data.names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (namesArray.length === 0) {
        toast({
          title: "Erro",
          description: "Por favor, insira nomes válidos.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      console.log("ConfirmationForm: Submitting names:", namesArray);
      await addConfirmation(namesArray);

      toast({
        title: "Presença Confirmada!",
        description: `Obrigado! A presença de ${namesArray.join(", ")} foi registrada.`,
        variant: "default",
        className: "bg-success text-success-foreground border-success",
      });

      reset(); // Clear the form
      onSuccess?.(); // Call the success callback if provided
    } catch (error: any) {
      console.error("Error confirming presence:", error);
      toast({
        title: "Erro ao Confirmar",
        description:
          error.message ||
          "Não foi possível registrar sua presença. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="names">Nome(s) (separados por vírgula)</Label>
        <Input
          id="names"
          placeholder="Ex: João Silva, Maria Silva"
          {...register("names")}
          className={errors.names ? "border-destructive" : ""}
          disabled={isSubmitting}
          aria-invalid={errors.names ? "true" : "false"}
          aria-describedby="names-error"
        />
        {errors.names && (
          <p id="names-error" className="text-sm text-destructive mt-1">
            {errors.names.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" /> Confirmar Presença
          </>
        )}
      </Button>
    </form>
  );
}
