import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Logo } from '../components/UI';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { STATES_LIST, getDistrictsForState } from '../data/locations';

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
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const districtOptions = getDistrictsForState(selectedState);

  const handleStateChange = (event) => {
    setSelectedState(event.target.value);
    setSelectedDistrict('');
    setFormError('');
  };

  const register = async (event) => {
    event.preventDefault();
    setFormError('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const rawMobile = String(formData.get('mobile') || '').trim();
    const cleanMobile = rawMobile.replace(/\D/g, '');
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const village = String(formData.get('village') || '').trim();
    const language = formData.get('language') || 'English';

    if (name.length < 2) {
      setFormError('Please enter your full name (minimum 2 characters).');
      return;
    }
    if (cleanMobile.length !== 10) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (selectedState && !selectedDistrict) {
      setFormError('Please select a district corresponding to your state.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        mobile: cleanMobile,
        email: email || undefined,
        password,
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        village: village || undefined,
        preferredLanguage: language === 'हिंदी' ? 'hi' : 'en',
      };
      await api.registerFarmer(payload);
      notify('Account created successfully. You can sign in now.');
      navigate('/login?role=farmer');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to create account. Please check your information.';
      setFormError(message);
      notify(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return <main className="auth-page register-page">
    <div className="auth-top"><Logo /><Link to="/login"><ArrowLeft size={16} /> Back to sign in</Link></div>
    <section className="register-card">
      <div className="auth-card-heading">
        <span className="icon-box green"><UserRound /></span>
        <div>
          <h1>Create your farmer account</h1>
          <p>Keep your procurement details ready with a simple profile.</p>
        </div>
      </div>

      {formError && (
        <div className="slot-alert-error" role="alert" style={{ marginBottom: 16 }}>
          {formError}
        </div>
      )}

      <form className="form-grid" onSubmit={register}>
        <label className="full">
          Full name *
          <input
            name="name"
            required
            placeholder="e.g. Ramesh Kumar"
            autoComplete="name"
          />
        </label>

        <label>
          Mobile number *
          <input
            name="mobile"
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength="10"
            placeholder="10-digit mobile number"
            required
            autoComplete="tel"
          />
        </label>

        <label>
          Email (optional)
          <input
            name="email"
            type="email"
            placeholder="farmer@example.com"
            autoComplete="email"
          />
        </label>

        <label className="full">
          Password *
          <div className="password-field">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              minLength="8"
              required
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <label>
          State *
          <select
            name="state"
            value={selectedState}
            onChange={handleStateChange}
            required
          >
            <option value="" disabled>Select state</option>
            {STATES_LIST.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </label>

        <label>
          District *
          <select
            name="district"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!selectedState}
            required
          >
            <option value="" disabled>
              {selectedState ? 'Select district' : 'Select state first'}
            </option>
            {districtOptions.map((dist) => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>
        </label>

        <label>
          Village / Town
          <input
            name="village"
            placeholder="Enter village or locality"
            autoComplete="address-level3"
          />
        </label>

        <label>
          Preferred language
          <select name="language" defaultValue="English">
            <option value="English">English</option>
            <option value="हिंदी">हिंदी</option>
          </select>
        </label>

        <div className="full form-consent">
          <ShieldCheck size={18} /> Your farmer account is active immediately after registration.
        </div>

        <Button type="submit" className="wide" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </section>
  </main>;
}

