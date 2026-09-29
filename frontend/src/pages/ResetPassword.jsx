import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(token ? "" : "This password reset link is missing its token.");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", { token, password });
      setMessage(response.data?.message || "Password updated. You can sign in now.");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to reset your password. Request a new link and try again.");
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
          <h1>Choose a new password</h1>
          <p>Use at least 8 characters.</p>
        </div>
        {error && <div className="error-message" role="alert">{error}</div>}
        {message && <div className="success-message" role="status">{message}</div>}
        {!message && (
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </div>
            <button className="auth-button" type="submit" disabled={loading || !token}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
        <Link className="auth-back" to="/login">← Back to login</Link>
      </section>
    </main>
  );
}
