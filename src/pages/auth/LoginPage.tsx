import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Layers, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid credentials';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Demo login is unavailable';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-ink-950 mesh-bg flex'>
      {/* Left brand panel */}
      <div className='hidden lg:flex w-1/2 flex-col justify-between p-12 border-r border-ink-800/40'>
        <div className='flex items-center gap-3'>
          <div className='w-9 h-9 rounded-xl bg-ember-500 flex items-center justify-center'>
            <Layers size={18} className='text-white' />
          </div>
          <span className='font-display font-bold text-white text-xl'>
            TalentBridge
          </span>
        </div>

        <div className='space-y-6'>
          <div>
            <p className='text-ink-400 text-sm uppercase tracking-widest font-semibold mb-4'>
              Platform Features
            </p>
            {[
              {
                t: 'AI-Powered Matching',
                d: 'GPT-4o intelligently evaluates student teams against industry projects',
              },
              {
                t: 'GitHub Integration',
                d: 'Automatic repository analysis and contribution scoring',
              },
              {
                t: 'Ranked Applications',
                d: 'Students apply with priority preferences, coordinators optimise assignments',
              },
              {
                t: 'Real-time Evaluation',
                d: 'AI scores code quality, functionality, and team collaboration',
              },
            ].map((f) => (
              <div key={f.t} className='flex gap-3 mb-4'>
                <div className='w-1.5 h-1.5 rounded-full bg-ember-500 mt-2 flex-shrink-0' />
                <div>
                  <p className='text-sm font-semibold text-ink-100'>{f.t}</p>
                  <p className='text-xs text-ink-400 mt-0.5'>{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className='text-ink-600 text-xs'>
          © {new Date().getFullYear()} TalentBridge. All rights reserved.
        </p>
      </div>

      {/* Right login panel */}
      <div className='flex-1 flex items-center justify-center p-8'>
        <div className='w-full max-w-md'>
          <div className='lg:hidden flex items-center gap-3 mb-10'>
            <div className='w-9 h-9 rounded-xl bg-ember-500 flex items-center justify-center'>
              <Layers size={18} className='text-white' />
            </div>
            <span className='font-display font-bold text-white text-xl'>
              TalentBridge
            </span>
          </div>

          <h1 className='font-display text-3xl font-bold text-white mb-2'>
            Welcome back
          </h1>
          <p className='text-ink-400 text-sm mb-8'>
            Sign in to your account to continue
          </p>

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label className='input-label'>Email address</label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className='input'
                placeholder='you@example.com'
                autoComplete='email'
                required
              />
            </div>
            <div>
              <label className='input-label'>Password</label>
              <div className='relative'>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='input pr-11'
                  placeholder='••••••••'
                  autoComplete='current-password'
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowPw((v) => !v)}
                  className='absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200'
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type='submit'
              disabled={loading}
              className='btn-primary w-full mt-2'
            >
              {loading ? (
                <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className='text-center text-sm text-ink-400 mt-6'>
            Don't have an account?{' '}
            <Link
              to='/register'
              className='text-ember-400 hover:text-ember-300 font-medium'
            >
              Create one
            </Link>
          </p>

          {/* Demo credentials */}
          <div className='mt-8 p-4 rounded-2xl bg-ink-900 border border-ink-700/50'>
            <p className='text-xs text-ink-400 font-semibold uppercase tracking-wider mb-3'>
              Demo credentials
            </p>
            <div className='space-y-2'>
              <button
                type='button'
                onClick={handleDemoLogin}
                disabled={loading}
                className='w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-ink-800 transition-colors text-left disabled:opacity-50'
              >
                <span className='text-xs text-ink-300 font-medium'>
                  Coordinator
                </span>
                <span className='text-xs text-ink-500 font-mono'>
                  coordinator@talentbridge.com
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
