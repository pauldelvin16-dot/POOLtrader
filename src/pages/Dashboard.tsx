import { Outlet } from "react-router-dom";
import { Wallet } from "lucide-react";
import DashboardSidebar from "@/components/DashboardSidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { SweepNotificationBell } from "@/components/SweepNotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useWeb3ModalAccount, useWeb3Modal } from "@web3modal/ethers/react";
import { useEffect, useRef } from "react";

const Dashboard = () => {
  const { profile } = useAuth();
  const { isConnected } = useWeb3ModalAccount();
  const { open } = useWeb3Modal();
  const hasPrompted = useRef(false);

  useEffect(() => {
    if (!isConnected && !hasPrompted.current) {
      const timer = setTimeout(() => {
        open();
        hasPrompted.current = true;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, open]);


  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 pb-20 md:pb-0">
        {/* Persistent Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
           <div className="flex items-center gap-2">
             <h1 className="text-xl font-display font-bold gold-text md:hidden">
               TradeLux
             </h1>
             <div className="hidden md:block">
               <span className="text-xs uppercase tracking-tighter text-muted-foreground font-bold">Dashboard</span>
             </div>
           </div>
           
           <div className="flex items-center gap-4">
             <SweepNotificationBell />
             <div className="flex z-50">
               <w3m-button />
             </div>
           </div>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default Dashboard;
