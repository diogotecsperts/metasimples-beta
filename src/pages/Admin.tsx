import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LojasManager } from "@/components/admin/LojasManager";
import { GerentesManager } from "@/components/admin/GerentesManager";
import { MetasManager } from "@/components/admin/MetasManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Users, Target, Shield, BarChart3, ScrollText, ClipboardList, Sparkles } from "lucide-react";
import { AdminsManager } from "@/components/admin/AdminsManager";
import { AuditLogManager } from "@/components/admin/AuditLogManager";
import { LancamentosManager } from "@/components/admin/LancamentosManager";
import { ChangelogManager } from "@/components/admin/ChangelogManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Dashboard from "./Dashboard";
import { useChangelogUnreadCount } from "@/hooks/useChangelogUnreadCount";
import { useState } from "react";

const Admin = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { data: unreadCount = 0 } = useChangelogUnreadCount();
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Limpar badge quando clicar em novidades
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Painel Administrativo"
        subtitle="Gestão de lojas, gerentes, metas e administradores"
        onLogout={handleLogout}
        showLogo={true}
        rightContent={
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <BarChart3 className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Ver Ranking</span>
          </Button>
        }
      />
      
      <PageContainer>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="grid w-full grid-cols-8 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="lojas" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Lojas</span>
            </TabsTrigger>
            <TabsTrigger value="gerentes" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Gerentes</span>
            </TabsTrigger>
            <TabsTrigger value="metas" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Metas</span>
            </TabsTrigger>
            <TabsTrigger value="lancamentos" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamentos</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admins</span>
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-2">
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="novidades" className="gap-2 relative">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Novidades</span>
              {unreadCount > 0 && activeTab !== "novidades" && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary text-[9px] font-bold text-primary-foreground items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </span>
              )}
            </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard embedded={true} />
          </TabsContent>

          <TabsContent value="lojas" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <LojasManager />
            </div>
          </TabsContent>

          <TabsContent value="gerentes" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <GerentesManager />
            </div>
          </TabsContent>

          <TabsContent value="metas" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <MetasManager />
            </div>
          </TabsContent>

          <TabsContent value="lancamentos" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <LancamentosManager />
            </div>
          </TabsContent>

          <TabsContent value="admins" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <AdminsManager />
            </div>
          </TabsContent>

          <TabsContent value="auditoria" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <AuditLogManager />
            </div>
          </TabsContent>

          <TabsContent value="novidades" className="space-y-6">
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <ChangelogManager />
            </div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
};

export default Admin;
