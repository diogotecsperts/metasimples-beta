const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold">Dashboard - Meta Simples</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Dashboard Principal</h2>
          <p className="text-muted-foreground">
            Visão geral e métricas do sistema
          </p>
        </div>

        <div className="grid gap-6">
          {/* Área de métricas principais */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-24 rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="h-full flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">
                    Métrica {item}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Área de gráficos/tabelas */}
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-card p-8 h-64 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">
              Área para gráficos e visualizações
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
