import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import GoogleSignInButton from "../components/GoogleSignInButton";

function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("HOUSE_HUNTER");
  const [verificationMethod, setVerificationMethod] = useState("EMAIL");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();

  const handleGoogleCredential = async (credential) => {
    if (!/^\+?[0-9\s()-]{9,}$/.test(phoneNumber.trim())) {
      setError("Enter your Kenyan phone number before continuing with Google.");
      return;
    }
    if (!termsAccepted) {
      setError("Please accept the terms to continue.");
      return;
    }
    setError("");
    setGoogleLoading(true);
    try {
      const response = await api.post("/auth/google", {
        credential,
        phone_number: phoneNumber.trim(),
        role,
      });
      const accessToken = response.data?.access_token;
      if (!accessToken) throw new Error("No access token was returned by the server.");
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("nyumbadirect_remember_login", "true");
      const profile = await api.get("/auth/me");
      if (profile.data?.id) localStorage.setItem("user_id", String(profile.data.id));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Google sign-up failed. Please try again.");
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.trim();

    if (!cleanFullName || cleanFullName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!/^\+?[0-9\s-]{9,}$/.test(cleanPhone)) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!termsAccepted) {
      setError("Please accept the terms to continue.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/register", {
        full_name: cleanFullName,
        email: cleanEmail,
        phone_number: cleanPhone,
        password,
        role,
      }, { params: { verification_method: verificationMethod } });
      navigate("/verify-account", { state: {
        email: cleanEmail,
        method: verificationMethod,
        deliveryPending: !response.data?.verification_sent,
      } });
    } catch (err) {
      console.error(err);

      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Unable to create your account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-card-top">
          <Link to="/" className="logo auth-logo">
            Nyumba<span>Direct</span>
          </Link>

          <span className="auth-badge">
            Kenya Homes
          </span>
        </div>

        <div className="auth-intro">
          <h1>Create your account</h1>
          <p>Create an account to find or list a home.</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleRegister}>
          <div className="form-grid">
            <div className="auth-field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={fullName}
                placeholder="Your full name"
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="role">Account type</label>
              <select id="role" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="HOUSE_HUNTER">House Hunter</option>
                <option value="LANDLORD">Landlord</option>
                <option value="PROPERTY_MANAGER">Property Manager</option>
              </select>
            </div>
          </div>

          <div className="auth-field">
            <label>Send my verification code by</label>
            <div className="auth-options">
              <label className="check-row">
                <input type="radio" name="verificationMethod" value="EMAIL" checked={verificationMethod === "EMAIL"} onChange={() => setVerificationMethod("EMAIL")} />
                <span>Email</span>
              </label>
              <label className="check-row">
                <input type="radio" name="verificationMethod" value="SMS" checked={verificationMethod === "SMS"} onChange={() => setVerificationMethod("SMS")} />
                <span>SMS to my phone</span>
              </label>
            </div>
            <small className="auth-hint">Kenyan mobile numbers only for SMS verification.</small>
          </div>

          <div className="form-grid">
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="phoneNumber">Phone number</label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={phoneNumber}
                placeholder="07XXXXXXXX"
                onChange={(event) => setPhoneNumber(event.target.value)}
                autoComplete="tel"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              placeholder="Create a password"
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <small className="auth-hint">Use at least 8 characters.</small>
          </div>

          <div className="auth-options">
            <label className="check-row">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>I agree to the terms of service and privacy policy.</span>
            </label>
          </div>

          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-divider"><span>or verify with Google</span></div>
        <GoogleSignInButton onCredential={handleGoogleCredential} text="signup_with" />
        {googleLoading && <p className="auth-hint" role="status">Creating your account…</p>}
        <p className="auth-hint">Google confirms your email. Enter your phone number above and accept the terms to continue.</p>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>

        <Link className="auth-back" to="/">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default Register;
