import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("HOUSE_HUNTER");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

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
    setSuccess("");
    setLoading(true);

    try {
      await api.post("/auth/register", {
        full_name: cleanFullName,
        email: cleanEmail,
        phone_number: cleanPhone,
        password,
        role,
      });

      setSuccess("Account created successfully. A verification email has been sent. Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1400);
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
          <p>Join NyumbaDirect using your Gmail account.</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
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

          <div className="form-grid">
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                placeholder="you@gmail.com"
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