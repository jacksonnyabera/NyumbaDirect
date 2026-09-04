import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("HOUSE_HUNTER");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.post("/auth/register", {
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim(),
        password,
        role,
      });

      setSuccess("Account created successfully. Redirecting to login...");

      setTimeout(() => {
        navigate("/login");
      }, 1200);

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
      <div className="auth-card">

        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        <h1>Create your account</h1>

        <p>
          Join NyumbaDirect and find or list your next home.
        </p>

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

        <form onSubmit={handleRegister}>

          <label>Full name</label>

          <input
            type="text"
            value={fullName}
            placeholder="Your full name"
            onChange={(event) =>
              setFullName(event.target.value)
            }
            required
          />

          <label>Email</label>

          <input
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />

          <label>Phone number</label>

          <input
            type="tel"
            value={phoneNumber}
            placeholder="07XXXXXXXX"
            onChange={(event) =>
              setPhoneNumber(event.target.value)
            }
            required
          />

          <label>Password</label>

          <input
            type="password"
            value={password}
            placeholder="Create a password"
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />

          <label>Account type</label>

          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value)
            }
          >
            <option value="HOUSE_HUNTER">
              House Hunter
            </option>

            <option value="LANDLORD">
              Landlord
            </option>

            <option value="PROPERTY_MANAGER">
              Property Manager
            </option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>

        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login">
            Login
          </Link>
        </p>

        <Link to="/">
          ← Back to home
        </Link>

      </div>
    </div>
  );
}

export default Register;