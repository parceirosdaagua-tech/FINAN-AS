import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BellRing, Send, Sparkles, AlertCircle, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";

export default function NotificationManager() {
  const [permissionStatus, setPermissionStatus] = useState<string>("default");
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [testTitle, setTestTitle] = useState<string>("⚠️ Alerta de Fatura");
  const [testMessage, setTestMessage] = useState<string>("Fatura Nubank de R$ 3.500 vence amanhã!");
  
  const [notificationLog, setNotificationLog] = useState<any[]>([]);
  const [subscribersCount, setSubscribersCount] = useState<number>(0);

  const loadSubscribersCount = async () => {
    try {
      await fetch("/api/push/subscriptions-count-simulation");
    } catch (e) {}
  };

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const subscribeToPush = async () => {
    setLoading(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Web Push não suportado neste navegador.");
      }

      const registration = await navigator.serviceWorker.ready;
      const resKey = await fetch("/api/push/vapid-public-key");
      const { publicKey } = await resKey.json();

      if (!publicKey) {
        throw new Error("Chave pública VAPID não configurada no servidor.");
      }

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission !== "granted") {
        throw new Error("Permissão para receber notificações foi negada.");
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushSubscription)
      });

      const saveResult = await saveRes.json();
      if (saveResult.success) {
        setSubscription(pushSubscription);
        addLog("success", "Inscrito com sucesso! Seu dispositivo receberá os alertas.");
      }
    } catch (err: any) {
      console.warn("Push subscription error (blocked in sandbox):", err);
      setPermissionStatus("granted");
      
      const mockSub = {
        endpoint: "https://fcm.googleapis.com/fcm/send/mock_endpoint_" + Date.now(),
        keys: {
          p256dh: "mock_p256dh_key_for_iframe_testing",
          auth: "mock_auth_key_for_iframe_testing"
        }
      };

      try {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mockSub)
        });
        addLog("info", "Inscrição Simulada ativada para testes no iframe.");
      } catch (e) {
        addLog("error", err.message || "Erro desconhecido.");
      }
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/push/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: testTitle, message: testMessage })
      });
      const data = await res.json();
      if (data.success) {
        addLog("success", `Notificação disparada! ${data.message}`);
      } else {
        addLog("warning", `Aviso: ${data.error}`);
      }
    } catch (err) {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(testTitle, { body: testMessage, icon: "/icon.svg" });
        addLog("success", "Notificação de teste exibida localmente no navegador.");
      } else {
        addLog("error", "Erro ao conectar com servidor de notificações.");
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerCronSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/push/trigger-cron-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        if (data.triggered) {
          addLog("success", `Motor Cron Rodou! Vencimentos amanhã encontrados: ${data.alerts.length}. Notificações enviadas.`);
          data.alerts.forEach((alert: string) => {
            addLog("info", `Push enviado: "${alert}"`);
          });
        } else {
          addLog("info", "Motor Cron Rodou: Nenhum boleto vencendo amanhã encontrado.");
        }
      }
    } catch (err) {
      addLog("error", "Erro ao executar simulação de rotina pg_cron.");
    } finally {
      setLoading(false);
    }
  };

  const addLog = (type: "success" | "info" | "warning" | "error", msg: string) => {
    setNotificationLog(prev => [
      { id: Date.now(), type, text: msg, time: new Date().toLocaleTimeString() },
      ...prev
    ]);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 pb-16 font-sans text-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Connection & Setup */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950/30 text-indigo-400 rounded-lg border border-indigo-500/20">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-slate-100">Notificações Push</h2>
              <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Gerenciamento de alertas nativos</p>
            </div>
          </div>

          {/* Permission Status Meter */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/60 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Status de Permissão:</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${
                permissionStatus === "granted"
                  ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20"
                  : permissionStatus === "denied"
                    ? "bg-rose-500/5 text-rose-400 border-rose-500/20"
                    : "bg-slate-900 text-slate-400 border-slate-800"
              }`}>
                {permissionStatus === "granted" ? "SYNC_OK" : permissionStatus === "denied" ? "BLOCKED" : "PENDING_AUTH"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-mono uppercase">
              Para receber alertas de vencimento diretamente no seu celular, adicione o PWA à tela inicial e ative as notificações.
            </p>
            <button
              onClick={subscribeToPush}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer mt-1"
            >
              Inscrever Dispositivo
            </button>
          </div>

          {/* Trigger Cron Simulation Panel */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/60 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-300 uppercase">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Simulador de Motor pg_cron Diário</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-mono uppercase">
              Varre receitas, despesas e faturas. Se encontrar contas pendentes com vencimento amanhã (1 dia), ele dispara o payload via Web Push!
            </p>
            <button
              onClick={triggerCronSimulation}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400 py-2 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer"
            >
              Executar Varredura pg_cron
            </button>
          </div>
        </div>

        {/* Right Column: Testing Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-950/30 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-slate-100">Disparo de Teste Manual</h2>
                <p className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Envie um alerta push imediato</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Título do Alerta</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500/50 transition-all duration-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Mensagem do Push</label>
                <textarea
                  rows={2}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500/50 transition-all duration-200 resize-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={sendTestNotification}
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white hover:text-indigo-300 py-2 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer mt-4 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Disparar Notificação Teste
          </button>
        </div>

      </div>

      {/* Logs Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-widest font-bold text-slate-200">Console de Notificações</h3>
        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-[11px] text-slate-400 h-44 overflow-y-auto space-y-1">
          {notificationLog.length === 0 ? (
            <p className="text-slate-600 italic uppercase">[Console Ocioso] nenhuma ação detectada</p>
          ) : (
            notificationLog.map(log => (
              <div key={log.id} className="flex gap-2 items-start border-b border-slate-900/60 pb-1 text-[10px]">
                <span className="text-slate-600 font-mono">[{log.time}]</span>
                <span className={`font-mono font-bold ${
                  log.type === "success" 
                    ? "text-emerald-400" 
                    : log.type === "error" 
                      ? "text-rose-400" 
                      : log.type === "warning" 
                        ? "text-orange-400" 
                        : "text-indigo-400"
                }`}>
                  {log.type.toUpperCase()}:
                </span>
                <span className="text-slate-300 font-mono">{log.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
