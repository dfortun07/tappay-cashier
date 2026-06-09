'use client';

import { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-0 md:p-6 selection:bg-[#38bdf8]/30 selection:text-[#0c142c] font-sans">
      <div className="w-full max-w-5xl bg-white rounded-none md:rounded-3xl shadow-xl border border-gray-100 flex flex-col md:flex-row overflow-hidden min-h-screen md:min-h-[640px]">
        
        {/* Columna Izquierda: Panel de Ilustración */}
        <div className="w-full md:w-1/2 bg-[#38bdf8]/10 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Esfera de fondo suave */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#38bdf8]/20 rounded-full blur-3xl -z-10" />
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center font-bold text-white shadow-lg relative overflow-hidden">
              <span className="text-lg font-black">T</span>
            </div>
            <span className="font-extrabold text-lg tracking-wider text-black">TapPay</span>
          </div>

          <div className="my-8 md:my-auto flex flex-col items-center">
            {/* Imagen del Mascota Generado */}
            <div className="w-64 h-64 md:w-72 md:h-72 relative rounded-2xl overflow-hidden shadow-lg border border-white/40 mb-6 bg-white/20 backdrop-blur-md">
              <img 
                src="/payment_mascot.png" 
                alt="TapPay Mascot" 
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-2xl font-black text-black text-center leading-tight">
              Gestiona Recargas Fáciles
            </h2>
            <p className="text-gray-600 text-xs text-center mt-2 max-w-xs">
              Genera cupones QR y efectúa transacciones directas para tus clientes de forma segura.
            </p>
          </div>

          <div className="hidden md:flex justify-between items-center text-gray-500 text-[10px] font-mono tracking-wider">
            <span>EXPLORE. LEARN. GROW.</span>
            <span>PORTAL CAJERO V2.0</span>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Login */}
        <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-8">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-1">
                ¡Bienvenido de nuevo!
              </h2>
              <p className="text-gray-500 text-sm">
                Ingresa tus credenciales para acceder a tu panel de cajero.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50/50 text-gray-950 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm"
                    placeholder="cajero@tappay.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50/50 text-gray-950 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-gray-300 text-black focus:ring-black" />
                  <span>Recordar sesión</span>
                </label>
                <a href="#" className="hover:text-black font-semibold">¿Olvidaste tu contraseña?</a>
              </div>

              {error && (
                <div className="text-red-600 text-xs font-semibold bg-red-50 border border-red-100 py-3.5 px-4 rounded-xl flex items-center gap-3 animate-in fade-in duration-200">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3.5 px-4 bg-black hover:bg-gray-800 border border-transparent rounded-xl shadow-md text-sm font-bold text-white uppercase tracking-wider cursor-pointer active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all duration-200"
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Ingresar al Panel'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
