import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  ExternalLink,
  Users,
  UserCheck,
  UserX,
  HelpCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SendPulseContact {
  id: string;
  user_id: string;
  user_type: string;
  telefone: string;
  sendpulse_contact_id: string | null;
  status: string;
  opt_in_at: string | null;
  ultimo_bloqueio_at: string | null;
  ultimo_envio_sucesso_at: string | null;
  tentativas_envio: number;
  tentativas_falha_consecutivas: number;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  nome: string;
  telefone: string | null;
}

const STATUS_CONFIG = {
  ativo: {
    label: "Ativo",
    icon: CheckCircle2,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    description: "Contato ativo no SendPulse, pronto para receber mensagens"
  },
  bloqueado: {
    label: "Bloqueado",
    icon: XCircle,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    description: "Contato banido no SendPulse, pode precisar de reativação"
  },
  pendente: {
    label: "Pendente",
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    description: "Aguardando sincronização ou opt-in do usuário"
  },
  nao_existe: {
    label: "Não Existe",
    icon: AlertTriangle,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    description: "Contato não encontrado no SendPulse, precisa iniciar conversa com o bot"
  }
} as const;

export function WhatsAppContatos() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  // Buscar contatos do SendPulse
  const { data: contacts, isLoading: isLoadingContacts, refetch: refetchContacts } = useQuery({
    queryKey: ["sendpulse-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendpulse_contacts")
        .select("*")
        .order("user_type", { ascending: true })
        .order("status", { ascending: true });

      if (error) throw error;
      return data as SendPulseContact[];
    }
  });

  // Buscar profiles para mapear nomes
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, telefone");

      if (error) throw error;
      return data as Profile[];
    }
  });

  // Realtime: escutar mudanças na tabela
  useEffect(() => {
    const channel = supabase
      .channel('sendpulse-contacts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sendpulse_contacts'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sendpulse-contacts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Criar mapa de profiles
  const profilesMap = new Map<string, Profile>();
  profiles?.forEach(p => profilesMap.set(p.id, p));

  // Sincronizar todos os contatos
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-sendpulse-contacts", {
        body: {}
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sendpulse-contacts"] });
      toast.success(data.message || "Sincronização concluída!");
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    }
  });

  // Sincronizar um contato específico
  const syncOneMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-sendpulse-contacts", {
        body: { userIds: [userId] }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sendpulse-contacts"] });
      toast.success("Contato sincronizado!");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await syncAllMutation.mutateAsync();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncOne = async (userId: string) => {
    setSyncingUserId(userId);
    try {
      await syncOneMutation.mutateAsync(userId);
    } finally {
      setSyncingUserId(null);
    }
  };

  // Gerar link de opt-in para WhatsApp
  const generateOptInLink = (telefone: string) => {
    // Número do bot SendPulse (extrair do telefone ou usar fixo)
    const botNumber = "5511999999999"; // TODO: Configurar número do bot
    const message = encodeURIComponent("Olá! Quero receber notificações do sistema de vendas.");
    return `https://wa.me/${botNumber}?text=${message}`;
  };

  // Estatísticas
  const stats = {
    total: contacts?.length || 0,
    ativos: contacts?.filter(c => c.status === 'ativo').length || 0,
    bloqueados: contacts?.filter(c => c.status === 'bloqueado').length || 0,
    pendentes: contacts?.filter(c => c.status === 'pendente' || c.status === 'nao_existe').length || 0,
    gerentes: contacts?.filter(c => c.user_type === 'gerente').length || 0,
    admins: contacts?.filter(c => c.user_type === 'admin').length || 0
  };

  if (isLoadingContacts) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerta de contatos bloqueados */}
      {stats.bloqueados > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-destructive">
              {stats.bloqueados} contato{stats.bloqueados > 1 ? 's' : ''} bloqueado{stats.bloqueados > 1 ? 's' : ''}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              Estes contatos não receberão mensagens até serem reativados. 
              O sistema tenta recuperar automaticamente durante o envio, mas após 3 falhas 
              consecutivas é necessário que o usuário inicie uma nova conversa com o bot.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={handleSyncAll}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Tentar Reativar Todos
            </Button>
          </div>
        </div>
      )}

      {/* Header com estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Contatos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.bloqueados}</p>
                <p className="text-xs text-muted-foreground">Bloqueados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Gerenciamento de Contatos</CardTitle>
              <CardDescription>
                Sincronize e gerencie os contatos do SendPulse
              </CardDescription>
            </div>
            <Button 
              onClick={handleSyncAll} 
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Envio</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum contato cadastrado. Clique em "Sincronizar Todos" para buscar.
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts?.map((contact) => {
                    const profile = profilesMap.get(contact.user_id);
                    const statusConfig = STATUS_CONFIG[contact.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pendente;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          {profile?.nome || "Desconhecido"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contact.user_type === 'admin' ? 'default' : 'secondary'}>
                            {contact.user_type === 'admin' ? 'Admin' : 'Gerente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {contact.telefone}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className={`gap-1 ${statusConfig.color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{statusConfig.description}</p>
                                {contact.sendpulse_contact_id && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    ID: {contact.sendpulse_contact_id}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contact.ultimo_envio_sucesso_at ? (
                            formatDistanceToNow(new Date(contact.ultimo_envio_sucesso_at), {
                              addSuffix: true,
                              locale: ptBR
                            })
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSyncOne(contact.user_id)}
                                    disabled={syncingUserId === contact.user_id}
                                  >
                                    {syncingUserId === contact.user_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Sincronizar este contato</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {(contact.status === 'nao_existe' || contact.status === 'pendente') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const link = generateOptInLink(contact.telefone);
                                        navigator.clipboard.writeText(link);
                                        toast.success("Link copiado! Envie para o usuário.");
                                      }}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Copiar link de opt-in</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Como funciona:</strong> O sistema sincroniza os contatos do banco de dados com o SendPulse
                para identificar quem está ativo, bloqueado ou pendente de opt-in.
              </p>
              <p>
                <strong>Status "Não Existe":</strong> O usuário precisa iniciar uma conversa com o bot do WhatsApp
                para ser registrado no SendPulse. Use o botão de link para gerar um convite.
              </p>
              <p>
                <strong>Status "Bloqueado":</strong> O contato foi banido pelo SendPulse (geralmente por não interação).
                O sistema tentará automaticamente reativar ao enviar mensagens.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
