import { useState, useEffect } from 'react';
import { useSweepNotifications } from '@/hooks/useSweepNotifications';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, Check, Trash2, Zap, ShieldCheck, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function SweepNotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    subscribeToNotifications 
  } = useSweepNotifications();
  const [open, setOpen] = useState(false);

  // Subscribe to real-time notifications
  useEffect(() => {
    const unsubscribe = subscribeToNotifications();
    return unsubscribe;
  }, [subscribeToNotifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'pool_sweep_success':
      case 'auto_sweep_completed':
        return <Zap className="w-4 h-4 text-accent" />;
      case 'pool_join_success':
        return <ShieldCheck className="w-4 h-4 text-success" />;
      case 'pool_sweep_failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'pool_sweep_success':
      case 'auto_sweep_completed':
        return 'bg-accent/10 border-accent/20';
      case 'pool_join_success':
        return 'bg-success/10 border-success/20';
      case 'pool_sweep_failed':
        return 'bg-destructive/10 border-destructive/20';
      default:
        return 'bg-primary/10 border-primary/20';
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markAsRead.mutate(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteNotification.mutate(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-accent text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Sweep Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => markAllAsRead.mutate()}
              >
                <Check className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs">Sweep events will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-secondary/50 transition-colors cursor-pointer group",
                    !notification.is_read && "bg-secondary/30"
                  )}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead.mutate(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      getBgColor(notification.type)
                    )}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm font-medium",
                          !notification.is_read && "text-foreground"
                        )}>
                          {notification.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      
                      {/* Metadata for successful sweeps */}
                      {(notification.type === 'pool_sweep_success' || notification.type === 'auto_sweep_completed') && notification.metadata?.amount && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {notification.metadata.amount} {notification.metadata.currency}
                          </Badge>
                          {notification.metadata.tx_hash && (
                            <a 
                              href={`https://etherscan.io/tx/${notification.metadata.tx_hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View TX
                            </a>
                          )}
                        </div>
                      )}

                      {/* Pool info for joins */}
                      {notification.type === 'pool_join_success' && notification.metadata?.pool_name && (
                        <div className="mt-2">
                          <Badge className="text-[10px] bg-success/20 text-success">
                            Joined: {notification.metadata.pool_name}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => handleMarkAsRead(e, notification.id)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => handleDelete(e, notification.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
