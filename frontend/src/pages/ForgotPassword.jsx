import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await api.post("/auth/forgot-password", { email: email.trim() });
      setMessage(response.data?.message || "If an account uses that email, reset instructions will be sent.");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to request a password reset right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card-top">
          <Link to="/" className="logo auth-logo">Nyumba<span>Direct</span></Link>
          <span className="auth-badge">Account help</span>
        </div>
        <div className="auth-intro">
          <h1>Reset your password</h1>
          <p>Enter the email address on your account and we’ll send a reset link if it matches.</p>
        </div>
        {error && <div className="error-message" role="alert">{error}</div>}
        {message && <div className="success-message" role="status">{message}</div>}
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <Link className="auth-back" to="/login">← Back to login</Link>
      </section>
    </main>
  );
}
