import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    closeMenu();
    navigate("/login");
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">

        {/* LOGO */}
        <Link to="/" className="site-logo" onClick={closeMenu}>
          <span className="site-logo-mark">N</span>
          <span className="site-logo-text">
            Nyumba<span>Direct</span>
          </span>
        </Link>

        {/* DESKTOP NAVIGATION */}
        <nav className="desktop-navigation">
          <NavLink to="/" end>
            Home
          </NavLink>

          <NavLink to="/properties">
            Find a Home
          </NavLink>

          {token && (
            <>
              <NavLink to="/saved-homes">
                Saved Homes
              </NavLink>

              <NavLink to="/messages">
                Messages
              </NavLink>

              <NavLink to="/dashboard">
                Dashboard
              </NavLink>
            </>
          )}
        </nav>

        {/* DESKTOP ACTIONS */}
        <div className="desktop-navigation-actions">
          {token ? (
            <button
              type="button"
              className="nav-logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : (
            <>
              <Link to="/login" className="nav-login-button">
                Login
              </Link>

              <Link to="/register" className="nav-register-button">
                Create Account
              </Link>
            </>
          )}
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          type="button"
          className={`mobile-menu-button ${
            menuOpen ? "menu-open" : ""
          }`}
          onClick={() => setMenuOpen((previous) => !previous)}
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* MOBILE NAVIGATION */}
      {menuOpen && (
        <div className="mobile-navigation">

          <NavLink
            to="/"
            end
            onClick={closeMenu}
          >
            🏠 Home
          </NavLink>

          <NavLink
            to="/properties"
            onClick={closeMenu}
          >
            🔎 Find a Home
          </NavLink>

          {token && (
            <>
              <NavLink
                to="/saved-homes"
                onClick={closeMenu}
              >
                ❤️ Saved Homes
              </NavLink>

              <NavLink
                to="/messages"
                onClick={closeMenu}
              >
                💬 Messages
              </NavLink>

              <NavLink
                to="/dashboard"
                onClick={closeMenu}
              >
                📊 Dashboard
              </NavLink>

              <button
                type="button"
                className="mobile-logout-button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          )}

          {!token && (
            <div className="mobile-auth-actions">
              <Link
                to="/login"
                onClick={closeMenu}
                className="mobile-login-button"
              >
                Login
              </Link>

              <Link
                to="/register"
                onClick={closeMenu}
                className="mobile-register-button"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Navigation;