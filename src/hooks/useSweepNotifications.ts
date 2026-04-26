import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SweepNotification {
  id: string;
  user_id: string;
  type: 'pool_sweep_success' | 'pool_sweep_failed' | 'pool_join_success' | 'auto_sweep_completed' | 'sweep_rule_triggered';
  title: string;
  message: string;
  is_read: boolean;
  metadata: {
    pool_id?: string;
    pool_name?: string;
    amount?: number;
    currency?: string;
    tx_hash?: string;
    error?: string;
  };
  created_at: string;
}

export const useSweepNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<SweepNotification[]>({
    queryKey: ["sweep-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await (supabase as any)
        .from("sweep_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = notifications.filter((n: SweepNotification) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await (supabase as any)
        .from("sweep_notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sweep-notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("sweep_notifications")
        .update({ is_read: true })
        .eq("user_id", user?.id)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sweep-notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await (supabase as any)
        .from("sweep_notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sweep-notifications"] });
    },
  });

  // Real-time subscription
  const subscribeToNotifications = () => {
    if (!user) return () => {};

    const subscription = (supabase as any)
      .channel('sweep_notifications_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'sweep_notifications',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload: any) => {
          console.log('New notification:', payload);
          queryClient.invalidateQueries({ queryKey: ["sweep-notifications"] });
          
          // Show toast for new notifications
          const newNotif = payload.new as SweepNotification;
          if (!newNotif.is_read) {
            if (newNotif.type.includes('success')) {
              toast.success(newNotif.title, { description: newNotif.message });
            } else if (newNotif.type.includes('failed')) {
              toast.error(newNotif.title, { description: newNotif.message });
            } else {
              toast.info(newNotif.title, { description: newNotif.message });
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    subscribeToNotifications,
  };
};

export const useSweepRules = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["sweep-rules", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await (supabase as any)
        .from("sweep_rules")
        .select(`
          *,
          wallet:wallet_id (id, wallet_address, wallet_type, chain_id, token_approved),
          pool:target_pool_id (id, name, status)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const createRule = useMutation({
    mutationFn: async (ruleData: Partial<SweepRule>) => {
      const { data, error } = await (supabase as any)
        .from("sweep_rules")
        .insert({
          user_id: user?.id,
          ...ruleData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sweep-rules"] });
      toast.success("Sweep rule created successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to create rule: " + err.message);
    }
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SweepRule> }) => {
      const { error } = await (supabase as any)
        .from("sweep_rules")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sweep-rules"] });
      toast.success("Rule updated");
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await (supabase as any)
        .from("sweep_rules")
        .delete()
        .eq("id", ruleId)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sweep-rules"] });
      toast.success("Rule deleted");
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await (supabase as any)
        .from("sweep_rules")
        .update({ is_active: isActive })
        .eq("id", id)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sweep-rules"] });
    },
  });

  return {
    rules,
    isLoading,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
};

export interface SweepRule {
  id: string;
  user_id: string;
  wallet_id: string;
  rule_name: string;
  is_active: boolean;
  min_balance_usd: number;
  max_balance_usd?: number;
  sweep_frequency: 'hourly' | 'daily' | 'weekly' | 'on_join';
  last_sweep_at?: string;
  next_sweep_at?: string;
  target_pool_id?: string;
  auto_join_pool: boolean;
  allowed_hours_start?: number;
  allowed_hours_end?: number;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  wallet?: {
    id: string;
    wallet_address: string;
    wallet_type: string;
    chain_id: number;
    token_approved: string;
  };
  pool?: {
    id: string;
    name: string;
    status: string;
  };
}
