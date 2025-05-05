"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link"; // Import Link
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck,
  ListPlus,
  Users,
  FileDown,
  Settings,
  LogOut,
  AlertCircle,
  RefreshCcw,
  Home,
  Loader2, // Added Loader2
} from "lucide-react"; // Added Home icon
import AdminItemManagementTable from "@/components/admin/item-management-table";
import AdminSelectionViewer from "@/components/admin/selection-viewer";
import AdminEventSettingsForm from "@/components/admin/event-settings-form";
import { getGifts, exportGiftsToCSV, type GiftItem } from "@/data/gift-store"; // Import store functions
import { ThemeToggle } from "@/components/theme-toggle"; // Import ThemeToggle

// Hardcoded allowed admin emails and password (INSECURE!)
// IMPORTANT: Replace this with Firebase Authentication for production!
const ALLOWED_EMAILS = ["fernandopicardi@gmail.com", "naiaralofgren@gmail.com"];
const ADMIN_PASSWORD = "Safiras7!"; // Extremely insecure

// Define AdminLogin component outside AdminPage
interface AdminLoginProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  error: string | null;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  onSubmit,
}) => (
  <Card className="w-full max-w-md mx-auto animate-fade-in">
    <CardHeader>
      <CardTitle>Admin Login</CardTitle>
      <CardDescription>Acesse o painel de administração.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={onSubmit} className="space-y-4">
        {error &&
          !loading && ( // Only show login error if not loading
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro de Login</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email" // Added for convenience
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            placeholder="******" // Avoid showing the insecure password as placeholder
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="current-password" // Added for convenience
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
             <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
          ) : "Entrar"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-center text-muted-foreground">
        Use as credenciais fornecidas para acesso.
      </p>
    </CardContent>
  </Card>
);

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false); // State for loading gift data

  // Fetch gift data when authenticated - Removed useCallback, as it's not needed here
  const fetchAdminData = async () => {
    if (!isAuthenticated) return; // Don't fetch if not logged in
    setIsDataLoading(true);
    setError(null); // Clear previous data errors
    console.log("AdminPage: Fetching admin data..."); // Log data fetch
    try {
      const fetchedGifts = await getGifts(); // Using the updated getGifts
      setGifts(fetchedGifts);
       console.log("AdminPage: Fetched gifts count:", fetchedGifts.length); // Log count
    } catch (err) {
      console.error("Error fetching admin data:", err);
       if ((err as any)?.code === 'permission-denied') {
         setError("Permissão negada ao buscar dados. Verifique as regras do Firestore ou o login.");
       } else {
         setError("Falha ao carregar os dados dos presentes.");
       }
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAdminData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Fetch data only when isAuthenticated changes


  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Simulate network delay
    setTimeout(() => {
      // Basic client-side check (INSECURE!)
      // TODO: Replace with Firebase Authentication
      if (
        ALLOWED_EMAILS.includes(email.toLowerCase().trim()) &&
        password === ADMIN_PASSWORD
      ) {
        // Trim and lowercase email for comparison
        setIsAuthenticated(true);
        console.log("Admin Login Successful for:", email); // Log success
        // Fetch data will be triggered by useEffect
      } else {
        console.warn("Admin Login Failed for:", email); // Log failure
        setError("E-mail ou senha inválidos.");
      }
      setLoading(false);
      setPassword(""); // Clear password field after attempt
    }, 500);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setEmail("");
    setPassword("");
    setError(null);
    setGifts([]); // Clear data on logout
    console.log("Admin Logged Out"); // Log logout
  };

  const handleExport = async () => {
    try {
      const csvData = await exportGiftsToCSV();
      const blob = new Blob([`\uFEFF${csvData}`], {
        type: "text/csv;charset=utf-8;",
      }); // Add BOM for Excel compatibility
      const link = document.createElement("a");
      if (link.download !== undefined) {
        // Feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          `chadebebe_presentes_${new Date().toISOString().split("T")[0]}.csv`,
        );
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up
      } else {
        alert(
          "Seu navegador não suporta download direto. O CSV será exibido em uma nova aba.",
        );
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        // Note: revokeObjectURL cannot be called immediately here if opened in new tab
      }
    } catch (err) {
      console.error("Error exporting CSV:", err);
      alert("Erro ao gerar o arquivo CSV.");
    }
  };

  // Callback to refresh data when child components modify it - Removed useCallback
  const refreshData = () => {
     console.log("AdminPage: Refreshing data..."); // Log refresh trigger
    fetchAdminData();
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-screen bg-gradient-to-br from-background to-muted/30">
        {/* Render the extracted AdminLogin component */}
        <AdminLogin
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          error={error}
          loading={loading}
          onSubmit={handleLogin}
        />
      </div>
    );
  }

  // Render Admin Dashboard
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-primary" /> Painel de
          Administração
        </h1>
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <ThemeToggle /> {/* Add ThemeToggle button */}
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="mr-2 h-4 w-4" /> Página Inicial
            </Button>
          </Link>
          <Button
            onClick={refreshData}
            variant="outline"
            size="icon"
            disabled={isDataLoading}
            title="Atualizar Dados"
          >
            <RefreshCcw
              className={`h-4 w-4 ${isDataLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      {/* Security warning - Important for production */}
       <Alert variant="destructive">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Aviso de Segurança Importante</AlertTitle>
           <AlertDescription>
             Este painel está usando um método de login INSEGURO (senha fixa no código). É **ESSENCIAL** substituí-lo por Firebase Authentication ou outro método seguro antes de usar em produção para proteger os dados.
           </AlertDescription>
       </Alert>


      {error &&
        !isDataLoading && ( // Show data loading error separately only if not loading
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao Carregar Dados</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

      {/* Components now receive data and refresh callback */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="md:col-span-2 lg:col-span-3 bg-card">
          {" "}
          {/* Make Item Management take full width */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListPlus /> Gerenciar Itens
            </CardTitle>
            <CardDescription>
              Adicionar, editar, remover e atualizar status dos presentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDataLoading ? (
               <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="ml-2 text-muted-foreground">Carregando itens...</p>
                </div>
            ) : (
              <AdminItemManagementTable
                gifts={gifts}
                onDataChange={refreshData} // Pass refresh callback
              />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users /> Visualizar Seleções
            </CardTitle>
            <CardDescription>
              Ver quem selecionou quais itens e reverter seleções se necessário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDataLoading ? (
               <div className="flex items-center justify-center p-8">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="ml-2 text-muted-foreground">Carregando seleções...</p>
               </div>
            ) : (
              <AdminSelectionViewer
                selectedItems={gifts.filter((g) => g.status === "selected")}
                onDataChange={refreshData} // Pass refresh callback
              />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings /> Configurações do Evento
            </CardTitle>
            <CardDescription>
              Atualizar detalhes do evento e mensagens personalizadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Component fetches its own data, but might need refreshData if saving settings impacts other parts */}
            <AdminEventSettingsForm onSave={refreshData} />
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown /> Exportar Seleções
            </CardTitle>
            <CardDescription>
              Baixar a lista completa de itens e status em formato CSV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} className="mt-4">
              Exportar CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
