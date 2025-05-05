"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Gift,
  Users,
  Settings,
  FileDown,
  Loader2,
  LogOut,
  Home,
  AlertTriangle, // Import AlertTriangle
} from "lucide-react";
import {
  getGifts,
  getEventSettings,
  exportGiftsToCSV,
  type GiftItem,
  type EventSettings,
  initializeFirestoreData, // Ensure this is imported if used
} from "@/data/gift-store";
import AdminItemManagementTable from "@/components/admin/item-management-table";
import AdminSelectionViewer from "@/components/admin/selection-viewer";
import AdminEventSettingsForm from "@/components/admin/event-settings-form";
import useAuth from "@/hooks/useAuth"; // Import useAuth hook
import { ThemeToggle } from "@/components/theme-toggle"; // Import ThemeToggle
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

export default function AdminPage() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(
    null,
  );
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // State for errors

  // Use the custom hook for authentication
  const { user, loading: authLoading, error: authError, logout } = useAuth();

  // Combine loading states
  const isLoading = authLoading || isDataLoading;

  // Fetch data function using useCallback for stability
  const refreshData = useCallback(async (source?: string) => {
    console.log(`AdminPage: Refresh data triggered by ${source || "initial load"}`);
    setIsDataLoading(true);
    setError(null); // Clear previous errors

    // Initialize Firestore data if needed (optional, consider if necessary on admin load)
    // await initializeFirestoreData(); // Call initialization if needed

    try {
      const giftsPromise = getGifts();
      const settingsPromise = getEventSettings();

      const [giftsData, settingsData] = await Promise.all([
        giftsPromise,
        settingsPromise,
      ]);

      console.log(`AdminPage: Fetched ${giftsData.length} gifts.`);
      console.log("AdminPage: Fetched Event Settings:", !!settingsData);

      setGifts(giftsData);
      setEventSettings(settingsData);
    } catch (err: any) {
      console.error("AdminPage: Error fetching data:", err);
      setError(`Erro ao carregar dados: ${err.message || "Erro desconhecido"}`);
       // Clear data on error
       setGifts([]);
       setEventSettings(null);
    } finally {
      setIsDataLoading(false);
        console.log("AdminPage: Data fetching complete.");
    }
  }, []); // No dependencies needed as it doesn't rely on component state/props

  // Fetch data on mount and when authentication status changes (user object changes)
  useEffect(() => {
    if (user) {
        console.log("AdminPage: User authenticated, fetching data.");
      refreshData("useEffect[user]");
    } else if (!authLoading) {
       console.log("AdminPage: User not authenticated or finished loading auth state.");
        // Optionally clear data or handle unauthenticated state if needed
        // setGifts([]);
        // setEventSettings(null);
        // setIsDataLoading(false); // Stop data loading if not authenticated
    }
    // Dependency array includes user and authLoading to refetch when auth state is confirmed
  }, [user, authLoading, refreshData]);


  // Handle CSV Export
  const handleExport = async () => {
     if (isDataLoading || gifts.length === 0) return; // Prevent export if loading or no data
    console.log("AdminPage: Exporting CSV...");
    try {
      const csvData = await exportGiftsToCSV();
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `lista_presentes_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log("AdminPage: CSV downloaded successfully.");
    } catch (error) {
      console.error("AdminPage: Error exporting CSV:", error);
      setError("Erro ao gerar o arquivo CSV."); // Show error to user
    }
  };


  // Show loading state while authenticating or fetching initial data
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          {authLoading ? "Verificando acesso..." : "Carregando dados do painel..."}
        </p>
        {/* Optional: Skeleton loading for the layout */}
        <div className="mt-8 w-full max-w-4xl space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  // Handle Authentication Error or Unauthenticated User
  if (authError || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2 text-foreground">Acesso Negado</h1>
        <p className="text-muted-foreground mb-6">
          {authError
            ? `Erro de autenticação: ${authError}`
            : "Você precisa estar logado como administrador para acessar esta página."}
        </p>
        <Link href="/login">
          <Button variant="outline">Ir para Login</Button>
        </Link>
        <Link href="/" className="mt-4">
          <Button variant="link">Voltar para a Página Inicial</Button>
        </Link>
      </div>
    );
  }

  // Handle Data Loading Error after authentication
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2 text-foreground">Erro ao Carregar Dados</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => refreshData("retry button")} variant="outline">
          Tentar Novamente
        </Button>
         <Link href="/" className="mt-4">
           <Button variant="link">Voltar para a Página Inicial</Button>
         </Link>
      </div>
    );
  }

  // Render the admin dashboard if authenticated and data loaded
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 bg-background text-foreground">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold">Painel de Administração</h1>
        <div className="flex items-center gap-2">
           <ThemeToggle />
           <Link href="/">
            <Button variant="outline" size="sm" title="Voltar para a Página Inicial">
              <Home className="h-4 w-4 mr-1" /> {/* Added mr-1 */}
              Início
            </Button>
          </Link>
          <Button onClick={logout} variant="outline" size="sm" title="Sair">
            <LogOut className="h-4 w-4 mr-1" /> {/* Added mr-1 */}
             Sair
          </Button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column (Item Management) */}
        <Card className="md:col-span-2 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift /> Gerenciar Itens da Lista
            </CardTitle>
            <CardDescription>
              Adicione, edite, remova ou altere o status dos itens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Check if gifts array exists before passing */}
            {!isDataLoading && gifts ? (
                <AdminItemManagementTable
                  gifts={gifts}
                  onDataChange={refreshData} // Pass stable refresh callback
                />
            ) : (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">Carregando itens...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column (Selections, Settings, Export) */}
        <div className="space-y-6">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users /> Visualizar Seleções
              </CardTitle>
              <CardDescription>
                Ver quem selecionou quais itens e reverter seleções se
                necessário.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Ensure selectedItems are passed correctly here */}
              {!isDataLoading && gifts ? (
                <AdminSelectionViewer
                  // Filter items safely, ensuring item and item.status exist
                   selectedItems={gifts.filter(g => g && g.status === 'selected')}
                  onDataChange={refreshData} // Pass stable refresh callback
                />
              ) : (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="ml-2 text-muted-foreground">
                    Carregando seleções...
                  </p>
                </div>
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
                key={user ? "admin-settings" : "no-settings"} // Use user existence for key
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
              <Button
                onClick={handleExport}
                className="mt-4"
                disabled={isDataLoading || !gifts || gifts.length === 0}
              >
                Exportar CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
