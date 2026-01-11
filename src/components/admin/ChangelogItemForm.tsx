import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ArrowLeft, Save, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  titulo: z.string().min(3, "Título deve ter pelo menos 3 caracteres").max(100),
  descricao: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres").max(2500),
  categoria: z.enum(["disponivel", "desenvolvimento", "indeterminado"]),
  publishNow: z.boolean().default(true),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

type ChangelogItem = {
  id: string;
  titulo: string;
  descricao: string;
  categoria: "disponivel" | "desenvolvimento" | "indeterminado";
  scheduled_at: string | null;
  published_at: string | null;
};

type Props = {
  item?: ChangelogItem | null;
  onSuccess: () => void;
  onCancel: () => void;
};

export function ChangelogItemForm({ item, onSuccess, onCancel }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: item?.titulo || "",
      descricao: item?.descricao || "",
      categoria: item?.categoria || "disponivel",
      publishNow: !item?.scheduled_at,
      scheduledDate: item?.scheduled_at 
        ? format(new Date(item.scheduled_at), "yyyy-MM-dd") 
        : "",
      scheduledTime: item?.scheduled_at 
        ? format(new Date(item.scheduled_at), "HH:mm") 
        : "",
    },
  });

  const publishNow = form.watch("publishNow");

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let published_at: string | null = null;
      let scheduled_at: string | null = null;

      if (data.publishNow) {
        published_at = new Date().toISOString();
      } else if (data.scheduledDate && data.scheduledTime) {
        const scheduledDateTime = new Date(`${data.scheduledDate}T${data.scheduledTime}`);
        scheduled_at = scheduledDateTime.toISOString();
        
        // Se a data agendada já passou, publicar imediatamente
        if (scheduledDateTime <= new Date()) {
          published_at = scheduledDateTime.toISOString();
          scheduled_at = null;
        }
      }

      if (item?.id) {
        // Atualizar
        const { error } = await supabase
          .from("changelog_items")
          .update({
            titulo: data.titulo,
            descricao: data.descricao,
            categoria: data.categoria,
            scheduled_at,
            published_at: published_at || item.published_at, // Manter published_at se já publicado
          })
          .eq("id", item.id);
        
        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from("changelog_items")
          .insert({
            titulo: data.titulo,
            descricao: data.descricao,
            categoria: data.categoria,
            scheduled_at,
            published_at,
            created_by: user!.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: item ? "Item atualizado" : "Item criado com sucesso" });
      onSuccess();
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="text-lg font-semibold">
            {item ? "Editar Novidade" : "Nova Novidade"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Preencha as informações abaixo
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="titulo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Nova funcionalidade de relatórios" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="descricao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <RichTextEditor
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Descreva a novidade em detalhes..."
                    maxLength={2500}
                  />
                </FormControl>
                <FormDescription>
                  Descreva o que é a novidade e como ela beneficia os usuários. Use a barra de ferramentas para formatar o texto.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoria"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="disponivel">
                      ✅ Disponível - Já implementado
                    </SelectItem>
                    <SelectItem value="desenvolvimento">
                      🔄 Em desenvolvimento - Sendo trabalhado
                    </SelectItem>
                    <SelectItem value="indeterminado">
                      ❓ Indeterminado - Planejado/Futuro
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Opções de publicação */}
          <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Publicar imediatamente</Label>
                <p className="text-xs text-muted-foreground">
                  A novidade ficará visível para todos os admins
                </p>
              </div>
              <FormField
                control={form.control}
                name="publishNow"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {!publishNow && (
              <div className="grid gap-4 pt-2 border-t">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Agendar publicação
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            min={format(new Date(), "yyyy-MM-dd")}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
