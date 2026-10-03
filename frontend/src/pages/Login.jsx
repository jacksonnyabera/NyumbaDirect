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
      const user = meResponse.data;

      if (user?.id) {
        localStorage.setItem("user_id", String(user.id));
      }

      navigate(
        user?.role?.toUpperCase() === "ADMIN"
          ? "/admin"
          : "/dashboard"
      );
    } catch (error) {
      console.error("Login error:", error);

      const detail = error.response?.data?.detail;

      if (error.response?.status === 422) {
        setError(
          detail || "The login information has an invalid format."
        );
      } else if (error.response?.status === 403) {
        setError(
          detail || "Your account cannot sign in right now."
        );
      } else if (error.response?.status === 401) {
        setError(
          detail || "Invalid email or password."
        );
      } else if (error.code === "ERR_NETWORK") {
        setError(
          "Unable to reach the NyumbaDirect server. Check your connection and try again."
        );
      } else if (error.code === "ECONNABORTED") {
        setError(
          "The server took too long to respond. Please try again."
        );
      } else if (detail) {
        setError(detail);
      } else {
        setError(
          "Unable to sign in right now. Please try again."
        );
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
          <p>
            Sign in to continue to your NyumbaDirect account.
          </p>
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
              placeholder="you@example.com"
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <div className="auth-row">
              <label htmlFor="password">
                Password
              </label>

              <Link
                to="/forgot-password"
                className="auth-link-muted"
              >
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
                onChange={(event) =>
                  setRemember(event.target.checked)
                }
              />

              <span>Keep me signed in</span>
            </label>
          </div>

          <button
            className="auth-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login to NyumbaDirect"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/register">
            Create one
          </Link>
        </p>

        <Link className="auth-back" to="/">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default Login;
