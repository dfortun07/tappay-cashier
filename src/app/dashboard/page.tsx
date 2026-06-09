'use client';

import { useState, useEffect } from 'react';
import { auth, db, collection, addDoc, serverTimestamp, doc, getDoc, runTransaction, query, where, getDocs } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Wallet, Loader2, TrendingUp, Clock, ArrowUpRight, User, DollarSign, CheckCircle, AlertCircle, Sun, Moon, Settings, Shield } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

      setRecentTransactions(mergedList.slice(0, 5)); // Mostrar solo las últimas 5
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

  // Clases CSS dinámicas para Light/Dark Mode
  const bgMain = theme === 'light' ? 'bg-[#f4f5f8]' : 'bg-[#090d16]';
  const bgSidebar = theme === 'light' ? 'bg-white border-r border-gray-200/60' : 'bg-[#0f1423] border-r border-white/5';
  const textSidebarLabel = theme === 'light' ? 'text-gray-400' : 'text-gray-500';
  const textSidebarLink = theme === 'light' ? 'text-gray-700 hover:bg-gray-100 hover:text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white';
  const textSidebarLinkActive = theme === 'light' ? 'bg-gray-100 text-black font-semibold' : 'bg-white/5 text-white font-semibold';
  
  const bgCard = theme === 'light' ? 'bg-white border border-gray-200/50 shadow-sm' : 'bg-[#0e1735]/40 backdrop-blur-xl border border-white/5 shadow-2xl';
  const textTitle = theme === 'light' ? 'text-gray-900' : 'text-white';
  const textSubtitle = theme === 'light' ? 'text-gray-500' : 'text-gray-400';
  const bgInput = theme === 'light' ? 'bg-gray-50 border border-gray-200 text-gray-950 focus:border-black focus:ring-black' : 'bg-[#111936]/80 border border-white/5 text-white focus:border-[#38bdf8] focus:ring-[#38bdf8]';
  
  const bgTabs = theme === 'light' ? 'bg-gray-100 border border-gray-200/50' : 'bg-[#0a1228]/80 border border-white/5';
  const tabActive = theme === 'light' ? 'bg-white text-black shadow-sm' : 'bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white shadow-lg shadow-[#0284c7]/20 border border-white/10';
  const tabInactive = theme === 'light' ? 'text-gray-500 hover:text-black hover:bg-gray-50' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5';

  const qrButton = theme === 'light' ? 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800' : 'bg-[#121c40]/60 hover:bg-[#182759] border border-white/5 text-white hover:border-[#38bdf8]/40';
  
  const bgTxItem = theme === 'light' ? 'bg-gray-50/70 hover:bg-gray-100/80 border border-gray-100' : 'bg-[#121c40]/30 hover:bg-[#121c40]/60 border border-white/5';

  return (
    <div className={`min-h-screen flex ${bgMain} selection:bg-[#38bdf8]/30 transition-colors duration-300 font-sans`}>
      
      {/* 1. SIDEBAR LATERAL (DESKTOP) */}
      <aside className={`hidden md:flex flex-col w-64 ${bgSidebar} p-6 justify-between shrink-0 transition-colors duration-300`}>
        <div className="flex flex-col gap-8">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center font-bold text-white shadow-lg relative overflow-hidden">
              <span className="text-lg font-black">T</span>
            </div>
            <div>
              <span className={`font-extrabold text-lg tracking-wider ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                TapPay
              </span>
              <span className="text-[9px] block font-mono text-[#38bdf8] tracking-widest uppercase -mt-1">Cajero</span>
            </div>
          </div>

          {/* Menú de Enlaces */}
          <nav className="flex flex-col gap-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider mb-2 px-3 ${textSidebarLabel}`}>
              Menu Principal
            </span>
            <button 
              onClick={() => setActiveTab('qr')}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeTab === 'qr' ? textSidebarLinkActive : textSidebarLink}`}
            >
              <QrCode size={18} />
              <span>Generar QR</span>
            </button>
            <button 
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeTab === 'manual' ? textSidebarLinkActive : textSidebarLink}`}
            >
              <Wallet size={18} />
              <span>Recarga Directa</span>
            </button>
            
            <span className={`text-[10px] font-bold uppercase tracking-wider mt-5 mb-2 px-3 ${textSidebarLabel}`}>
              Sistema
            </span>
            <div className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm text-gray-500 font-medium`}>
              <Shield size={18} />
              <span>Seguridad Activa</span>
            </div>
          </nav>
        </div>

        {/* Sección del Cajero en la Base del Sidebar */}
        <div className="flex flex-col gap-4 pt-6 border-t border-gray-200/50 dark:border-white/5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-[#38bdf8]/10 flex items-center justify-center text-[#38bdf8] border border-[#38bdf8]/20">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold truncate ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                {cashierName.split('@')[0]}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{cashierName}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 border border-red-500/10"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* 2. AREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* CABECERA SUPERIOR */}
        <header className={`px-6 md:px-8 py-4 flex justify-between items-center ${theme === 'light' ? 'bg-white border-b border-gray-200/50' : 'bg-[#0f1423]/40 border-b border-white/5'} transition-colors duration-300`}>
          <div className="flex items-center gap-3 md:hidden">
            {/* Logo para móvil */}
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center font-bold text-white shadow-lg">
              <span className="text-base font-black">T</span>
            </div>
            <span className={`font-extrabold text-base tracking-wider ${theme === 'light' ? 'text-black' : 'text-white'}`}>
              TapPay
            </span>
          </div>

          <div className="hidden md:block">
            <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-black' : 'text-white'}`}>
              {activeTab === 'qr' ? 'Vouchers QR' : 'Recargas Directas'}
            </h1>
            <p className={`text-xs ${textSubtitle}`}>Gestión de depósitos y emisión de saldos</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Switch de Modo Claro / Oscuro */}
            <button 
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border ${theme === 'light' ? 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700' : 'bg-[#121c40]/60 border-white/5 hover:bg-[#182759] text-[#38bdf8]'} transition-all cursor-pointer`}
              title="Cambiar tema"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            
            {/* Botón Salir Móvil */}
            <button 
              onClick={handleLogout}
              className="md:hidden p-2.5 rounded-xl bg-red-500/10 border border-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* CONTENIDO CENTRAL */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          
          {/* Fila Superior: Tarjetas de estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Tarjeta de Caja Principal: Negro Absoluto Estilo Premium */}
            <div className="bg-[#0b0c10] text-white border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#38bdf8]/10 rounded-full blur-2xl group-hover:bg-[#38bdf8]/20 transition-colors" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Caja del Turno (Hoy)</p>
                  <h3 className="text-2xl font-black mt-1 text-[#38bdf8] drop-shadow-[0_0_12px_rgba(56,189,248,0.35)] min-h-[32px] flex items-center">
                    {loadingHistory ? (
                      <Loader2 className="animate-spin h-5 w-5 text-[#38bdf8]" />
                    ) : (
                      `${todayTotal.toFixed(2)} BS`
                    )}
                  </h3>
                </div>
              </div>
            </div>

            <div className={`${bgCard} rounded-3xl p-6 transition-all duration-300 relative overflow-hidden group`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#0284c7]/5 rounded-full blur-2xl group-hover:bg-[#0284c7]/10 transition-colors" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0284c7]/10 to-[#38bdf8]/10 border border-[#38bdf8]/20 flex items-center justify-center text-[#38bdf8]">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Historial de Turno</p>
                  <h3 className={`text-2xl font-black mt-1 ${textTitle} min-h-[32px] flex items-center`}>
                    {loadingHistory ? (
                      <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                    ) : (
                      `${recentTransactions.length} ${recentTransactions.length === 1 ? 'Operación' : 'Operaciones'}`
                    )}
                  </h3>
                </div>
              </div>
            </div>

            <div className={`${bgCard} rounded-3xl p-6 transition-all duration-300 flex items-center justify-between relative overflow-hidden group md:col-span-1`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#10b981]/5 rounded-full blur-2xl" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado del Servidor</p>
                  <h3 className="text-sm font-bold mt-1 text-emerald-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                    Sincronizado
                  </h3>
                </div>
              </div>
            </div>

          </div>

          {/* Grid de 2 Columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Columna Izquierda: Acciones (Tabs y Formulario) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Selector de pestañas para móvil (oculto en desktop ya que usa sidebar) */}
              <div className={`flex md:hidden p-1.5 rounded-2xl ${bgTabs} w-full shadow-sm`}>
                <button
                  onClick={() => { setActiveTab('qr'); setQrCodeData(null); }}
                  className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer ${activeTab === 'qr' ? tabActive : tabInactive}`}
                >
                  <QrCode size={16} /> QR
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer ${activeTab === 'manual' ? tabActive : tabInactive}`}
                >
                  <Wallet size={16} /> Manual
                </button>
              </div>

              {/* Contenedor Principal Formulario */}
              <div className={`${bgCard} rounded-3xl p-6 md:p-8 min-h-[460px] relative transition-colors duration-300`}>
                
                {/* Generador QR */}
                {activeTab === 'qr' && (
                  <div className="transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
                    <h2 className={`text-xl font-extrabold ${textTitle} mb-1`}>Generar Voucher QR</h2>
                    <p className={`text-xs ${textSubtitle} mb-8`}>Crea cupones de saldo instantáneos. El cliente escaneará el QR desde su dispositivo móvil.</p>
                    
                    <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                      {[10, 20, 50, 100].map((val) => (
                        <button
                          key={val}
                          onClick={() => generateVoucher(val)}
                          disabled={loadingQR}
                          className={`py-5 rounded-2xl ${qrButton} transition-all duration-300 group relative overflow-hidden shadow-sm hover:shadow-md cursor-pointer active:scale-95 disabled:opacity-50 font-bold`}
                        >
                          <span className="text-[10px] opacity-70 block mb-1">Monto Fijo</span>
                          <span className="text-xl font-black">{val} BS</span>
                        </button>
                      ))}
                    </div>

                    {/* Monto Personalizado */}
                    <div className="mt-8 pt-6 border-t border-gray-200/50 dark:border-white/5 max-w-lg mx-auto">
                      <label className={`block text-xs font-bold mb-2 uppercase tracking-wider ${textSubtitle}`}>Monto personalizado (BS)</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-bold text-sm">
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
                          className="px-6 bg-black hover:bg-gray-800 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer flex items-center justify-center text-sm uppercase tracking-wider"
                        >
                          Generar
                        </button>
                      </div>
                    </div>

                    {loadingQR && (
                      <div className="mt-8 flex justify-center animate-pulse">
                        <div className="flex items-center gap-3 bg-[#38bdf8]/10 border border-[#38bdf8]/20 px-5 py-3 rounded-2xl text-[#38bdf8] text-xs font-semibold">
                          <Loader2 className="animate-spin h-4 w-4" />
                          <span>Generando cupón de seguridad...</span>
                        </div>
                      </div>
                    )}

                    {qrCodeData && !loadingQR && (
                      <div className="mt-8 p-6 bg-white rounded-2xl max-w-xs mx-auto shadow-xl border border-gray-100 flex flex-col items-center animate-in zoom-in-95 duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-black" />
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
                  <div className="max-w-lg mx-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
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
                            className={`px-5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200' : 'bg-[#121c40]/60 hover:bg-[#1d2d66] text-gray-200 border-white/5'} active:scale-95`}
                          >
                            Buscar
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${textSubtitle}`}>Monto a Recargar (BS)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400 font-bold text-sm">BS</span>
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
                            className={`w-full px-4 py-3 rounded-xl outline-none tracking-[0.6em] text-center font-bold text-base transition-all placeholder:tracking-normal placeholder:font-normal ${theme === 'light' ? 'bg-red-50/50 border border-red-200/50 text-red-950 focus:border-red-500 focus:ring-red-500' : 'bg-red-950/20 border border-red-500/20 text-white focus:border-red-500 focus:ring-red-500'}`}
                            placeholder="••••"
                            required
                          />
                        </div>
                      </div>

                      {manualMessage.text && (
                        <div className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-3 animate-in fade-in duration-200 ${
                          manualMessage.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                          manualMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                          'bg-blue-500/10 border-blue-500/20 text-blue-500'
                        }`}>
                          {manualMessage.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle size={16} className="shrink-0" />}
                          <span>{manualMessage.text}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={manualLoading || !clientName}
                        className="w-full py-3.5 bg-black hover:bg-gray-800 text-white rounded-xl font-bold text-sm tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all flex justify-center items-center gap-2 shadow-md active:scale-95 disabled:scale-100"
                      >
                        {manualLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Confirmar y Procesar'}
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>

            {/* Columna Derecha: Actividad de Turno */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              <div className={`${bgCard} rounded-3xl p-6 min-h-[460px] flex flex-col transition-colors duration-300`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-base font-extrabold ${textTitle}`}>Actividad de Turno</h2>
                    <p className={`text-[11px] ${textSubtitle} mt-0.5`}>Últimas 5 operaciones realizadas</p>
                  </div>
                  <button 
                    onClick={() => fetchRecentTransactions(auth.currentUser)} 
                    disabled={loadingHistory}
                    className={`p-2 rounded-xl border ${theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-500 hover:text-black' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'} cursor-pointer active:scale-95 transition-all disabled:opacity-50`}
                  >
                    <TrendingUp size={16} className={loadingHistory ? 'animate-spin text-[#38bdf8]' : ''} />
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-[#38bdf8] h-7 w-7" />
                    <span className="text-xs text-gray-400">Actualizando historial...</span>
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <div className={`flex-1 flex flex-col items-center justify-center gap-4 text-center p-6 border border-dashed rounded-2xl bg-white/[0.01] ${theme === 'light' ? 'border-gray-200' : 'border-white/5'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-gray-400 ${theme === 'light' ? 'bg-gray-100' : 'bg-[#121c40]/60'}`}>
                      <User size={20} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${textTitle}`}>Sin operaciones todavía</h3>
                      <p className={`text-xs ${textSubtitle} max-w-[200px] mt-1 mx-auto`}>Tus transacciones de recarga aparecerán aquí de forma inmediata.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3.5 animate-in fade-in duration-300">
                    {recentTransactions.map((tx) => (
                      <div 
                        key={tx.id}
                        className={`p-4 rounded-2xl ${bgTxItem} flex items-center justify-between transition-all duration-300 group`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {tx.type === 'qr' ? (
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              tx.status === 'disponible' 
                                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' 
                                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
                            }`}>
                              <QrCode size={16} />
                            </div>
                          ) : (
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-gray-100 border border-gray-200 text-gray-800' : 'bg-[#0284c7]/10 border border-[#0284c7]/20 text-[#38bdf8]'}`}>
                              <ArrowUpRight size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate pr-2 ${textTitle}`}>
                              {tx.title}
                            </p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {tx.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {tx.date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] font-bold text-gray-400 block uppercase">
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
                
                <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-white/5 text-center">
                  <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase">Auditoría TapPay Activa</span>
                </div>

              </div>

            </div>

          </div>

        </main>
      </div>

    </div>
  );
}
