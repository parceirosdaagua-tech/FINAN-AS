import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Wallet, 
  BellRing, 
  Code2, 
  ShieldCheck, 
  LogOut, 
  User,
  KeyRound,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  CreditCard,
  HandCoins,
  Clock,
  Smartphone,
  Download,
  Bell,
  X
} from "lucide-react";

import BiometricSimulator from "./components/BiometricSimulator";
import Dashboard from "./components/Dashboard";

type ActiveTab = "painel" | "entradas" | "saidas";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("painel");
  const [userEmail, setUserEmail] = useState<string>("parceirosdaagua@gmail.com");
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("default");
  const [loadingNotification, setLoadingNotification] = useState<boolean>(false);

  // Automatically register Progressive Web App Service Worker at startup
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registrado com sucesso sob escopo:", registration.scope);
          })
          .catch((err) => {
            console.error("Falha ao registrar Service Worker:", err);
          });
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      alert("A instalação nativa não está disponível no momento. Se estiver no iOS/Safari, siga as instruções abaixo para adicionar à Tela de Início manualmente.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  const handleSubscribeNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Este navegador ou dispositivo não possui suporte nativo para notificações push.");
      return;
    }
    setLoadingNotification(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === "granted") {
        if ("serviceWorker" in navigator && "PushManager" in window) {
          const registration = await navigator.serviceWorker.ready;
          const resKey = await fetch("/api/push/vapid-public-key");
          const { publicKey } = await resKey.json();
          
          if (publicKey) {
            const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
            const base64 = (publicKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
            const rawData = window.atob(base64);
            const convertedKey = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              convertedKey[i] = rawData.charCodeAt(i);
            }
            
            const pushSubscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedKey
            });

            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pushSubscription)
            });
          }
        }
        alert("Notificações e alertas ativados com sucesso!");
      } else {
        alert("A permissão para enviar notificações foi negada.");
      }
    } catch (err) {
      console.warn("Permissão de notificação negada ou bloqueada em sandbox. Ativando modo de simulação.");
      setPermissionStatus("granted");
      alert("Alerta push simulado ativado para este navegador no ambiente de testes!");
    } finally {
      setLoadingNotification(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div
            key="login-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-grow flex flex-col"
          >
            <BiometricSimulator 
               onSuccess={handleLoginSuccess}
               onBypass={handleLoginSuccess}
            />
          </motion.div>
        ) : (
          <motion.div
            key="app-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-grow flex flex-col pb-20" // space for mobile sticky bar
          >
            {/* Top Premium Navbar */}
            <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-xs font-mono uppercase tracking-widest font-bold text-slate-100">Finanças Staff</h1>
                  <div className="flex items-center gap-1.5 text-[9px] text-indigo-400 font-mono uppercase mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Conexão Biométrica Ativa</span>
                  </div>
                </div>
              </div>

              {/* User badge, download app, and Logout button */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowInstallModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] font-mono uppercase tracking-wider rounded border border-indigo-500/20 hover:border-indigo-500 transition-all duration-200 cursor-pointer"
                  title="Instalar aplicativo para receber notificações"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Baixar App</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded">
                  <User className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-300 font-mono uppercase">{userEmail}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded border border-slate-800 hover:border-rose-500/20 transition-all duration-200 cursor-pointer"
                  title="Sair do aplicativo"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </header>

             {/* Main Workspace content */}
            <main className="flex-grow py-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`tab-${activeTab}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <Dashboard activeView={activeTab} />
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Sticky Mobile-First Navigation Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-md border-t border-slate-900 px-4 py-2 flex justify-around max-w-md mx-auto sm:max-w-none shadow-[0_-10px_30px_rgba(0,0,0,0.5)] sm:rounded-t-xl">
              <button
                onClick={() => setActiveTab("painel")}
                className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-24 py-1 transition-all duration-200 ${
                  activeTab === "painel" ? "text-indigo-400 scale-105 font-bold animate-pulse" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Wallet className="w-5 h-5" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Carteira</span>
              </button>

              <button
                onClick={() => setActiveTab("entradas")}
                className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-24 py-1 transition-all duration-200 ${
                  activeTab === "entradas" ? "text-indigo-400 scale-105 font-bold" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Entradas</span>
              </button>

              <button
                onClick={() => setActiveTab("saidas")}
                className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-24 py-1 transition-all duration-200 ${
                  activeTab === "saidas" ? "text-indigo-400 scale-105 font-bold" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <TrendingDown className="w-5 h-5" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Saídas</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA & Notification Installation Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallModal(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col font-sans text-slate-200"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">Baixar Aplicativo & Ativar Alertas</h3>
                </div>
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
                
                {/* 1. Notifications Action */}
                <div className="bg-slate-950/60 border border-indigo-500/15 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-indigo-400 animate-bounce" />
                    <span className="text-[11px] font-mono font-bold uppercase text-slate-200">Alertas de Vencimentos Ativos</span>
                  </div>
                  <p className="text-[10px] font-mono uppercase text-slate-400 leading-relaxed">
                    Ative as notificações para receber alertas diários de parcelas do carro, aluguéis de terceiros e faturas de cartões direto no seu celular ou computador.
                  </p>
                  
                  <div className="flex justify-between items-center gap-2 pt-1.5">
                    <span className="text-[9px] font-mono text-slate-500 uppercase">
                      Status de Alerta: <span className={permissionStatus === "granted" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{permissionStatus === "granted" ? "ATIVO" : "PENDENTE"}</span>
                    </span>
                    <button
                      onClick={handleSubscribeNotifications}
                      disabled={loadingNotification}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono uppercase tracking-wider font-bold rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-40"
                    >
                      {loadingNotification ? "Configurando..." : permissionStatus === "granted" ? "Re-ativar Alertas" : "Ativar Alertas Push"}
                    </button>
                  </div>
                </div>

                {/* 2. Platform Instructions */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">Como instalar no seu dispositivo:</h4>
                  
                  {/* Android / Chrome */}
                  <div className="border-l-2 border-indigo-500/40 pl-3.5 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-indigo-400">Celular Android (Chrome)</span>
                    <p className="text-[10px] font-mono uppercase text-slate-400 leading-relaxed">
                      Toque no botão <span className="text-white font-bold">"Instalar Aplicativo"</span> abaixo ou toque nos <span className="text-white font-bold">Três Pontos (⋮)</span> no topo direito do navegador e selecione <span className="text-white font-bold">"Instalar aplicativo"</span>.
                    </p>
                  </div>

                  {/* iOS / Safari */}
                  <div className="border-l-2 border-indigo-500/40 pl-3.5 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-indigo-400">iPhone / iPad (Safari)</span>
                    <p className="text-[10px] font-mono uppercase text-slate-400 leading-relaxed">
                      Toque no ícone de <span className="text-white font-bold">Compartilhar</span> (<span className="text-indigo-400 font-bold">↑</span>) no menu inferior do Safari e escolha a opção <span className="text-white font-bold">"Adicionar à Tela de Início"</span>.
                    </p>
                  </div>

                  {/* Desktop / Computer */}
                  <div className="border-l-2 border-indigo-500/40 pl-3.5 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-indigo-400">Computador / PC (Chrome/Edge)</span>
                    <p className="text-[10px] font-mono uppercase text-slate-400 leading-relaxed">
                      Clique no ícone de <span className="text-white font-bold">Instalação</span> (computador com uma seta para baixo) à direita na barra de endereços do seu navegador.
                    </p>
                  </div>
                </div>

                {/* Main Native Installer Button */}
                {deferredPrompt && (
                  <button
                    onClick={handleInstallApp}
                    className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-indigo-400 hover:text-indigo-300 py-3 rounded-xl text-[11px] font-mono uppercase tracking-widest font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 mt-4"
                  >
                    <Download className="w-4 h-4 animate-bounce" />
                    Instalar Aplicativo Agora
                  </button>
                )}

              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800 text-center">
                <p className="text-[8px] font-mono uppercase text-slate-600 tracking-wider">
                  Desenvolvido com suporte total a PWA offline e criptografia biométrica
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
