import { LojasManager } from "@/components/admin/LojasManager";
import { GerentesManager } from "@/components/admin/GerentesManager";
import { MetasManager } from "@/components/admin/MetasManager";

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold">Administração - Meta Simples</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Painel Administrativo</h2>
          <p className="text-muted-foreground">
            Configurações e gerenciamento do sistema
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <LojasManager />
          </div>
          
          <div className="rounded-lg border bg-card p-6">
            <GerentesManager />
          </div>

          <div className="rounded-lg border bg-card p-6">
            <MetasManager />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
