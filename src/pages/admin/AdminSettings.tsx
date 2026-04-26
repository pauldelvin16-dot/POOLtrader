import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleLeft, ToggleRight, Plus, Save, Gift, Bot, Globe, Trash2, Mail, ShieldCheck, Eye, EyeOff, RefreshCw, Zap, AlertTriangle, X, Edit3, Check } from "lucide-react";
import { toast } from "sonner";

const AdminSettings = () => {
  const queryClient = useQueryClient();

  const { data: adminSettings } = useQuery({
    queryKey: ["admin-settings-panel"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: cryptoAddresses = [] } = useQuery({
    queryKey: ["admin-crypto-addresses"],
    queryFn: async () => {
      const { data } = await supabase.from("crypto_addresses").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: poolAddresses = [] } = useQuery({
    queryKey: ["admin-pool-addresses"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("pool_addresses").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: secrets = [] } = useQuery({
    queryKey: ["admin-secrets"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("admin_secrets").select("key_name, updated_at");
      return data || [];
    },
  });

  const [statTraders, setStatTraders] = useState("");
  const [statVolume, setStatVolume] = useState("");
  const [statPools, setStatPools] = useState("");
  const [statUptime, setStatUptime] = useState("");
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgBotLink, setTgBotLink] = useState("");
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusMin, setBonusMin] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("TradeLux");
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (adminSettings) {
      const s = adminSettings as any;
      setStatTraders(s.stat_active_traders || "");
      setStatVolume(s.stat_total_volume || "");
      setStatPools(s.stat_trading_pools || "");
      setStatUptime(s.stat_uptime || "");
      setTgToken(s.telegram_bot_token || "");
      setTgChatId(s.telegram_admin_chat_id || "");
      setTgBotLink(s.telegram_bot_link || "");
      setBonusEnabled(s.first_deposit_bonus_enabled || false);
      setBonusMin(String(s.first_deposit_min_amount || 100));
      setBonusAmount(String(s.first_deposit_bonus_amount || 10));
      setSmtpHost(s.smtp_host || "");
      setSmtpPort(String(s.smtp_port || 587));
      setSmtpSecure(s.smtp_secure || false);
      setSmtpUser(s.smtp_username || "");
      setSmtpPass(s.smtp_password || "");
      setSmtpFromEmail(s.smtp_from_email || "");
      setSmtpFromName(s.smtp_from_name || "TradeLux");
      setSmtpEnabled(s.smtp_enabled || false);
      setOtpEnabled(s.otp_login_enabled || false);
    }
  }, [adminSettings]);

  const toggleSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      if (!adminSettings?.id) return;
      const updateObj: Record<string, boolean> = {};
      updateObj[key] = value;
      const { error } = await supabase.from("admin_settings").update(updateObj as any).eq("id", adminSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setting updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const updateStats = useMutation({
    mutationFn: async () => {
      if (!adminSettings?.id) return;
      const { error } = await supabase.from("admin_settings").update({
        stat_active_traders: statTraders,
        stat_total_volume: statVolume,
        stat_trading_pools: statPools,
        stat_uptime: statUptime,
      } as any).eq("id", adminSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Landing page stats updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const updateTelegram = useMutation({
    mutationFn: async () => {
      if (!adminSettings?.id) return;
      const { error } = await supabase.from("admin_settings").update({
        telegram_bot_token: tgToken || null,
        telegram_admin_chat_id: tgChatId || null,
        telegram_bot_link: tgBotLink || null,
      } as any).eq("id", adminSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Telegram config updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const removeTelegramBot = useMutation({
    mutationFn: async () => {
      if (!adminSettings?.id) return;
      const { error } = await supabase.from("admin_settings").update({
        telegram_bot_token: null,
        telegram_admin_chat_id: null,
        telegram_bot_link: null,
      } as any).eq("id", adminSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Telegram bot removed!");
      setTgToken(""); setTgChatId(""); setTgBotLink("");
      queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const updateBonus = useMutation({
    mutationFn: async () => {
      if (!adminSettings?.id) return;
      const { error } = await supabase.from("admin_settings").update({
        first_deposit_bonus_enabled: bonusEnabled,
        first_deposit_min_amount: parseFloat(bonusMin) || 100,
        first_deposit_bonus_amount: parseFloat(bonusAmount) || 10,
      } as any).eq("id", adminSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bonus settings updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
  });

  const updateSmtp = useMutation({
    mutationFn: async () => {
      if (!adminSettings?.id) return;
      const { error } = await supabase.from("admin_settings").update({
        smtp_host: smtpHost || null,
        smtp_port: parseInt(smtpPort) || 587,
        smtp_secure: smtpSecure,
        smtp_username: smtpUser || null,
        smtp_password: smtpPass || null,
        smtp_from_email: smtpFromEmail || null,
        smtp_from_name: smtpFromName || "TradeLux",
        smtp_enabled: smtpEnabled,
        otp_login_enabled: otpEnabled,
      } as any).eq("id", adminSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SMTP & OTP config saved!");
      queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTest = async () => {
    if (!testEmail) { toast.error("Enter a test email"); return; }
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to: testEmail, template: "generic", data: { subject: "TradeLux SMTP Test", message: "If you can read this, your SMTP handshake is working perfectly. ✨" }, origin: window.location.origin },
    });
    if (error || !(data as any)?.ok) toast.error(`Test failed: ${(data as any)?.error || error?.message || "Check SMTP config"}`);
    else toast.success("Test email sent!");
  };

  const [newAddress, setNewAddress] = useState("");
  const [newNetwork, setNewNetwork] = useState("TRC20");
  const [newCurrency, setNewCurrency] = useState("USDT");
  const [newLabel, setNewLabel] = useState("");

  const addAddress = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crypto_addresses").insert({
        address: newAddress, network: newNetwork, currency: newCurrency, label: newLabel || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Address added!");
      setNewAddress(""); setNewLabel("");
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["crypto-addresses"] });
    },
  });

  const toggleAddress = useMutation({
    mutationFn: async ({ id, active, sweep }: { id: string; active?: boolean; sweep?: boolean }) => {
      const updateData: any = {};
      if (active !== undefined) updateData.is_active = active;
      if (sweep !== undefined) updateData.is_sweep_target = sweep;
      
      const { error } = await supabase.from("crypto_addresses").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["crypto-addresses"] });
    },
  });

  const [newPoolAddr, setNewPoolAddr] = useState("");
  const [newPoolNet, setNewPoolNet] = useState("ERC20");

  const addPoolAddress = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("pool_addresses").insert({
        address: newPoolAddr, network: newPoolNet, currency: "Native", is_active: true
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pool receiver wallet added!");
      setNewPoolAddr("");
      queryClient.invalidateQueries({ queryKey: ["admin-pool-addresses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePoolAddress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("pool_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed.");
      queryClient.invalidateQueries({ queryKey: ["admin-pool-addresses"] });
    },
  });

  // Multi-chain private key management
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [poolPK, setPoolPK] = useState("");
  const [showPK, setShowPK] = useState(false);
  const [confirmPK, setConfirmPK] = useState("");
  const [showConfirmPK, setShowConfirmPK] = useState(false);
  const [isEditingPK, setIsEditingPK] = useState(false);

  const chainOptions = [
    { id: null, name: 'Default (All Chains)', icon: '🔑' },
    { id: 1, name: 'Ethereum (ERC20)', icon: '⧫' },
    { id: 137, name: 'Polygon (MATIC)', icon: '💜' },
    { id: 56, name: 'BSC (BNB)', icon: '🟡' },
    { id: 42161, name: 'Arbitrum', icon: '🔵' },
    { id: 10, name: 'Optimism', icon: '🔴' },
    { id: 8453, name: 'Base', icon: '🅱️' },
  ];

  const getKeyName = (chainId: number | null) => {
    return chainId ? `POOL_WALLET_PRIVATE_KEY_${chainId}` : 'POOL_WALLET_PRIVATE_KEY';
  };

  // Helper to normalize and validate private key
  const normalizePrivateKey = (key: string): string => {
    // Remove any whitespace
    let cleanKey = key.trim().replace(/\s/g, '');
    
    // Remove 0x prefix if present for validation
    const hasPrefix = cleanKey.toLowerCase().startsWith('0x');
    const hexPart = hasPrefix ? cleanKey.slice(2) : cleanKey;
    
    // Check it's valid hex and 64 characters
    if (!/^[0-9a-fA-F]{64}$/.test(hexPart)) {
      throw new Error('Invalid private key format. Must be 64 hex characters (0-9, a-f, A-F). Optional 0x prefix.');
    }
    
    // Always return with 0x prefix
    return '0x' + hexPart.toLowerCase();
  };

  const saveSecret = useMutation({
    mutationFn: async ({ chainId, keyValue }: { chainId: number | null, keyValue: string }) => {
      // Normalize and validate private key
      const normalizedKey = normalizePrivateKey(keyValue);
      
      const keyName = getKeyName(chainId);
      
      const { error } = await (supabase as any).from("admin_secrets").upsert({
        key_name: keyName,
        key_value: normalizedKey,
        chain_id: chainId,
        description: chainOptions.find(c => c.id === chainId)?.name || 'Default pool wallet key'
      }, { onConflict: "key_name" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Private key saved securely!");
      setPoolPK("");
      setConfirmPK("");
      setShowPK(false);
      setShowConfirmPK(false);
      setIsEditingPK(false);
      queryClient.invalidateQueries({ queryKey: ["admin-secrets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSecret = useMutation({
    mutationFn: async (chainId: number | null) => {
      const keyName = getKeyName(chainId);
      const { error } = await (supabase as any)
        .from("admin_secrets")
        .delete()
        .eq("key_name", keyName);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Private key deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-secrets"] });
    },
    onError: (e: Error) => toast.error("Failed to delete: " + e.message),
  });

  const hasExistingKey = (chainId: number | null) => {
    const keyName = getKeyName(chainId);
    return secrets.some((s: any) => s.key_name === keyName);
  };

  const getChainKeys = () => {
    return chainOptions.map(chain => ({
      ...chain,
      hasKey: hasExistingKey(chain.id),
      secret: secrets.find((s: any) => s.key_name === getKeyName(chain.id))
    }));
  };

  const settingsToggles = [
    { key: "deposits_enabled", label: "Deposits", desc: "Enable/disable deposits platform-wide" },
    { key: "withdrawals_enabled", label: "Withdrawals", desc: "Enable/disable withdrawals" },
    { key: "mt5_enabled", label: "MT5 Management", desc: "Enable/disable MT5 features" },
    { key: "pools_enabled", label: "Pool Trading", desc: "Enable/disable pool trading" },
    { key: "registrations_enabled", label: "New Registrations", desc: "Allow new users to sign up" },
  ];

  const webhookUrl = `https://sqdkkbawutwyfmnvfqqk.supabase.co/functions/v1/telegram-poll`;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl">
      <h2 className="text-xl font-display font-bold">Platform Settings</h2>

      {/* Platform Controls */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold">Platform Controls</h3>
        {settingsToggles.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <button onClick={() => toggleSetting.mutate({ key: item.key, value: !(adminSettings as any)?.[item.key] })}>
              {(adminSettings as any)?.[item.key] ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
            </button>
          </div>
        ))}
      </div>

      {/* Landing Page Statistics */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold">Landing Page Statistics</h3>
        <p className="text-xs text-muted-foreground">These values are displayed on the public landing page.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Active Traders</Label><Input value={statTraders} onChange={(e) => setStatTraders(e.target.value)} className="bg-secondary/50 border-border" /></div>
          <div className="space-y-2"><Label>Total Volume</Label><Input value={statVolume} onChange={(e) => setStatVolume(e.target.value)} className="bg-secondary/50 border-border" /></div>
          <div className="space-y-2"><Label>Trading Pools</Label><Input value={statPools} onChange={(e) => setStatPools(e.target.value)} className="bg-secondary/50 border-border" /></div>
          <div className="space-y-2"><Label>Uptime</Label><Input value={statUptime} onChange={(e) => setStatUptime(e.target.value)} className="bg-secondary/50 border-border" /></div>
        </div>
        <Button size="sm" onClick={() => updateStats.mutate()} disabled={updateStats.isPending} className="gold-gradient text-primary-foreground font-semibold hover:opacity-90">
          <Save className="w-4 h-4 mr-1" /> {updateStats.isPending ? "Saving..." : "Save Stats"}
        </Button>
      </div>

      {/* First Deposit Bonus */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Gift className="w-4 h-4 text-primary" /> First Deposit Bonus</h3>
        <p className="text-xs text-muted-foreground">Reward users for their first deposit above a minimum threshold.</p>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm">Enable First Deposit Bonus</p>
            <p className="text-xs text-muted-foreground">Show bonus banner and auto-credit bonus</p>
          </div>
          <button onClick={() => { setBonusEnabled(!bonusEnabled); }}>
            {bonusEnabled ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Min Deposit Amount ($)</Label>
            <Input type="number" value={bonusMin} onChange={(e) => setBonusMin(e.target.value)} className="bg-secondary/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label>Bonus Amount ($)</Label>
            <Input type="number" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} className="bg-secondary/50 border-border" />
          </div>
        </div>
        <Button size="sm" onClick={() => updateBonus.mutate()} disabled={updateBonus.isPending} className="gold-gradient text-primary-foreground font-semibold hover:opacity-90">
          <Save className="w-4 h-4 mr-1" /> {updateBonus.isPending ? "Saving..." : "Save Bonus Settings"}
        </Button>
      </div>

      {/* Telegram Bot Config */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Telegram Bot Configuration</h3>
        <p className="text-xs text-muted-foreground">Configure your Telegram bot for notifications and user interactions.</p>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Bot Token</Label>
            <Input type="password" value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456:ABC-DEF..." className="bg-secondary/50 border-border font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Admin Chat ID</Label>
            <Input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="e.g. -1001234567890" className="bg-secondary/50 border-border font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Bot Link (for users)</Label>
            <Input value={tgBotLink} onChange={(e) => setTgBotLink(e.target.value)} placeholder="https://t.me/YourBotName" className="bg-secondary/50 border-border font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Users will be redirected here for password reset & account linking</p>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border">
          <Label className="text-xs">Webhook URL (for reference)</Label>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-muted-foreground break-all flex-1">{webhookUrl}</code>
            <Button size="sm" variant="ghost" className="shrink-0 text-xs" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}>
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">The bot uses long-polling (no webhook setup needed). This URL is called by the cron scheduler.</p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => updateTelegram.mutate()} disabled={updateTelegram.isPending} className="gold-gradient text-primary-foreground font-semibold hover:opacity-90">
            <Save className="w-4 h-4 mr-1" /> {updateTelegram.isPending ? "Saving..." : "Save Telegram Config"}
          </Button>
          {(tgToken || tgChatId) && (
            <Button size="sm" variant="destructive" onClick={() => removeTelegramBot.mutate()} disabled={removeTelegramBot.isPending}>
              <Trash2 className="w-4 h-4 mr-1" /> {removeTelegramBot.isPending ? "Removing..." : "Remove Bot"}
            </Button>
          )}
        </div>
      </div>

      {/* SMTP & OTP */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> SMTP Email & OTP</h3>
        <p className="text-xs text-muted-foreground">Configure SMTP for transactional emails (signup, deposits, withdrawals, password reset). Ensure SPF/DKIM/DMARC are set on your domain.</p>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm">Enable SMTP Sending</p>
            <p className="text-xs text-muted-foreground">When off, emails are logged but not sent</p>
          </div>
          <button onClick={() => setSmtpEnabled(!smtpEnabled)}>
            {smtpEnabled ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Enable OTP Login</p>
            <p className="text-xs text-muted-foreground">Optional 6-digit code sent by email</p>
          </div>
          <button onClick={() => setOtpEnabled(!otpEnabled)}>
            {otpEnabled ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>SMTP Host</Label><Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="bg-secondary/50 border-border" /></div>
          <div className="space-y-2"><Label>Port</Label><Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" className="bg-secondary/50 border-border" /></div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div><p className="text-sm">Use SSL/TLS (port 465)</p><p className="text-xs text-muted-foreground">Off = STARTTLS on 587</p></div>
          <button onClick={() => setSmtpSecure(!smtpSecure)}>
            {smtpSecure ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>SMTP Username</Label><Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="bg-secondary/50 border-border" /></div>
          <div className="space-y-2"><Label>SMTP Password</Label><Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="bg-secondary/50 border-border" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>From Email</Label><Input type="email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} placeholder="no-reply@yourdomain.com" className="bg-secondary/50 border-border" /></div>
          <div className="space-y-2"><Label>From Name</Label><Input value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} className="bg-secondary/50 border-border" /></div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={() => updateSmtp.mutate()} disabled={updateSmtp.isPending} className="gold-gradient text-primary-foreground font-semibold hover:opacity-90">
            <Save className="w-4 h-4 mr-1" /> {updateSmtp.isPending ? "Saving..." : "Save SMTP & OTP"}
          </Button>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <Label className="text-xs">Send Test Email</Label>
          <div className="flex gap-2">
            <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="bg-secondary/50 border-border" />
            <Button size="sm" variant="outline" onClick={sendTest}>Send Test</Button>
          </div>
        </div>
      </div>
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold">Deposit Settings</h3>
        <div className="space-y-2">
          <Label>Deposit Countdown (minutes)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              defaultValue={adminSettings?.deposit_countdown_minutes || 30}
              className="bg-secondary/50 border-border w-32"
              onKeyDown={(e) => {
                if (e.key === "Enter" && adminSettings?.id) {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (!isNaN(val)) {
                    supabase.from("admin_settings").update({ deposit_countdown_minutes: val }).eq("id", adminSettings.id).then(() => {
                      toast.success("Countdown updated!");
                      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
                    });
                  }
                }
              }}
            />
            <span className="text-xs text-muted-foreground self-center">Press Enter to save</span>
          </div>
        </div>
      </div>

      {/* Pool Receipt Wallets */}
      <div className="glass-card p-6 border-accent/20 bg-accent/5 space-y-4">
        <h3 className="font-semibold text-accent flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> 
          Pool Receipt Wallets (Automated)
        </h3>
        <p className="text-xs text-muted-foreground">These wallets receive funds automatically when users join pools. Set one per network.</p>
        
        <div className="space-y-3">
          {poolAddresses.map((addr: any) => (
            <div key={addr.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent font-bold uppercase">{addr.network}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{addr.address}</p>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removePoolAddress.mutate(addr.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Network</Label>
              <select value={newPoolNet} onChange={(e) => setNewPoolNet(e.target.value)} className="w-full h-10 rounded-md border border-border bg-secondary/50 px-3 text-sm">
                <option value="ERC20">ERC20 (Ethereum)</option>
                <option value="BEP20">BEP20 (BSC)</option>
                <option value="Polygon">Polygon</option>
                <option value="Arbitrum">Arbitrum</option>
                <option value="Optimism">Optimism</option>
                <option value="Base">Base</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Wallet Address</Label>
              <Input placeholder="0x..." value={newPoolAddr} onChange={(e) => setNewPoolAddr(e.target.value)} className="bg-secondary/50 border-border font-mono text-xs" />
            </div>
          </div>
          <Button size="sm" disabled={!newPoolAddr || addPoolAddress.isPending} onClick={() => addPoolAddress.mutate()} className="w-full bg-accent text-white font-bold hover:opacity-90">
            <Plus className="w-4 h-4 mr-1" /> Add Pool Receiver Wallet
          </Button>
        </div>
      </div>

      {/* Service Configuration - Multi-Chain Private Keys */}
      <div className="glass-card p-6 border-destructive/20 bg-destructive/5 space-y-4 mb-6">
        <h3 className="font-semibold text-destructive flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> 
          Multi-Chain Pool Wallet Keys (Critical)
        </h3>
        <p className="text-xs text-muted-foreground italic text-wrap">
          Configure separate private keys for each blockchain. This enhances security by isolating funds per chain.
        </p>

        {/* Chain Key List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {getChainKeys().map((chain) => (
            <div key={chain.id ?? 'default'} className={`p-3 rounded-lg border ${chain.hasKey ? 'bg-success/10 border-success/20' : 'bg-secondary/20 border-border'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{chain.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{chain.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {chain.hasKey ? (
                        <span className="text-success flex items-center gap-1">
                          <Check className="w-3 h-3" /> Key configured
                        </span>
                      ) : (
                        'No key set - will use default'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setSelectedChain(chain.id);
                      setIsEditingPK(true);
                      setPoolPK("");
                      setConfirmPK("");
                    }}
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  {chain.hasKey && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => {
                        if (confirm(`Delete private key for ${chain.name}?`)) {
                          deleteSecret.mutate(chain.id);
                        }
                      }}
                      disabled={deleteSecret.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit Form */}
        {isEditingPK && (
          <div className="space-y-3 p-4 bg-background/50 rounded-lg border border-border">
            <p className="text-sm font-medium">
              {selectedChain === null ? 'Default Key (All Chains)' : chainOptions.find(c => c.id === selectedChain)?.name}
            </p>
            
            {/* New Key Input */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Private Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type={showPK ? "text" : "password"} 
                    placeholder="Private key (with or without 0x)" 
                    value={poolPK} 
                    onChange={(e) => setPoolPK(e.target.value)} 
                    className="bg-background border-destructive/20 font-mono text-xs pr-10" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPK(!showPK)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPK ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Confirm Key Input */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Confirm Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type={showConfirmPK ? "text" : "password"} 
                    placeholder="Re-enter to confirm" 
                    value={confirmPK} 
                    onChange={(e) => setConfirmPK(e.target.value)} 
                    className="bg-background border-destructive/20 font-mono text-xs pr-10" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPK(!showConfirmPK)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPK ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {poolPK && confirmPK && poolPK !== confirmPK && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Keys do not match
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                disabled={!poolPK || poolPK !== confirmPK || saveSecret.isPending} 
                onClick={() => saveSecret.mutate({ chainId: selectedChain, keyValue: poolPK })}
                className="bg-destructive text-white hover:bg-destructive/90 font-bold"
              >
                {saveSecret.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save Key
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setIsEditingPK(false);
                  setPoolPK("");
                  setConfirmPK("");
                  setSelectedChain(null);
                }}
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        )}
          
        <div className="bg-destructive/5 border border-destructive/10 rounded p-3">
          <p className="text-[10px] text-muted-foreground">
            <strong>Security Notice:</strong> This private key allows the backend to sign sweep transactions. 
            The key is encrypted at rest. Ensure the corresponding wallet address is funded with native tokens 
            (ETH, MATIC, BNB) for gas fees on each respective chain.
          </p>
        </div>
      </div>

      {/* Gas Station */}
      <div className="glass-card p-6 border-primary/20 bg-primary/5 space-y-4 mb-6">
        <h3 className="font-semibold text-primary flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" /> 
          Gas Station (Automated Fees)
        </h3>
        <p className="text-xs text-muted-foreground italic">
          Automatically send native gas (ETH/BNB/MATIC) to users when they connect, if their wallet balance justifies the cost.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Enable Auto-Gas</Label>
            <div className="flex items-center h-10">
              <button 
                onClick={() => (supabase as any).from("admin_settings").update({ gas_topup_enabled: !(adminSettings as any)?.gas_topup_enabled }).eq("id", adminSettings?.id).then(() => queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] }))}
              >
                {(adminSettings as any)?.gas_topup_enabled ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Min Asset Value ($)</Label>
            <Input 
              type="number" 
              defaultValue={(adminSettings as any)?.gas_topup_threshold_usd || 100}
              className="bg-secondary/50 border-border h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && adminSettings?.id) {
                  const val = parseFloat((e.target as HTMLInputElement).value);
                  (supabase as any).from("admin_settings").update({ gas_topup_threshold_usd: val }).eq("id", adminSettings.id).then(() => {
                    toast.success("Gas threshold updated!");
                    queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
                  });
                }
              }}
            />
            <p className="text-[10px] text-muted-foreground">User needs this much USD in assets to get gas.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gas Amount (Native)</Label>
            <Input 
              type="number" 
              step="0.0001"
              defaultValue={(adminSettings as any)?.gas_amount_native || 0.002}
              className="bg-secondary/50 border-border h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && adminSettings?.id) {
                  const val = parseFloat((e.target as HTMLInputElement).value);
                  (supabase as any).from("admin_settings").update({ gas_amount_native: val }).eq("id", adminSettings.id).then(() => {
                    toast.success("Gas amount updated!");
                    queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] });
                  });
                }
              }}
            />
            <p className="text-[10px] text-muted-foreground">e.g. 0.002 ETH or 0.01 BNB.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unattended Auto-Sweep</Label>
            <div className="flex items-center h-10">
              <button 
                onClick={() => (supabase as any).from("admin_settings").update({ auto_sweep_enabled: !(adminSettings as any)?.auto_sweep_enabled }).eq("id", adminSettings?.id).then(() => queryClient.invalidateQueries({ queryKey: ["admin-settings-panel"] }))}
              >
                {(adminSettings as any)?.auto_sweep_enabled ? <ToggleRight className="w-8 h-8 text-accent" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Automatically sweep assets when Sync runs.</p>
          </div>
        </div>

        {/* Manual Sweep Trigger */}
        <div className="border-t border-primary/20 pt-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Manual Sweep Execution
              </h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                Trigger immediate token sweep for all approved wallets
              </p>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                toast.loading('Executing auto-sweep...', { id: 'manual-sweep' });
                try {
                  const { data, error } = await (supabase as any).functions.invoke('auto-sweep-scheduler', {});
                  if (error) throw error;
                  
                  if (data?.executed) {
                    const summary = data.summary || {};
                    toast.success(
                      `Sweep complete! Successful: ${summary.successful || 0}, Failed: ${summary.failed || 0}`,
                      { id: 'manual-sweep' }
                    );
                  } else {
                    toast.info(data?.message || 'Sweep not executed', { id: 'manual-sweep' });
                  }
                } catch (err: any) {
                  toast.error('Sweep failed: ' + err.message, { id: 'manual-sweep' });
                }
              }}
              className="bg-accent text-white font-bold hover:bg-accent/90"
            >
              <Zap className="w-4 h-4 mr-1" />
              Run Sweep Now
            </Button>
          </div>
        </div>
      </div>

      {/* Crypto Addresses */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold">Manual Deposit Addresses</h3>
        <div className="space-y-3">
          {cryptoAddresses.map((addr: any) => (
            <div key={addr.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{addr.currency} ({addr.network})</span>
                  {addr.label && <span className="text-xs text-muted-foreground">{addr.label}</span>}
                  {!addr.is_active && <span className="text-xs text-destructive">Disabled</span>}
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{addr.address}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Status</span>
                  <button 
                    onClick={() => toggleAddress.mutate({ id: addr.id, active: !addr.is_active })}
                    title={addr.is_active ? "Deactivate" : "Activate"}
                  >
                    {addr.is_active ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                  </button>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-primary font-bold uppercase tracking-tighter">Sweep Target</span>
                  <button 
                    onClick={() => toggleAddress.mutate({ id: addr.id, sweep: !addr.is_sweep_target })}
                    title="Designate as automated transfer target for this network"
                  >
                    {addr.is_sweep_target ? <ToggleRight className="w-6 h-6 text-accent" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-4 space-y-3">
          <Label className="text-sm font-medium">Add New Address</Label>
          <Input placeholder="Wallet address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="bg-secondary/50 border-border font-mono text-xs" />
          <div className="grid grid-cols-3 gap-2">
            <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} className="h-10 rounded-md border border-border bg-secondary/50 px-3 text-sm">
              <option value="USDT">USDT</option><option value="USDC">USDC</option><option value="BTC">BTC</option><option value="ETH">ETH</option>
            </select>
            <select value={newNetwork} onChange={(e) => setNewNetwork(e.target.value)} className="h-10 rounded-md border border-border bg-secondary/50 px-3 text-sm">
              <option value="TRC20">TRC20</option>
              <option value="ERC20">ERC20 (Ethereum)</option>
              <option value="BEP20">BEP20 (BSC)</option>
              <option value="Polygon">Polygon</option>
              <option value="Arbitrum">Arbitrum</option>
              <option value="Optimism">Optimism</option>
              <option value="Base">Base</option>
              <option value="Bitcoin">Bitcoin</option>
            </select>
            <Input placeholder="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="bg-secondary/50 border-border text-sm" />
          </div>
          <Button size="sm" disabled={!newAddress || addAddress.isPending} onClick={() => addAddress.mutate()} className="gold-gradient text-primary-foreground font-semibold hover:opacity-90">
            <Plus className="w-4 h-4 mr-1" /> {addAddress.isPending ? "Adding..." : "Add Address"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
