import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";

function VerifyAccount() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || "");
  const [method, setMethod] = useState(location.state?.method || "EMAIL");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(location.state?.deliveryPending
    ? "Your account was created, but the code could not be delivered yet. Check your contact details or request a new code after delivery is configured."
    : "Enter the six-digit code we sent you.");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/verify-signup", { email: email.trim().toLowerCase(), code });
      navigate("/login", { state: { email: email.trim().toLowerCase(), verified: true } });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not verify this code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setResending(true);
    try {
      const response = await api.post("/auth/resend-verification", {
        email: email.trim().toLowerCase(), method,
      });
      setMessage(response.data?.message || "If the account needs verification, a new code will be sent.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not request another code. Please wait and try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-top"><Link to="/" className="logo auth-logo">Nyumba<span>Direct</span></Link><span className="auth-badge">Account security</span></div>
        <div className="auth-intro"><h1>Verify your account</h1><p>{message}</p></div>
        {error && <div className="error-message" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={verify}>
          <div className="auth-field">
            <label htmlFor="verifyEmail">Email address</label>
            <input id="verifyEmail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="auth-field">
            <label htmlFor="verifyMethod">Send code by</label>
            <select id="verifyMethod" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="EMAIL">Email</option><option value="SMS">SMS to signup phone</option>
            </select>
          </div>
          <div className="auth-field">
            <label htmlFor="verifyCode">6-digit verification code</label>
            <input id="verifyCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
          </div>
          <button className="auth-button" type="submit" disabled={loading || code.length !== 6}>{loading ? "Verifying…" : "Verify account"}</button>
        </form>
        <button className="auth-back" type="button" onClick={resend} disabled={resending || !email.trim()}>{resending ? "Requesting…" : "Resend verification code"}</button>
        <p className="auth-switch">Already verified? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}

export default VerifyAccount;
