"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area"; // For potential large lists
import { CalendarDays, User } from "lucide-react";
import type { Confirmation } from "@/data/gift-store"; // Import the type

interface AdminConfirmationsListProps {
  confirmations: Confirmation[];
}

export default function AdminConfirmationsList({ confirmations }: AdminConfirmationsListProps) {

  // Flatten the confirmations into a list of individual names with their confirmation date
  const individualAttendees = confirmations.flatMap(confirmation =>
    confirmation.names.map(name => ({
      id: `${confirmation.id}-${name}`, // Create a unique-ish key
      name: name,
      confirmedAt: confirmation.confirmedAt,
    }))
  ).sort((a, b) => {
      // Sort by date descending primarily, then by name alphabetically
      const dateA = a.confirmedAt ? new Date(a.confirmedAt).getTime() : 0;
      const dateB = b.confirmedAt ? new Date(b.confirmedAt).getTime() : 0;
      if (dateB !== dateA) {
          return dateB - dateA;
      }
      return a.name.localeCompare(b.name);
  });


  const formatDateTime = (isoString: string | null | undefined): string => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch (e) {
      return "-";
    }
  };

  return (
    <div className="space-y-4">
       <p className="text-sm text-muted-foreground">
           Total de convidados confirmados: {individualAttendees.length}
       </p>
      <ScrollArea className="h-72 rounded-md border"> {/* Added ScrollArea */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                 <User className="inline-block mr-1 h-4 w-4" />
                 Nome do Convidado
              </TableHead>
              <TableHead className="text-right">
                 <CalendarDays className="inline-block mr-1 h-4 w-4" />
                 Data da Confirmação
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {individualAttendees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center">
                  Nenhuma presença confirmada ainda.
                </TableCell>
              </TableRow>
            ) : (
              individualAttendees.map((attendee) => (
                <TableRow key={attendee.id}>
                  <TableCell className="font-medium">{attendee.name}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                     {formatDateTime(attendee.confirmedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
