import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);

  const token = localStorage.getItem("access_token");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setMenuOpen(false);
    navigate("/login");
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="site-navigation">

      <div className="navigation-inner">

        {/* =================================================
            BRAND
            ================================================= */}

        <Link
          to="/"
          className="nd-brand"
          onClick={closeMenu}
          aria-label="NyumbaDirect home"
        >

          <span className="nd-brand-mark">
            N
          </span>

          <span className="nd-brand-name">
            Nyumba<span>Direct</span>
          </span>

        </Link>


        {/* =================================================
            DESKTOP NAVIGATION
            ================================================= */}

        <nav className="nd-desktop-nav">

          <Link
            to="/"
            className={
              location.pathname === "/"
                ? "active"
                : ""
            }
          >
            Home
          </Link>

          <Link
            to="/properties"
            className={
              location.pathname.startsWith("/properties")
                ? "active"
                : ""
            }
          >
            Find a Home
          </Link>

          <a href="/#how-it-works">
            How It Works
          </a>

          {token ? (

            <Link
              to="/dashboard"
              className={
                location.pathname.startsWith("/dashboard")
                  ? "active"
                  : ""
              }
            >
              Dashboard
            </Link>

          ) : null}

        </nav>


        {/* =================================================
            DESKTOP ACTIONS
            ================================================= */}

        <div className="nd-navigation-actions">

          {token ? (

            <>

              <Link
                to="/messages"
                className="nd-nav-message"
              >
                Messages
              </Link>

              <button
                type="button"
                className="nd-nav-logout"
                onClick={handleLogout}
              >
                Logout
              </button>

            </>

          ) : (

            <>

              <Link
                to="/login"
                className="nd-nav-login"
              >
                Login
              </Link>

              <Link
                to="/register"
                className="nd-nav-signup"
              >
                Get Started
              </Link>

            </>

          )}

        </div>


        {/* =================================================
            MOBILE MENU BUTTON
            ================================================= */}

        <button
          type="button"
          className={`nd-mobile-menu-button ${
            menuOpen ? "open" : ""
          }`}
          onClick={() =>
            setMenuOpen(
              (value) => !value
            )
          }
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >

          <span></span>
          <span></span>
          <span></span>

        </button>

      </div>


      {/* =================================================
          MOBILE NAVIGATION
          ================================================= */}

      <div
        className={`nd-mobile-menu ${
          menuOpen ? "open" : ""
        }`}
      >

        <Link
          to="/"
          onClick={closeMenu}
          className={
            location.pathname === "/"
              ? "active"
              : ""
          }
        >
          Home
        </Link>


        <Link
          to="/properties"
          onClick={closeMenu}
          className={
            location.pathname.startsWith("/properties")
              ? "active"
              : ""
          }
        >
          Find a Home
        </Link>


        <a
          href="/#how-it-works"
          onClick={closeMenu}
        >
          How It Works
        </a>


        {token ? (

          <>

            <Link
              to="/dashboard"
              onClick={closeMenu}
            >
              Dashboard
            </Link>

            <Link
              to="/messages"
              onClick={closeMenu}
            >
              Messages
            </Link>

            <button
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>

          </>

        ) : (

          <>

            <Link
              to="/login"
              onClick={closeMenu}
            >
              Login
            </Link>

            <Link
              to="/register"
              onClick={closeMenu}
              className="mobile-signup"
            >
              Get Started
            </Link>

          </>

        )}

      </div>

    </header>
  );
}

export default Navigation;
