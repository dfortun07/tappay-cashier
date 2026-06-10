'use client';

import { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (typeof window !== 'undefined') {
        localStorage.setItem('tappay_logged_in', 'true');
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError('Credenciales incorrectas o error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-animated-gradient p-4 md:p-6 selection:bg-[#38bdf8]/30 font-sans relative overflow-hidden">

      {/* Floating Orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="w-full max-w-5xl glass-card rounded-3xl flex flex-col md:flex-row overflow-hidden min-h-[580px] md:min-h-[640px] relative z-10 animate-slide-up">

        {/* Columna Izquierda: Panel de Ilustración */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#0284c7]/10 to-transparent">
          {/* Esfera de fondo suave */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#38bdf8]/10 rounded-full blur-3xl" />

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#0369a1] flex items-center justify-center font-bold text-white shadow-lg glow-blue">
              <span className="text-lg font-black">T</span>
            </div>
            <span className="font-extrabold text-lg tracking-wider text-white">TapPay</span>
          </div>

          <div className="my-8 md:my-auto flex flex-col items-center relative z-10">
            {/* Imagen del Mascota */}
            <div className="w-56 h-56 md:w-64 md:h-64 relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-6 backdrop-blur-sm">
              <img
                src="/payment_mascot.png"
                alt="TapPay Mascot"
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-2xl font-black text-white text-center leading-tight">
              Gestiona Recargas Fáciles
            </h2>
            <p className="text-gray-400 text-xs text-center mt-2 max-w-xs">
              Genera cupones QR y efectúa transacciones directas para tus clientes de forma segura.
            </p>
          </div>

          <div className="hidden md:flex justify-between items-center text-gray-500 text-[10px] font-mono tracking-wider relative z-10">
            <span>EXPLORE. LEARN. GROW.</span>
            <span>PORTAL CAJERO V2.0</span>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Login */}
        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center relative">
          <div className="absolute top-0 right-0 w-60 h-60 bg-[#0284c7]/5 rounded-full blur-3xl" />

          <div className="max-w-md mx-auto w-full relative z-10">
            <div className="mb-8">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">
                ¡Bienvenido de nuevo!
              </h2>
              <p className="text-gray-400 text-sm">
                Ingresa tus credenciales para acceder a tu panel de cajero.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Correo Electrónico</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-500 group-focus-within:text-[#38bdf8] transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8]/50 focus:ring-1 focus:ring-[#38bdf8]/30 transition-all text-sm font-medium"
                    placeholder="cajero@tappay.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Contraseña</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-500 group-focus-within:text-[#38bdf8] transition-colors" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#38bdf8]/50 focus:ring-1 focus:ring-[#38bdf8]/30 transition-all text-sm font-medium"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <label className="flex items-center gap-2 cursor-pointer select-none hover:text-gray-300 transition-colors">
                  <input type="checkbox" className="rounded border-gray-600 bg-white/5 text-[#0284c7] focus:ring-[#0284c7]/30" />
                  <span>Recordar sesión</span>
                </label>
                <a href="#" className="hover:text-[#38bdf8] font-semibold transition-colors">¿Olvidaste tu contraseña?</a>
              </div>

              {error && (
                <div className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 py-3.5 px-4 rounded-xl flex items-center gap-3 animate-slide-up">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#0284c7] border border-white/10 rounded-xl shadow-lg shadow-[#0284c7]/20 text-sm font-bold text-white uppercase tracking-wider cursor-pointer btn-press disabled:opacity-50 disabled:scale-100 transition-all duration-300"
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                  <>
                    Ingresar al Panel
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
              <span className="text-[10px] text-gray-500 font-mono tracking-wider">TAPPAY SECURE LOGIN • v2.0</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
