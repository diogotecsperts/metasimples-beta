import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { LojasManager } from "@/components/admin/LojasManager";
import { GerentesManager } from "@/components/admin/GerentesManager";
import { MetasManager } from "@/components/admin/MetasManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Users, Target, Shield, BarChart3, ScrollText } from "lucide-react";
import { AdminsManager } from "@/components/admin/AdminsManager";
import { AuditLogManager } from "@/components/admin/AuditLogManager";
import { Button } from "@/components/ui/button";
import Dashboard from "./Dashboard";

const Admin = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
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
        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
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
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admins</span>
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-2">
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
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
        </Tabs>
      </PageContainer>
    </div>
  );
};

export default Admin;
