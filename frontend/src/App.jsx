import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import Dashboard from "./pages/Dashboard";
import AddProperty from "./pages/AddProperty";
import EditProperty from "./pages/EditProperty";
import Conversations from "./pages/Conversations";
import Messages from "./pages/Messages";
import SavedHomes from "./pages/SavedHomes";


function Navigation() {
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");

    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">

        {/* BRAND */}
        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        {/* MAIN NAVIGATION */}
        <nav className="nav-links">

          <Link to="/">
            Home
          </Link>

          <Link to="/properties">
            Find a Home
          </Link>

          {token ? (
            <>
              <Link to="/messages">
                Messages
              </Link>

              <Link to="/dashboard">
                Dashboard
              </Link>

              <button
                type="button"
                className="nav-logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                Login
              </Link>

              <Link
                to="/register"
                className="register-btn"
              >
                Get Started
              </Link>
            </>
          )}

        </nav>

      </div>
    </header>
  );
}


function Home() {
  return (
    <div className="app">

      <Navigation />

      <main>

        {/* HERO */}
        <section className="hero">

          <div className="hero-content">

            <div className="hero-badge">
              <span>✓</span>
              Trusted property marketplace
            </div>

            <p className="eyebrow">
              FIND YOUR NEXT HOME
            </p>

            <h1>
              Find a home.
              <br />
              <span>Directly.</span>
            </h1>

            <p className="hero-text">
              Discover quality rental properties and
              connect directly with landlords and property
              managers — without unnecessary middlemen.
            </p>

            <div className="hero-actions">

              <Link
                to="/properties"
                className="search-btn"
              >
                Browse Homes
                <span>→</span>
              </Link>

              <Link
                to="/register"
                className="secondary-btn"
              >
                Create Account
              </Link>

            </div>

            <div className="hero-trust">

              <div>
                <strong>✓</strong>
                Verified listings
              </div>

              <div>
                <strong>✓</strong>
                Direct communication
              </div>

              <div>
                <strong>✓</strong>
                Simple house hunting
              </div>

            </div>

          </div>


          {/* HERO PROPERTY CARD */}
          <div className="hero-image">

            <div className="house-card">

              <div className="house-placeholder">
                <span>🏡</span>

                <div className="verified-badge">
                  ✓ Verified
                </div>
              </div>

              <div className="house-info">

                <div className="house-card-top">

                  <div>
                    <strong>
                      Modern Family Home
                    </strong>

                    <span>
                      📍 Nairobi, Kenya
                    </span>
                  </div>

                  <button
                    type="button"
                    className="favorite-btn"
                    aria-label="Save property"
                  >
                    ♡
                  </button>

                </div>

                <div className="house-meta">
                  <span>🛏 3 Beds</span>
                  <span>🚿 2 Baths</span>
                  <span>🏠 House</span>
                </div>

                <div className="price">
                  KSh 35,000
                  <small> / month</small>
                </div>

              </div>

            </div>

          </div>

        </section>


        {/* TRUST / FEATURES */}
        <section className="features-section">

          <div className="section-heading">

            <p className="eyebrow">
              WHY NYUMBADIRECT
            </p>

            <h2>
              A simpler way to find your next home
            </h2>

            <p>
              Everything you need to search, compare and
              communicate with property owners in one place.
            </p>

          </div>


          <div className="features">

            <div className="feature-card">

              <div className="feature-icon">
                ✓
              </div>

              <h3>
                Verified Properties
              </h3>

              <p>
                Discover properties with verification
                information so you can search with greater
                confidence.
              </p>

            </div>


            <div className="feature-card">

              <div className="feature-icon">
                💬
              </div>

              <h3>
                Chat Directly
              </h3>

              <p>
                Contact landlords and property managers
                directly through secure conversations.
              </p>

            </div>


            <div className="feature-card">

              <div className="feature-icon">
                🔍
              </div>

              <h3>
                Smart Search
              </h3>

              <p>
                Filter homes by location, rent, bedrooms
                and property type to find what fits you.
              </p>

            </div>

          </div>

        </section>


        {/* CTA */}
        <section className="home-cta">

          <div>

            <p className="eyebrow">
              READY TO START?
            </p>

            <h2>
              Your next home could be one search away.
            </h2>

            <p>
              Explore available properties and connect
              directly with the people who manage them.
            </p>

          </div>

          <Link
            to="/properties"
            className="search-btn"
          >
            Explore Properties →
          </Link>

        </section>

      </main>


      {/* FOOTER */}
      <footer className="site-footer">

        <div className="footer-inner">

          <div>

            <Link
              to="/"
              className="logo footer-logo"
            >
              Nyumba<span>Direct</span>
            </Link>

            <p>
              Direct connections between house hunters
              and property owners.
            </p>

          </div>

          <div className="footer-links">

            <Link to="/">
              Home
            </Link>

            <Link to="/properties">
              Properties
            </Link>

            <Link to="/login">
              Login
            </Link>

            <Link to="/register">
              Register
            </Link>

          </div>

        </div>

        <div className="footer-bottom">
          © {new Date().getFullYear()} NyumbaDirect.
          All rights reserved.
        </div>

      </footer>

    </div>
  );
}


function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* HOME */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* AUTH */}
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* PROPERTIES */}
        <Route
          path="/properties"
          element={<Properties />}
        />

        <Route
          path="/properties/:propertyId"
          element={<PropertyDetails />}
        />

        {/* DASHBOARD */}
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/dashboard/add-property"
          element={<AddProperty />}
        />

        <Route
          path="/dashboard/edit-property/:propertyId"
          element={<EditProperty />}
        />

        {/* MESSAGING */}
        <Route
          path="/messages"
          element={<Conversations />}
        />

        <Route
          path="/messages/:conversationId"
          element={<Messages />}
        />
        <Route
  path="/saved-homes"
  element={<SavedHomes />}
/>

      </Routes>

    </BrowserRouter>
  );
}

export default App;

