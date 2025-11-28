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
          {/* Seções administrativas */}
          {['Usuários', 'Configurações', 'Relatórios'].map((section) => (
            <div key={section} className="rounded-lg border bg-card">
              <div className="border-b bg-muted/30 px-4 py-3">
                <h3 className="font-semibold">{section}</h3>
              </div>
              <div className="p-6">
                <div className="h-24 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">
                    Conteúdo de {section.toLowerCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Admin;
