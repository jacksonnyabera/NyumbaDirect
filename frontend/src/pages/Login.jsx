import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email: cleanEmail,
        password,
      });

      const accessToken = response.data?.access_token;

      if (!accessToken) {
        throw new Error("No access token was returned by the server.");
      }

      localStorage.setItem("access_token", accessToken);

      if (remember) {
        localStorage.setItem("nyumbadirect_remember_login", "true");
      } else {
        localStorage.removeItem("nyumbadirect_remember_login");
      }

      const meResponse = await api.get("/auth/me");

      if (meResponse.data?.id) {
        localStorage.setItem("user_id", String(meResponse.data.id));
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);

      if (error.response?.status === 422) {
        setError(
          error.response.data?.detail ||
          "The login information has an invalid format."
        );
      } else if (error.response?.status === 401) {
        setError(
          error.response.data?.detail ||
          "Invalid email or password."
        );
      } else if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else if (error.message) {
        setError(error.message);
      } else {
        setError("Unable to connect to the server. Please try again.");
      }

      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card-top">
          <Link to="/" className="logo auth-logo">
            Nyumba<span>Direct</span>
          </Link>

          <span className="auth-badge">
            Kenya Homes
          </span>
        </div>

        <div className="auth-intro">
          <h1>Welcome back</h1>
          <p>Login with your Gmail account.</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleLogin}>
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
            <div className="auth-row">
              <label htmlFor="password">Password</label>
              <Link to="/" className="auth-link-muted">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              placeholder="Your password"
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="auth-options">
            <label className="check-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>Keep me signed in</span>
            </label>
          </div>

          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login to NyumbaDirect"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <Link className="auth-back" to="/">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default Login;