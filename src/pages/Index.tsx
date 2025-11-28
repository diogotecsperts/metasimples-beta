import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Meta Simples
            </h1>
            <p className="text-xl text-muted-foreground">
              Sistema de gestão empresarial moderno e eficiente
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-12">
            {[
              { path: "/login", label: "Login", desc: "Acesso ao sistema" },
              { path: "/gerente", label: "Gerente", desc: "Área gerencial" },
              { path: "/dashboard", label: "Dashboard", desc: "Visão geral" },
              { path: "/admin", label: "Admin", desc: "Administração" },
            ].map((route) => (
              <Link
                key={route.path}
                to={route.path}
                className="group rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-all hover:border-primary/50"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{route.label}</h3>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-sm text-muted-foreground">{route.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t">
            <p className="text-sm text-muted-foreground">
              Estrutura base configurada e pronta para desenvolvimento
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
