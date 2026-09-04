import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    setError("");
    setLoading(true);

    try {
      // Step 1: Login
      const response = await api.post("/auth/login", {
        email: cleanEmail,
        password: password,
      });

      const accessToken = response.data?.access_token;

      if (!accessToken) {
        throw new Error("No access token was returned by the server.");
      }

      // Save JWT
      localStorage.setItem("access_token", accessToken);

      // Step 2: Get logged-in user's profile
      const meResponse = await api.get("/auth/me");

      // Save user ID for Messages and Dashboard
      if (meResponse.data?.id) {
        localStorage.setItem(
          "user_id",
          String(meResponse.data.id)
        );
      }

      // Go to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);

      if (error.response?.status === 422) {
        console.error(
          "422 validation response:",
          error.response.data
        );

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
        setError("Unable to connect to the server.");
      }

      // Remove possibly invalid authentication data
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        <h1>Welcome back</h1>

        <p>Login to your NyumbaDirect account.</p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>

          <label htmlFor="email">
            Email
          </label>

          <input
            id="email"
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(event) =>
              setEmail(event.target.value)
            }
            autoComplete="email"
            required
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            placeholder="Your password"
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}
          </button>

        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/register">
            Create one
          </Link>
        </p>

        <Link to="/">
          ← Back to home
        </Link>

      </div>
    </div>
  );
}

export default Login;