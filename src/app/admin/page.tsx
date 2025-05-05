
"use client";

import React, { useState, useEffect, useCallback } from "react"; // Added useCallback back
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
  Loader2,
} from "lucide-react"; // Added Home icon and Loader2
import AdminItemManagementTable from "@/components/admin/item-management-table";
import AdminSelectionViewer from "@/components/admin/selection-viewer";
import AdminEventSettingsForm from "@/components/admin/event-settings-form";
import { getGifts, exportGiftsToCSV, type GiftItem, initializeFirestoreData, getEventSettings, type EventSettings } from "@/data/gift-store"; // Import store functions and GiftItem type
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
  const [loading, setLoading] = useState(false); // Login loading
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null); // Add state for event settings
  const [isDataLoading, setIsDataLoading] = useState(false); // State for loading gift data

  // Use useCallback for fetchAdminData to ensure stable reference
  const fetchAdminData = useCallback(async (source?: string) => {
    if (!isAuthenticated) return; // Don't fetch if not logged in

    console.log(`Admin Page: Fetching admin data (triggered by ${source || 'unknown'})...`);
    setIsDataLoading(true);
    setError(null); // Clear previous data errors

    try {
      // Fetch both gifts and event settings
      const giftsPromise = getGifts();
      const settingsPromise = getEventSettings();

      const [fetchedGifts, fetchedSettings] = await Promise.all([giftsPromise, settingsPromise]);

      console.log("Admin Page: Fetched gifts count:", fetchedGifts.length);
      console.log("Admin Page: Fetched settings:", !!fetchedSettings);
      // console.log("Admin Page: Fetched gifts sample:", fetchedGifts.slice(0, 3)); // Log sample data

      console.log("Admin Page: Setting gifts state...");
      setGifts(fetchedGifts);
      console.log("Admin Page: Setting event settings state...");
      setEventSettings(fetchedSettings); // Store settings
    } catch (err: any) { // Catch specific error types if possible
      console.error("Admin Page: Error fetching admin data:", err);
      if (err?.code === 'permission-denied') {
        setError("Permissão negada ao buscar dados. Verifique as regras do Firestore ou se o login/regras de admin estão corretos.");
      } else {
        setError(`Falha ao carregar os dados: ${err.message || 'Erro desconhecido'}`);
      }
      console.log("Admin Page: Clearing state due to fetch error.");
      setGifts([]); // Clear gifts on error
      setEventSettings(null); // Clear settings on error
    } finally {
      setIsDataLoading(false);
      console.log("Admin Page: Fetching complete, data loading set to false.");
    }
  // Include isAuthenticated in dependency array for useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // useEffect to fetch data when authentication status changes
  useEffect(() => {
    if (isAuthenticated) {
      console.log("Admin Page (useEffect): Authenticated, triggering data fetch...");
      fetchAdminData("useEffect[isAuthenticated]");
    } else {
      console.log("Admin Page (useEffect): Not authenticated, clearing data.");
      setGifts([]); // Clear data if logged out
      setEventSettings(null); // Clear settings if logged out
    }
  }, [isAuthenticated, fetchAdminData]); // Add fetchAdminData to dependency array


  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Simulate network delay (optional)
    setTimeout(() => {
      // Basic client-side check (INSECURE!)
      // TODO: Replace with Firebase Authentication
      if (
        ALLOWED_EMAILS.includes(email.toLowerCase().trim()) &&
        password === ADMIN_PASSWORD
      ) {
        // Trim and lowercase email for comparison
        console.log("Admin Login Successful for:", email); // Log success
        setIsAuthenticated(true); // Set state, useEffect will trigger data fetch
      } else {
        console.warn("Admin Login Failed for:", email); // Log failure
        setError("E-mail ou senha inválidos.");
        setIsAuthenticated(false); // Ensure not authenticated
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
    // gifts and settings will be cleared by the useEffect hook
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

  // Callback to refresh data when child components modify it
  // Use useCallback to ensure the function reference is stable
  const refreshData = useCallback(() => {
     console.log("Admin Page: Manual refresh triggered (calling fetchAdminData)...");
    fetchAdminData("refreshData callback");
  }, [fetchAdminData]); // Depend on fetchAdminData

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

  // Add a log here to check the state just before render
  console.log(`Admin Page: Rendering dashboard. Gifts count: ${gifts.length}. Settings exists: ${!!eventSettings}. Loading: ${isDataLoading}`);

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
            onClick={refreshData} // Use the useCallback version
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
                gifts={gifts} // Pass the gifts state
                onDataChange={refreshData} // Pass stable refresh callback
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
                // Pass the filtered gifts directly
                selectedItems={gifts.filter((g) => g.status === "selected")}
                onDataChange={refreshData} // Pass stable refresh callback
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
            {/* Pass key prop to force re-render if isAuthenticated changes, ensuring settings load correctly */}
             {/* Pass settings if available and stable refresh callback */}
             {/* Also pass isDataLoading to show a loader within the form itself */}
             <AdminEventSettingsForm
               key={isAuthenticated ? 'admin-settings' : 'no-settings'}
               initialSettings={eventSettings} // Pass fetched settings
               onSave={refreshData}
               isLoading={isDataLoading} // Pass loading state
             />
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
            <Button onClick={handleExport} className="mt-4" disabled={isDataLoading || gifts.length === 0}>
              Exportar CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    