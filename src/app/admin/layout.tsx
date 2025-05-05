import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin - Chá de Bebê",
  description: "Painel de administração da lista de presentes.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Basic layout, can be enhanced with admin-specific navigation if needed
    <div>{children}</div>
  );
}
