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
  const { notify } = useApp();
  const initialRole = ['farmer', 'staff', 'admin'].includes(params.get('role')) ? params.get('role') : 'farmer';
  const [role, setRole] = useState(initialRole);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('credentials');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const continueToOtp = (event) => {
    event.preventDefault();
    if (!/^\d{10}$/.test(mobile)) return notify('Enter a valid 10-digit mobile number.', 'error');
    if (!password.trim()) return notify('Enter your password.', 'error');
    setStep('otp');
    notify('Demo OTP ready. Use 123456 to continue.');
  };

  const login = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp) || otp !== '123456') return notify('Use prototype OTP: 123456', 'error');
    setLoading(true);
    try {
      await api.loginUser({ mobile, password, role });
      notify('Signed in to the demo portal.');
      navigate(rolePath[role]);
    } finally {
      setLoading(false);
    }
  };

  const maskedMobile = `+91 ******${mobile.slice(-4)}`;

  return <main className="auth-page">
    <div className="auth-top"><Logo /><Link to="/"><ArrowLeft size={16} /> Back to home</Link></div>
    <div className="auth-layout">
      <section className="auth-intro">
        <span className="eyebrow">SECURE PROTOTYPE ACCESS</span>
        <h1>Welcome to<br />Krishi Nova.</h1>
        <p>One connected service for a clearer, more farmer-friendly procurement journey.</p>
        <div className="auth-points">
          <span><ShieldCheck /> Transparent information at every stage</span>
          <span><CheckCircle2 /> Smart slot recommendations</span>
          <span><LockKeyhole /> Secure role-based access</span>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-card-heading"><span className="icon-box green"><Phone /></span><div><h2>{step === 'otp' ? 'Verify your mobile number' : 'Sign in'}</h2><p>{step === 'otp' ? 'We sent a 6-digit verification code to your mobile number.' : 'Use your registered mobile number to continue.'}</p></div></div>
        <div className="role-switch" role="group" aria-label="Select portal role">{['farmer', 'staff', 'admin'].map((item) => <button type="button" className={role === item ? 'active' : ''} aria-pressed={role === item} onClick={() => setRole(item)} key={item}>{item}</button>)}</div>
        {step === 'credentials' ? <form onSubmit={continueToOtp}>
          <label htmlFor="login-mobile">Mobile number<input id="login-mobile" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" maxLength="10" placeholder="Enter 10-digit mobile number" autoFocus required /></label>
          <label htmlFor="login-password">Password<div className="password-field"><input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          <Button type="submit" className="wide">Continue</Button>
        </form> : <form onSubmit={login}>
          <p className="masked-mobile">Code for <strong>{maskedMobile}</strong></p>
          <label htmlFor="login-otp">6-digit verification code<input id="login-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength="6" placeholder="Enter 6-digit OTP" autoFocus required /></label>
          <p className="otp-note"><b>Prototype OTP: 123456</b><br />No real OTP is sent in this demo.</p>
          <Button type="submit" className="wide" disabled={loading}>{loading ? 'Signing in…' : 'Verify & Sign In'}</Button>
          <div className="otp-actions"><button type="button" className="back-link" onClick={() => { setOtp(''); setStep('credentials'); }}><ArrowLeft size={16} /> Change mobile number</button><button type="button" className="text-button" onClick={() => notify('Demo OTP is 123456. No real SMS was sent.')}>Didn't receive the code? Resend OTP</button></div>
        </form>}
        {step === 'credentials' && <p className="auth-footer">New farmer? <Link to="/register">Create your account</Link></p>}
      </section>
    </div>
  </main>;
}

export function RegisterPage() {
  const navigate = useNavigate(); const { notify } = useApp(); const [loading, setLoading] = useState(false);
  const register = async (event) => { event.preventDefault(); setLoading(true); const data = Object.fromEntries(new FormData(event.currentTarget)); await api.registerFarmer(data); notify('Registration saved for this prototype.'); navigate('/farmer/dashboard'); };
  return <main className="auth-page register-page"><div className="auth-top"><Logo /><Link to="/login"><ArrowLeft size={16} /> Back to sign in</Link></div><section className="register-card"><div className="auth-card-heading"><span className="icon-box green"><UserRound /></span><div><h1>Create your farmer account</h1><p>Keep your procurement details ready with a simple profile.</p></div></div><form className="form-grid" onSubmit={register}><label className="full">Full name<input name="name" placeholder="e.g. Ramesh Kumar" required /></label><label>Mobile number<input name="mobile" inputMode="numeric" maxLength="10" placeholder="10-digit number" required /></label><label>Farmer ID<input name="farmerId" placeholder="e.g. KNF-8421" required /></label><label>State<select name="state" defaultValue=""><option value="" disabled>Select state</option><option>Uttar Pradesh</option><option>Punjab</option><option>Haryana</option></select></label><label>District<select name="district" defaultValue=""><option value="" disabled>Select district</option><option>Meerut</option><option>Hapur</option><option>Ghaziabad</option></select></label><label>Village<input name="village" placeholder="Your village name" required /></label><label>Preferred language<select name="language" defaultValue="English"><option>English</option><option>हिंदी</option></select></label><div className="full form-consent"><ShieldCheck size={18} /> This prototype collects no real identity information. Do not enter Aadhaar or banking details.</div><Button type="submit" className="wide" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button></form></section></main>;
}
