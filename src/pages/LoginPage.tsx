import React, { useRef, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { ApiService } from '../services/api';
import { EightbitLogo } from '../components/ui/Logo';

interface LoginPageProps {
  setupRequired: boolean;
  onSetupTaken: () => void;
  onLoginSuccess: (userEmail: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess,setupRequired,onSetupTaken }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,setConfirm]=useState('');const locked=useRef(false);
  const [loading, setLoading] = useState(false);
  const { showError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();if(locked.current)return;
    if(!email.trim()||!password){showError('Sign In Failed','Enter your username and password.');return;}
    if(setupRequired && (!/^[a-z0-9][a-z0-9_.-]{2,63}$/i.test(email.trim()) || new TextEncoder().encode(password).length<12 || new TextEncoder().encode(password).length>72 || password!==confirm)){showError('Check Your Details','Use a valid username and a matching password of 12–72 bytes.');return;}
    locked.current=true;setLoading(true);
    try{if(setupRequired)await ApiService.signup(email.trim(),password);else await ApiService.login(email.trim(),password);setPassword('');onLoginSuccess(email);}
    catch(e){showError(setupRequired?'Setup Failed':'Sign In Failed',e instanceof Error?e.message:'Please retry.');if(setupRequired && e instanceof Error && 'status' in e && e.status===409)onSetupTaken();}
    finally{locked.current=false;setLoading(false);}
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <EightbitLogo size="lg" />
          <p className="text-xs font-medium text-zinc-500 mt-3">
            WhatsApp Outreach Platform
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-2xl p-6 shadow-card border border-zinc-200">
          <h2 className="text-base font-bold text-zinc-900 mb-1">{setupRequired?'Create Admin Account':'Sign in'}</h2>
          <p className="text-xs text-zinc-500 mb-5">{setupRequired?'Choose your username and password. This signup appears only once.':'Enter your username and password.'}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Username
              </label>
              <input
                autoComplete="username"
                type="text"
                aria-label="Username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-[#FF5533] focus:bg-white transition-all text-zinc-900 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Password
              </label>
              <input
                autoComplete={setupRequired?'new-password':'current-password'}
                aria-label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-[#FF5533] focus:bg-white transition-all text-zinc-900 font-medium"
                required
              />
            </div>

            {setupRequired && <div><label className="block text-xs font-semibold text-zinc-700 mb-1" htmlFor="confirm-password">Confirm Password</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:border-[#FF5533]"/><p className="text-xs text-zinc-500 mt-2">Use at least 12 characters. Your password is stored securely.</p></div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-[#FF5533] hover:bg-[#E64422] text-white font-bold rounded-lg text-xs shadow-xs transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{setupRequired?'Create Admin Account':'Sign In'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" /> n8n Backend API
            </span>
            <span>Secure operator session</span>
          </div>
        </div>

        <p className="text-center text-[11px] text-zinc-400 mt-6">
          © {new Date().getFullYear()} Eightbit Solutions
        </p>
      </div>
    </div>
  );
};
