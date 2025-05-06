import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login Admin - Chá de Bebê", // Changed title for login context
  description: "Acesso ao painel de administração da lista de presentes.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Basic layout, can be enhanced with admin-specific navigation if needed
    // Ensure it doesn't add extra wrappers that might interfere with child page layout
    <>{children}</>
  );
}
