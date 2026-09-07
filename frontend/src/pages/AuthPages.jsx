import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Logo } from '../components/UI';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const rolePath = { farmer: '/farmer/dashboard', staff: '/staff/dashboard', admin: '/admin/dashboard' };

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify, setUser } = useApp();
  const initialRole = ['farmer', 'staff', 'admin'].includes(params.get('role')) ? params.get('role') : 'farmer';
  const [role, setRole] = useState(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.loginUser({ identifier, password });
      setUser(result.user);
      notify('Signed in successfully.');
      navigate(rolePath[result.user.role] || rolePath[role]);
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to sign in.', 'error');
    } finally { setLoading(false); }
  };

  return <main className="auth-page">
    <div className="auth-top"><Logo /><Link to="/"><ArrowLeft size={16} /> Back to home</Link></div>
    <div className="auth-layout">
      <section className="auth-intro">
        <span className="eyebrow">SECURE PORTAL ACCESS</span>
        <h1>Welcome to<br />Krishi Nova.</h1>
        <p>One connected service for a clearer, more farmer-friendly procurement journey.</p>
        <div className="auth-points">
          <span><ShieldCheck /> Transparent information at every stage</span>
          <span><CheckCircle2 /> Smart slot recommendations</span>
          <span><LockKeyhole /> Secure role-based access</span>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-card-heading"><span className="icon-box green"><Phone /></span><div><h2>Sign in</h2><p>Use your login ID, email, or mobile number to continue.</p></div></div>
        <div className="role-switch" role="group" aria-label="Select portal role">{['farmer', 'staff', 'admin'].map((item) => <button type="button" className={role === item ? 'active' : ''} aria-pressed={role === item} onClick={() => setRole(item)} key={item}>{item}</button>)}</div>
        <form onSubmit={login}>
          <label htmlFor="login-identifier">Login ID, email, or mobile<input id="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Enter login ID, email, or mobile number" autoFocus required /></label>
          <label htmlFor="login-password">Password<div className="password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          <Button type="submit" className="wide" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="auth-footer">New farmer? <Link to="/register">Create your account</Link></p>
      </section>
    </div>
  </main>;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { notify } = useApp();
  const [loading, setLoading] = useState(false);
  const register = async (event) => {
    event.preventDefault();
    setLoading(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.registerFarmer({ ...data, preferredLanguage: data.language === 'हिंदी' ? 'hi' : 'en' });
      notify('Account created. You can sign in now.');
      navigate('/login');
    } catch (error) {
      notify(error.response?.data?.message || 'Unable to create account.', 'error');
    } finally { setLoading(false); }
  };
  return <main className="auth-page register-page"><div className="auth-top"><Logo /><Link to="/login"><ArrowLeft size={16} /> Back to sign in</Link></div><section className="register-card"><div className="auth-card-heading"><span className="icon-box green"><UserRound /></span><div><h1>Create your farmer account</h1><p>Keep your procurement details ready with a simple profile.</p></div></div><form className="form-grid" onSubmit={register}><label className="full">Full name<input name="name" required /></label><label>Mobile number<input name="mobile" inputMode="numeric" maxLength="10" placeholder="10-digit number" required /></label><label>Email<input name="email" type="email" placeholder="you@example.com" /></label><label className="full">Password<input name="password" type="password" minLength="8" required /></label><label>State<select name="state" defaultValue=""><option value="" disabled>Select state</option><option>Uttar Pradesh</option><option>Punjab</option><option>Haryana</option></select></label><label>District<select name="district" defaultValue=""><option value="" disabled>Select district</option><option>Meerut</option><option>Hapur</option><option>Ghaziabad</option></select></label><label>Village<input name="village" required /></label><label>Preferred language<select name="language" defaultValue="English"><option>English</option><option>हिंदी</option></select></label><div className="full form-consent"><ShieldCheck size={18} /> Your farmer account is active immediately after registration.</div><Button type="submit" className="wide" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button></form></section></main>;
}
