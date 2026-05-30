import { useState, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authSlice';
import { authApi } from '../services/api';
import type { RootState, AppDispatch } from '../store';
import { useToast } from '../services/toast';

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((s: RootState) => s.auth);
  const toast = useToast();
  const [tel, setTel] = useState('');
  const [pwd, setPwd] = useState('');
  const [showActivation, setShowActivation] = useState(false);
  const [actCode, setActCode] = useState('');
  const [actLoading, setActLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotTel, setForgotTel] = useState('');
  const [forgotPwd, setForgotPwd] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const isExpired = error?.includes('Abonnement expiré');

  const handleLogin = (e: FormEvent) => { e.preventDefault(); if (tel && pwd) dispatch(login({ telephone: tel, mot_de_passe: pwd })); };

  const handleActivate = async () => {
    if (!actCode) return;
    setActLoading(true);
    try {
      await authApi.activerCode({ telephone: tel, code: actCode });
      setShowActivation(false); setActCode(''); dispatch(clearError());
      toast.success('Abonnement activé ! Vous pouvez vous connecter.');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Code invalide'); }
    finally { setActLoading(false); }
  };

  const handleForgot = async () => {
    if (!forgotTel || !forgotPwd) return;
    setForgotLoading(true);
    try {
      await authApi.forgotPassword({ telephone: forgotTel, newPassword: forgotPwd });
      setShowForgot(false); setForgotTel(''); setForgotPwd('');
      toast.success('Mot de passe réinitialisé. Vous pouvez vous connecter.');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Échec'); }
    finally { setForgotLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0500 0%, #1a0a00 40%, #0d0400 100%)' }}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #E86B2A, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #F59E0B, transparent)' }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slideUp">
        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4" style={{ background: 'linear-gradient(135deg, #E86B2A, #F59E0B)', boxShadow: '0 0 60px rgba(232,107,42,0.3)' }}>
            <span className="text-5xl">🍽️</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">RestoPro</h1>
          <p className="text-orange-200/50 text-base mt-2">Gestion Restaurant Intelligente</p>
        </div>

        {/* Form */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
          <h2 className="text-xl font-bold text-gray-800 mb-6">🔐 Connexion</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-start gap-3 animate-fadeIn">
              <span className="text-red-500 text-lg">⚠️</span>
              <p className="text-red-700 text-sm flex-1">{error}</p>
              <button onClick={() => dispatch(clearError())} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Téléphone</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">📱</span>
                <input type="tel" value={tel} onChange={e => setTel(e.target.value)}
                  placeholder="+225 00 00 00 00 00"
                  className="w-full pl-12 pr-4 h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Mot de passe</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                <input type={showPwd ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-lg cursor-pointer">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg shadow-orange-200 disabled:opacity-60 cursor-pointer">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Connexion...
                </span>
              ) : 'Se Connecter'}
            </button>
          </form>

          <div className="flex items-center justify-between mt-5">
            <button onClick={() => setShowForgot(true)} className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors cursor-pointer">
              Mot de passe oublié ?
            </button>
            {isExpired && (
              <button onClick={() => setShowActivation(true)} className="text-sm font-bold bg-orange-500 text-white px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors cursor-pointer">
                Activer
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-orange-200/30 text-xs mt-4">Application sécurisée · Tous droits réservés</p>
      </div>

      {/* Activation Modal */}
      {showActivation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowActivation(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">🔑 Activation</h3>
            <p className="text-sm text-gray-500 mb-4">Votre abonnement a expiré. Entrez un code d'activation.</p>
            <input
              type="text" value={actCode} onChange={e => setActCode(e.target.value.toUpperCase())}
              placeholder="RESTO-XXXX-XXXX-XXXX"
              className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 mb-4 font-mono text-sm"
            />
            <button onClick={handleActivate} disabled={actLoading}
              className="w-full h-11 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-60 cursor-pointer transition-colors">
              {actLoading ? 'Activation...' : 'Activer l\'abonnement'}
            </button>
            <button onClick={() => { setShowActivation(false); setActCode(''); }} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 cursor-pointer py-2">Annuler</button>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForgot(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-slideUp" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Réinitialiser</h3>
            <p className="text-sm text-gray-500 mb-4">Entrez votre numéro et un nouveau mot de passe.</p>
            <input type="tel" value={forgotTel} onChange={e => setForgotTel(e.target.value)} placeholder="Téléphone" className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-gray-800 mb-3 focus:outline-none focus:border-orange-400" />
            <input type="text" value={forgotPwd} onChange={e => setForgotPwd(e.target.value)} placeholder="Nouveau mot de passe" className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-gray-800 mb-4 focus:outline-none focus:border-orange-400" />
            <button onClick={handleForgot} disabled={forgotLoading} className="w-full h-11 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 disabled:opacity-60 cursor-pointer transition-colors">
              {forgotLoading ? 'Réinitialisation...' : 'Réinitialiser'}
            </button>
            <button onClick={() => { setShowForgot(false); setForgotTel(''); setForgotPwd(''); }} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 cursor-pointer py-2">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
