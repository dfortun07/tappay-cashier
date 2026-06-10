'use client';

import { useState, useEffect, useMemo } from 'react';
import { auth, db, collection, addDoc, serverTimestamp, doc, getDoc, runTransaction, query, where, getDocs } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Wallet, Loader2, TrendingUp, Clock, ArrowUpRight, User, CheckCircle, AlertCircle, Sun, Moon, Shield, BarChart3, RefreshCw, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// ─── Mini Gráfico de Barras SVG ───
function MiniBarChart({ data, theme }: { data: number[]; theme: string }) {
  const max = Math.max(...data, 1);
  const barColor = theme === 'light' ? '#0284c7' : '#38bdf8';
  const barColorDim = theme === 'light' ? '#bae6fd' : '#0c4a6e';

  return (
    <div className="flex items-end gap-1.5 h-16 w-full px-1">
      {data.map((val, i) => {
        const heightPct = (val / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md chart-bar relative group cursor-default"
              style={{
                height: `${Math.max(heightPct, 6)}%`,
                background: val > 0 ? barColor : barColorDim,
                animationDelay: `${i * 0.1}s`,
                opacity: val > 0 ? 1 : 0.3,
              }}
            >
              {val > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold pointer-events-none">
                  {val.toFixed(0)} BS
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Labels de días de la semana ───
function WeekLabels() {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const todayIdx = (new Date().getDay() + 6) % 7; // Lun=0
  return (
    <div className="flex gap-1.5 px-1 mt-1">
      {days.map((d, i) => (
        <span
          key={d}
          className={`flex-1 text-center text-[9px] font-bold ${i === todayIdx ? 'text-[#38bdf8]' : 'text-gray-500'}`}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
  const [cashierName, setCashierName] = useState('Cajero');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Estados QR
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [customAmount, setCustomAmount] = useState<number | ''>('');

  // Estados Manual
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | ''>('');
  const [pin, setPin] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState({ type: '', text: '' });

  // Estados Historial
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [weekData, setWeekData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  // Cargar tema desde localStorage al iniciar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('tappay_theme') as 'light' | 'dark';
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tappay_theme', nextTheme);
    }
  };

  // Obtener Historial de Transacciones (Manuales y QR Vouchers)
  const fetchRecentTransactions = async (userParam?: any) => {
    setLoadingHistory(true);
    try {
      const user = userParam || auth.currentUser;
      if (!user) return;

      // 1. Obtener Transacciones Manuales del Cajero
      const qTx = query(
        collection(db, 'transactions'),
        where('cajero_id', '==', user.uid)
      );
      const txSnapshot = await getDocs(qTx);
      const txList: any[] = [];
      txSnapshot.docs.forEach((docSnap: any) => {
        const data = docSnap.data();
        let txDate = new Date();
        if (data.timestamp) {
          if (data.timestamp.seconds) {
            txDate = new Date(data.timestamp.seconds * 1000);
          } else {
            txDate = new Date(data.timestamp);
          }
        }
        txList.push({
          id: docSnap.id,
          type: 'manual',
          title: data.client_email || 'Recarga Directa',
          amount: Number(data.amount || 0),
          date: txDate,
          status: 'completado'
        });
      });

      // 2. Obtener Vouchers QR creados por el Cajero
      const qVoucher = query(
        collection(db, 'vouchers'),
        where('cajero_id', '==', user.uid)
      );
      const voucherSnapshot = await getDocs(qVoucher);
      const voucherList: any[] = [];
      voucherSnapshot.docs.forEach((docSnap: any) => {
        const data = docSnap.data();
        let vDate = new Date();
        if (data.fecha_creacion) {
          if (data.fecha_creacion.seconds) {
            vDate = new Date(data.fecha_creacion.seconds * 1000);
          } else {
            vDate = new Date(data.fecha_creacion);
          }
        }
        voucherList.push({
          id: docSnap.id,
          type: 'qr',
          title: `Cupón QR (${data.estado === 'disponible' ? 'Disponible' : 'Cobrado'})`,
          amount: Number(data.monto || 0),
          date: vDate,
          status: data.estado || 'disponible'
        });
      });

      // 3. Fusionar y ordenar desc
      const mergedList = [...txList, ...voucherList];
      mergedList.sort((a, b) => b.date.getTime() - a.date.getTime());

      // 4. Calcular total de hoy (Bs)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const todayOps = mergedList.filter(op => op.date.getTime() >= startOfToday.getTime());
      // Solo sumamos transacciones manuales y vouchers QR que ya hayan sido cobrados
      const total = todayOps.reduce((sum, op) => {
        if (op.type === 'qr' && op.status === 'disponible') {
          return sum;
        }
        return sum + op.amount;
      }, 0);

      // 5. Calcular datos del gráfico semanal
      const weekTotals = [0, 0, 0, 0, 0, 0, 0]; // Lun a Dom
      const now = new Date();
      const todayDayIdx = (now.getDay() + 6) % 7; // Lun=0

      mergedList.forEach((op) => {
        if (op.type === 'qr' && op.status === 'disponible') return;
        const opDay = (op.date.getDay() + 6) % 7;
        const diffDays = Math.floor((now.getTime() - op.date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
          weekTotals[opDay] += op.amount;
        }
      });

      setWeekData(weekTotals);
      setRecentTransactions(mergedList.slice(0, 8)); // Mostrar últimas 8
      setTodayTotal(total);
    } catch (error) {
      console.error("Error al obtener transacciones:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Verificar Auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      const wasLoggedIn = typeof window !== 'undefined' && localStorage.getItem('tappay_logged_in') === 'true';
      if (!user) {
        if (!wasLoggedIn) {
          router.push('/');
        } else {
          console.log("Firebase Auth está resolviendo el estado de sesión...");
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tappay_logged_in', 'true');
        }
        setCashierName(user.email || 'Cajero');
        fetchRecentTransactions(user);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tappay_logged_in');
    }
    await auth.signOut();
    router.push('/');
  };

  // MÓDULO 1: Generar QR
  const generateVoucher = async (monto: number) => {
    setLoadingQR(true);
    setQrCodeData(null);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const docRef = await addDoc(collection(db, 'vouchers'), {
        monto,
        estado: 'disponible',
        fecha_creacion: serverTimestamp(),
        cajero_id: user.uid
      });

      setQrCodeData(docRef.id);

      // Actualizar el historial reactivamente
      fetchRecentTransactions(auth.currentUser);
    } catch (error) {
      console.error("Error generando voucher:", error);
    } finally {
      setLoadingQR(false);
    }
  };

  // MÓDULO 2: Recarga Manual
  const verifyClient = async () => {
    if (!clientEmail.trim()) {
      setManualMessage({ type: 'error', text: 'Por favor ingresa un correo electrónico.' });
      return;
    }
    setManualMessage({ type: 'info', text: 'Buscando cliente...' });
    setClientId(null);
    setClientName(null);

    try {
      const q = query(collection(db, 'cards'), where('email', '==', clientEmail.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        setClientId(docSnap.id);
        setClientName(docSnap.data().name || "Cliente Registrado");
        setManualMessage({ type: 'success', text: `✓ Cliente encontrado: ${docSnap.data().name}` });
      } else {
        setManualMessage({ type: 'error', text: 'No se encontró ningún cliente con ese correo.' });
      }
    } catch (error) {
      setManualMessage({ type: 'error', text: 'Error buscando al cliente.' });
    }
  };

  const handleManualRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    setManualMessage({ type: '', text: '' });

    try {
      const cashier = auth.currentUser;
      if (!cashier) throw new Error("No autenticado");

      const cashierDocRef = doc(db, 'cards', cashier.uid);
      const cashierDoc = await getDoc(cashierDocRef);

      if (!cashierDoc.exists()) {
        throw new Error("Perfil de cajero no encontrado en la base de datos");
      }

      const dbPin = String(cashierDoc.data().pin).trim();
      const inputPin = String(pin).trim();

      if (dbPin !== inputPin) {
        throw new Error("PIN de seguridad incorrecto");
      }

      if (!clientId) {
        throw new Error("Primero debes buscar un cliente válido");
      }

      const clientRef = doc(db, 'cards', clientId);
      const montoRecarga = Number(amount);

      if (isNaN(montoRecarga) || montoRecarga <= 0) {
        throw new Error("Monto de recarga inválido");
      }

      await runTransaction(db, async (transaction) => {
        const clientSnap = await transaction.get(clientRef);
        if (!clientSnap.exists()) {
          throw new Error("El cliente no existe!");
        }

        const currentBalance = Number(clientSnap.data().balance) || 0;
        const newBalance = currentBalance + montoRecarga;

        // Regla Antifraude (Límite de 5000 Bs)
        if (newBalance > 5000) {
          throw new Error("Límite de 5000 Bs excedido en la cuenta del cliente");
        }

        // Actualizamos el saldo
        transaction.update(clientRef, { balance: newBalance });

        // Creación del Historial
        const newTxRef = doc(collection(db, 'transactions'));
        transaction.set(newTxRef, {
          card_id: clientId,
          client_email: clientEmail.trim(),
          cajero_id: cashier.uid,
          amount: montoRecarga,
          type: 'RECARGA',
          description: 'Recarga en Cajero Web',
          timestamp: serverTimestamp()
        });
      });

      setManualMessage({ type: 'success', text: '¡Recarga exitosa!' });
      setAmount('');
      setClientEmail('');
      setPin('');
      setClientName(null);
      setClientId(null);

      // Actualizar el historial reactivamente
      fetchRecentTransactions(auth.currentUser);

    } catch (error: any) {
      setManualMessage({ type: 'error', text: error.message || 'Error en la recarga' });
    } finally {
      setManualLoading(false);
    }
  };

  // Contadores calculados
  const todayOpsCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return recentTransactions.filter(t => t.date.getTime() >= startOfToday.getTime()).length;
  }, [recentTransactions]);

  // ─── CLASES DINÁMICAS LIGHT / DARK ───
  const isDark = theme === 'dark';

  const bgMain = isDark ? 'bg-animated-gradient' : 'bg-[#f0f2f5]';
  const bgSidebar = isDark ? 'glass-card border-r-0' : 'glass-card-light border-r-0';
  const bgCard = isDark ? 'glass-card' : 'glass-card-light';
  const bgHeader = isDark ? 'glass-card border-t-0 border-x-0 rounded-none' : 'glass-card-light border-t-0 border-x-0 rounded-none';
  const textTitle = isDark ? 'text-white' : 'text-gray-900';
  const textSubtitle = isDark ? 'text-gray-400' : 'text-gray-500';
  const bgInput = isDark
    ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 focus:border-[#38bdf8]/50 focus:ring-1 focus:ring-[#38bdf8]/30'
    : 'bg-white/80 border border-gray-200 text-gray-950 placeholder-gray-400 focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7]/20';
  const bgTabs = isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-white/50 border border-gray-200/50';
  const tabActive = isDark
    ? 'bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white shadow-lg shadow-[#0284c7]/25 border border-white/10'
    : 'bg-white text-gray-900 shadow-md border border-gray-200/50';
  const tabInactive = isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]' : 'text-gray-500 hover:text-gray-800 hover:bg-white/40';
  const qrButton = isDark
    ? 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white hover:border-[#38bdf8]/30'
    : 'bg-white/60 hover:bg-white/90 border border-gray-200/60 text-gray-800 hover:border-[#0284c7]/30 hover:shadow-md';
  const bgTxItem = isDark
    ? 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05]'
    : 'bg-white/50 hover:bg-white/80 border border-gray-100';
  const sidebarLink = isDark ? 'text-gray-400 hover:bg-white/[0.05] hover:text-white' : 'text-gray-600 hover:bg-black/[0.04] hover:text-gray-900';
  const sidebarLinkActive = isDark ? 'bg-white/[0.06] text-white font-semibold' : 'bg-black/[0.04] text-gray-900 font-semibold';

  return (
    <div className={`min-h-screen flex ${bgMain} selection:bg-[#38bdf8]/30 transition-colors duration-500 font-sans relative overflow-hidden`}>

      {/* Floating Orbs (dark mode only) */}
      {isDark && (
        <>
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </>
      )}

      {/* 1. SIDEBAR LATERAL (DESKTOP) */}
      <aside className={`hidden md:flex flex-col w-64 ${bgSidebar} p-6 justify-between shrink-0 transition-all duration-500 relative z-10`}>
        <div className="flex flex-col gap-8">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-[#0284c7] to-[#0369a1] glow-blue' : 'bg-black'}`}>
              <span className="text-lg font-black">T</span>
            </div>
            <div>
              <span className={`font-extrabold text-lg tracking-wider ${textTitle}`}>
                TapPay
              </span>
              <span className="text-[9px] block font-mono text-[#38bdf8] tracking-widest uppercase -mt-1">Cajero</span>
            </div>
          </div>

          {/* Menú de Enlaces */}
          <nav className="flex flex-col gap-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider mb-2 px-3 ${textSubtitle}`}>
              Menu Principal
            </span>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer btn-press ${activeTab === 'qr' ? sidebarLinkActive : sidebarLink}`}
            >
              <QrCode size={18} />
              <span>Generar QR</span>
              {activeTab === 'qr' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />}
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer btn-press ${activeTab === 'manual' ? sidebarLinkActive : sidebarLink}`}
            >
              <Wallet size={18} />
              <span>Recarga Directa</span>
              {activeTab === 'manual' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />}
            </button>

            <span className={`text-[10px] font-bold uppercase tracking-wider mt-5 mb-2 px-3 ${textSubtitle}`}>
              Sistema
            </span>
            <div className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${textSubtitle}`}>
              <Shield size={18} />
              <span>Seguridad Activa</span>
              <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 pulse-glow" />
            </div>
          </nav>
        </div>

        {/* Sección del Cajero en la Base del Sidebar */}
        <div className={`flex flex-col gap-4 pt-6 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-gray-200/50'}`}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-[#38bdf8]/10 flex items-center justify-center text-[#38bdf8] border border-[#38bdf8]/20">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold truncate ${textTitle}`}>
                {cashierName.split('@')[0]}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{cashierName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-xl text-xs font-bold transition-all cursor-pointer btn-press border border-red-500/10"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* 2. AREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">

        {/* CABECERA SUPERIOR */}
        <header className={`px-6 md:px-8 py-4 flex justify-between items-center ${bgHeader} transition-all duration-500`}>
          <div className="flex items-center gap-3 md:hidden">
            {/* Logo para móvil */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-lg ${isDark ? 'bg-gradient-to-br from-[#0284c7] to-[#0369a1]' : 'bg-black'}`}>
              <span className="text-base font-black">T</span>
            </div>
            <span className={`font-extrabold text-base tracking-wider ${textTitle}`}>
              TapPay
            </span>
          </div>

          <div className="hidden md:block">
            <h1 className={`text-xl font-bold ${textTitle}`}>
              {activeTab === 'qr' ? 'Vouchers QR' : 'Recargas Directas'}
            </h1>
            <p className={`text-xs ${textSubtitle}`}>Gestión de depósitos y emisión de saldos</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Switch de Modo Claro / Oscuro */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer btn-press ${isDark ? 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] text-[#38bdf8]' : 'bg-white/60 border-gray-200 hover:bg-white text-gray-700'}`}
              title="Cambiar tema"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Botón Salir Móvil */}
            <button
              onClick={handleLogout}
              className="md:hidden p-2.5 rounded-xl bg-red-500/10 border border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer btn-press"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* CONTENIDO CENTRAL */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">

          {/* ═══ Fila Superior: Tarjetas de Estadísticas ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

            {/* 💰 Tarjeta: Caja del Turno */}
            <div className={`relative overflow-hidden rounded-2xl p-6 animate-slide-up ${isDark ? 'bg-gradient-to-br from-[#0c1a3a] to-[#0a1228] border border-[#38bdf8]/10 glow-blue' : 'bg-gradient-to-br from-[#0284c7] to-[#0369a1] border border-[#0284c7]/20'} text-white group`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-700" />
              <div className="flex items-center gap-4 relative">
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-sm">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Caja del Turno (Hoy)</p>
                  <h3 className="text-2xl font-black mt-0.5 drop-shadow-lg min-h-[32px] flex items-center animate-count">
                    {loadingHistory ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                      `${todayTotal.toFixed(2)} BS`
                    )}
                  </h3>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                <Zap size={12} className="text-white/50" />
                <span className="text-[10px] text-white/50 font-medium">{todayOpsCount} operaciones hoy</span>
              </div>
            </div>

            {/* 📊 Tarjeta: Gráfico Semanal */}
            <div className={`${bgCard} rounded-2xl p-6 transition-all duration-500 relative overflow-hidden group animate-slide-up-delay-1 shimmer-hover`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#0284c7]/5 rounded-full blur-2xl group-hover:bg-[#0284c7]/10 transition-all duration-700" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#0284c7]/10 border border-[#0284c7]/20 text-[#38bdf8]' : 'bg-[#0284c7]/10 border border-[#0284c7]/20 text-[#0284c7]'}`}>
                    <BarChart3 size={18} />
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${textSubtitle}`}>Resumen Semanal</p>
                </div>
              </div>
              <MiniBarChart data={weekData} theme={theme} />
              <WeekLabels />
            </div>

            {/* ✅ Tarjeta: Estado Servidor */}
            <div className={`${bgCard} rounded-2xl p-6 transition-all duration-500 flex flex-col justify-between relative overflow-hidden group animate-slide-up-delay-2 shimmer-hover`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-700" />
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 glow-emerald' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'}`}>
                  <CheckCircle size={22} />
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${textSubtitle}`}>Estado del Servidor</p>
                  <h3 className="text-sm font-bold mt-1 text-emerald-500 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-glow inline-block" />
                    Sincronizado
                  </h3>
                </div>
              </div>
              <div className={`mt-4 pt-3 flex items-center gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-gray-200/40'}`}>
                <Shield size={12} className={textSubtitle} />
                <span className={`text-[10px] font-medium ${textSubtitle}`}>Conexión cifrada activa</span>
              </div>
            </div>

          </div>

          {/* ═══ Grid de 2 Columnas ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* Columna Izquierda: Acciones (Tabs y Formulario) */}
            <div className="lg:col-span-7 flex flex-col gap-6 animate-slide-up-delay-2">

              {/* Selector de pestañas para móvil */}
              <div className={`flex md:hidden p-1.5 rounded-2xl ${bgTabs} w-full`}>
                <button
                  onClick={() => { setActiveTab('qr'); setQrCodeData(null); }}
                  className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer btn-press ${activeTab === 'qr' ? tabActive : tabInactive}`}
                >
                  <QrCode size={16} /> QR
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer btn-press ${activeTab === 'manual' ? tabActive : tabInactive}`}
                >
                  <Wallet size={16} /> Manual
                </button>
              </div>

              {/* Contenedor Principal Formulario */}
              <div className={`${bgCard} rounded-2xl p-6 md:p-8 min-h-[460px] relative transition-all duration-500`}>

                {/* Generador QR */}
                {activeTab === 'qr' && (
                  <div className="transition-all duration-300">
                    <h2 className={`text-xl font-extrabold ${textTitle} mb-1`}>Generar Voucher QR</h2>
                    <p className={`text-xs ${textSubtitle} mb-8`}>Crea cupones de saldo instantáneos. El cliente escaneará el QR desde su dispositivo móvil.</p>

                    <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                      {[10, 20, 50, 100].map((val, i) => (
                        <button
                          key={val}
                          onClick={() => generateVoucher(val)}
                          disabled={loadingQR}
                          className={`py-5 rounded-2xl ${qrButton} transition-all duration-300 group relative overflow-hidden cursor-pointer btn-press disabled:opacity-50 font-bold shimmer-hover`}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <span className={`text-[10px] block mb-1 ${textSubtitle}`}>Monto Fijo</span>
                          <span className="text-xl font-black">{val} BS</span>
                        </button>
                      ))}
                    </div>

                    {/* Monto Personalizado */}
                    <div className={`mt-8 pt-6 max-w-lg mx-auto ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-gray-200/50'}`}>
                      <label className={`block text-xs font-bold mb-2 uppercase tracking-wider ${textSubtitle}`}>Monto personalizado (BS)</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none font-bold text-sm ${textSubtitle}`}>
                            BS
                          </div>
                          <input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value ? Number(e.target.value) : '')}
                            className={`w-full pl-10 pr-4 py-3 rounded-xl outline-none font-extrabold text-base transition-all ${bgInput}`}
                            placeholder="0.00"
                            min="1"
                            disabled={loadingQR}
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (customAmount && Number(customAmount) > 0) {
                              generateVoucher(Number(customAmount));
                              setCustomAmount('');
                            }
                          }}
                          disabled={loadingQR || !customAmount}
                          className={`px-6 rounded-xl font-bold transition-all btn-press disabled:opacity-50 cursor-pointer flex items-center justify-center text-sm uppercase tracking-wider ${isDark ? 'bg-gradient-to-r from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#0284c7] text-white shadow-lg shadow-[#0284c7]/20' : 'bg-black hover:bg-gray-800 text-white shadow-md'}`}
                        >
                          Generar
                        </button>
                      </div>
                    </div>

                    {loadingQR && (
                      <div className="mt-8 flex justify-center">
                        <div className="flex items-center gap-3 bg-[#38bdf8]/10 border border-[#38bdf8]/20 px-5 py-3 rounded-2xl text-[#38bdf8] text-xs font-semibold animate-pulse">
                          <Loader2 className="animate-spin h-4 w-4" />
                          <span>Generando cupón de seguridad...</span>
                        </div>
                      </div>
                    )}

                    {qrCodeData && !loadingQR && (
                      <div className="mt-8 p-6 bg-white rounded-2xl max-w-xs mx-auto shadow-xl border border-gray-100 flex flex-col items-center relative overflow-hidden group animate-slide-up">
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#0284c7] to-[#38bdf8]" />
                        <QRCodeSVG value={qrCodeData} size={180} level="H" className="my-2" />
                        <p className="mt-4 text-[#0c142c] font-mono text-[9px] text-center select-all bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200/50 break-all w-full">
                          ID: {qrCodeData}
                        </p>
                        <p className="text-black font-black mt-3 text-xs tracking-wider uppercase">Voucher Listo</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'manual' && (
                  <div className="max-w-lg mx-auto transition-all duration-300">
                    <h2 className={`text-xl font-extrabold ${textTitle} mb-1`}>Recarga Directa (Manual)</h2>
                    <p className={`text-xs ${textSubtitle} mb-8`}>Transfiere saldo de forma segura directo al perfil de tarjeta del cliente.</p>

                    <form onSubmit={handleManualRecharge} className="space-y-5">
                      <div>
                        <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${textSubtitle}`}>Email del Cliente</label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                            className={`flex-1 px-4 py-3 rounded-xl outline-none transition-all text-sm ${bgInput}`}
                            placeholder="cliente@email.com"
                            required
                          />
                          <button
                            type="button"
                            onClick={verifyClient}
                            className={`px-5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border btn-press ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 border-white/[0.08]' : 'bg-white/60 hover:bg-white text-gray-800 border-gray-200'}`}
                          >
                            Buscar
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${textSubtitle}`}>Monto a Recargar (BS)</label>
                          <div className="relative">
                            <span className={`absolute left-4 top-3.5 font-bold text-sm ${textSubtitle}`}>BS</span>
                            <input
                              type="number"
                              value={amount}
                              onChange={(e) => setAmount(Number(e.target.value))}
                              className={`w-full pl-10 pr-4 py-3 rounded-xl outline-none font-bold text-base transition-all ${bgInput}`}
                              placeholder="0.00"
                              min="1"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-red-500 mb-1.5 uppercase tracking-wider">PIN del Cajero</label>
                          <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            maxLength={4}
                            className={`w-full px-4 py-3 rounded-xl outline-none tracking-[0.6em] text-center font-bold text-base transition-all placeholder:tracking-normal placeholder:font-normal ${isDark ? 'bg-red-950/20 border border-red-500/20 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500/30' : 'bg-red-50/50 border border-red-200/50 text-red-950 focus:border-red-500 focus:ring-1 focus:ring-red-500/20'}`}
                            placeholder="••••"
                            required
                          />
                        </div>
                      </div>

                      {manualMessage.text && (
                        <div className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-3 animate-slide-up ${
                          manualMessage.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                          manualMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                          'bg-blue-500/10 border-blue-500/20 text-blue-500'
                        }`}>
                          {manualMessage.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle size={16} className="shrink-0" />}
                          <span>{manualMessage.text}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={manualLoading || !clientName}
                        className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all flex justify-center items-center gap-2 btn-press disabled:scale-100 ${isDark ? 'bg-gradient-to-r from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#0284c7] text-white shadow-lg shadow-[#0284c7]/20' : 'bg-black hover:bg-gray-800 text-white shadow-md'}`}
                      >
                        {manualLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Confirmar y Procesar'}
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>

            {/* ═══ Columna Derecha: Actividad de Turno ═══ */}
            <div className="lg:col-span-5 flex flex-col gap-6 animate-slide-up-delay-3">

              <div className={`${bgCard} rounded-2xl p-6 min-h-[460px] flex flex-col transition-all duration-500`}>
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className={`text-base font-extrabold ${textTitle}`}>Actividad de Turno</h2>
                    <p className={`text-[11px] ${textSubtitle} mt-0.5`}>Últimas operaciones realizadas</p>
                  </div>
                  <button
                    onClick={() => fetchRecentTransactions(auth.currentUser)}
                    disabled={loadingHistory}
                    className={`p-2.5 rounded-xl border cursor-pointer btn-press transition-all disabled:opacity-50 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]' : 'bg-white/60 border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-white'}`}
                  >
                    <RefreshCw size={14} className={loadingHistory ? 'animate-spin text-[#38bdf8]' : ''} />
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-[#38bdf8] h-7 w-7" />
                    <span className="text-xs text-gray-400">Actualizando historial...</span>
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className={`flex-1 flex flex-col items-center justify-center gap-4 text-center p-6 border border-dashed rounded-2xl ${isDark ? 'border-white/[0.06] bg-white/[0.01]' : 'border-gray-200 bg-white/20'}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/[0.04] text-gray-500' : 'bg-gray-100 text-gray-400'}`}>
                      <Clock size={24} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${textTitle}`}>Sin operaciones todavía</h3>
                      <p className={`text-xs ${textSubtitle} max-w-[200px] mt-1 mx-auto`}>Tus transacciones de recarga aparecerán aquí de forma inmediata.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-2.5">
                    {recentTransactions.map((tx, idx) => (
                      <div
                        key={tx.id}
                        className={`p-3.5 rounded-xl ${bgTxItem} flex items-center justify-between transition-all duration-300 group shimmer-hover`}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {tx.type === 'qr' ? (
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              tx.status === 'disponible'
                                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                            }`}>
                              <QrCode size={15} />
                            </div>
                          ) : (
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#0284c7]/10 border border-[#0284c7]/20 text-[#38bdf8]' : 'bg-[#0284c7]/10 border border-[#0284c7]/20 text-[#0284c7]'}`}>
                              <ArrowUpRight size={15} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate pr-2 ${textTitle}`}>
                              {tx.title}
                            </p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock size={9} />
                              {tx.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {tx.date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[9px] font-bold block uppercase ${textSubtitle}`}>
                            {tx.type === 'qr' ? 'Cupón' : 'Directa'}
                          </span>
                          <span className={`text-sm font-black ${tx.type === 'qr' && tx.status === 'disponible' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            +{tx.amount.toFixed(2)} BS
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className={`mt-5 pt-4 text-center ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-gray-200/40'}`}>
                  <span className={`text-[9px] font-bold tracking-wider uppercase ${textSubtitle}`}>Auditoría TapPay Activa</span>
                </div>

              </div>

            </div>

          </div>

        </main>
      </div>

    </div>
  );
}
