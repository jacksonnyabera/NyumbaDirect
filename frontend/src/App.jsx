import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
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
import BoostProperty from "./pages/BoostProperty";
import Navigation from "./components/Navigation";


/* =========================================================
   HOME PAGE
   ========================================================= */

function Home() {
  return (
    <div className="app">

      <Navigation />

      <main>

        {/* =================================================
            HERO
            ================================================= */}

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
              Discover quality rental properties and connect
              directly with landlords and property managers —
              without unnecessary middlemen.
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

                <span>
                  🏡
                </span>

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

                  <span>
                    🛏 3 Beds
                  </span>

                  <span>
                    🚿 2 Baths
                  </span>

                  <span>
                    🏠 House
                  </span>

                </div>


                <div className="price">
                  KSh 35,000
                  <small>
                    {" "}
                    / month
                  </small>
                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            FEATURES
            ================================================= */}

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


        {/* =================================================
            MARKET STATS
            ================================================= */}

        <section className="stats-strip">

          <div className="stats-grid">

            <div className="stat-card">

              <span className="stat-number">
                2k+
              </span>

              <span className="stat-label">
                Verified Listings
              </span>

            </div>


            <div className="stat-card">

              <span className="stat-number">
                8+
              </span>

              <span className="stat-label">
                Major Kenyan Towns
              </span>

            </div>


            <div className="stat-card">

              <span className="stat-number">
                24hr
              </span>

              <span className="stat-label">
                Direct Response
              </span>

            </div>


            <div className="stat-card">

              <span className="stat-number">
                0%
              </span>

              <span className="stat-label">
                Hidden Agent Fees
              </span>

            </div>

          </div>

        </section>


        {/* =================================================
            CITY GUIDE
            ================================================= */}

        <section className="city-guide">

          <div className="section-heading centered-heading">

            <p className="eyebrow">
              POPULAR KENYA LOCATIONS
            </p>

            <h2>
              Find a home in the place that fits your life
            </h2>

            <p>
              Discover quality rental options across Kenya’s
              most active property markets.
            </p>

          </div>


          <div className="city-grid">

            <div className="city-card city-card-dark">

              <span className="city-chip">
                Nairobi
              </span>

              <h3>
                Kilimani & Westlands
              </h3>

              <p>
                Professionally managed apartments and family
                homes near work, study and lifestyle hubs.
              </p>

              <Link
                to="/properties"
                className="city-link"
              >
                Explore Nairobi
                <span>
                  →
                </span>
              </Link>

            </div>


            <div className="city-card">

              <span className="city-chip">
                Mombasa
              </span>

              <h3>
                Coastal Living
              </h3>

              <p>
                Homes near the coast, business districts and
                relaxed neighbourhoods.
              </p>

              <Link
                to="/properties"
                className="city-link"
              >
                Explore Mombasa
                <span>
                  →
                </span>
              </Link>

            </div>


            <div className="city-card">

              <span className="city-chip">
                Kisumu
              </span>

              <h3>
                Lake Region Rentals
              </h3>

              <p>
                Comfortable homes, family apartments and town
                rentals with local convenience.
              </p>

              <Link
                to="/properties"
                className="city-link"
              >
                Explore Kisumu
                <span>
                  →
                </span>
              </Link>

            </div>

          </div>

        </section>


        {/* =================================================
            HOW IT WORKS
            ================================================= */}

        <section
          className="process-section"
          id="how-it-works"
        >

          <div className="section-heading centered-heading">

            <p className="eyebrow">
              HOW IT WORKS
            </p>

            <h2>
              From search to keys in a few steps
            </h2>

          </div>


          <div className="process-grid">

            <div className="process-card">

              <span className="process-number">
                01
              </span>

              <h3>
                Search & Shortlist
              </h3>

              <p>
                Filter rentals by location, price, bedrooms
                and property type.
              </p>

            </div>


            <div className="process-card">

              <span className="process-number">
                02
              </span>

              <h3>
                Verify & Compare
              </h3>

              <p>
                Check property details, photos, location and
                owner information.
              </p>

            </div>


            <div className="process-card">

              <span className="process-number">
                03
              </span>

              <h3>
                Connect Directly
              </h3>

              <p>
                Message landlords or property managers
                quickly and safely.
              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            BUSINESS CTA
            ================================================= */}

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


      {/* =================================================
          PROFESSIONAL BUSINESS FOOTER
          ================================================= */}

      <footer className="site-footer">

        <div className="footer-inner">


          {/* COMPANY */}

          <div className="footer-brand">

            <Link
              to="/"
              className="footer-brand-logo"
              aria-label="NyumbaDirect Kenya"
            >

              <span className="footer-brand-logo-mark">
                N
              </span>

              <span className="footer-brand-logo-text">
                Nyumba
                <span>
                  Direct
                </span>
              </span>

            </Link>


            <p>
              NyumbaDirect is a Kenyan property technology
              platform connecting house hunters directly
              with landlords and property managers.
            </p>


            <div className="footer-trust">

              <span>
                ✓
              </span>

              Built for simpler property discovery in Kenya

            </div>

          </div>


          {/* PLATFORM */}

          <div className="footer-column">

            <h3>
              Platform
            </h3>

            <Link to="/properties">
              Browse Homes
            </Link>

            <Link to="/register">
              Create Account
            </Link>

            <Link to="/login">
              Login
            </Link>

            <Link to="/dashboard">
              Dashboard
            </Link>

          </div>


          {/* COMPANY */}

          <div className="footer-column">

            <h3>
              Company
            </h3>

            <Link to="/">
              About NyumbaDirect
            </Link>

            <Link to="/properties">
              Property Marketplace
            </Link>

            <a href="#how-it-works">
              How It Works
            </a>

            <a href="mailto:maobe928@gmail.com">
              Contact Us
            </a>

          </div>


          {/* CONTACT */}

          <div className="footer-column">

            <h3>
              Contact
            </h3>


            <div className="footer-contact-item">

              <span className="footer-contact-icon">
                ✉
              </span>

              <a href="mailto:maobe928@gmail.com">
                maobe928@gmail.com
              </a>

            </div>


            <div className="footer-contact-item">

              <span className="footer-contact-icon">
                🌍
              </span>

              <span>
                Kenya
              </span>

            </div>


            <div className="footer-contact-item">

              <span className="footer-contact-icon">
                🏠
              </span>

              <span>
                Property technology platform
              </span>

            </div>

          </div>

        </div>


        {/* FOOTER BOTTOM */}

        <div className="footer-bottom">

          <span>
            © {new Date().getFullYear()} NyumbaDirect.
            All rights reserved.
          </span>


          <div className="footer-bottom-links">

            <Link to="/privacy-policy">
              Privacy
            </Link>

            <Link to="/terms-conditions">
              Terms
            </Link>

            <Link to="/contact">
              Contact
            </Link>

          </div>

        </div>

      </footer>

    </div>
  );
}


/* =========================================================
   SEO
   ========================================================= */

function getRouteMeta(pathname) {

  const routeMap = {

    "/": {
      title:
        "NyumbaDirect Kenya | Find Houses Directly from Landlords",

      description:
        "NyumbaDirect Kenya helps you find houses, apartments and rental properties directly from landlords and property managers across Kenya.",

      keywords:
        "NyumbaDirect, houses for rent in Kenya, apartments for rent Kenya, Nairobi houses, rental houses Kenya, houses directly from landlords",

      index: true,
    },


    "/properties": {
      title:
        "Browse Rental Homes in Kenya | NyumbaDirect",

      description:
        "Browse houses, apartments and rental properties available across Kenya on NyumbaDirect. Search by location, rent, bedrooms and property type.",

      keywords:
        "houses for rent Kenya, apartments for rent Kenya, rental homes Kenya, Nairobi houses for rent, NyumbaDirect properties",

      index: true,
    },


    "/login": {
      title:
        "Login | NyumbaDirect Kenya",

      description:
        "Log in to your NyumbaDirect Kenya account.",

      keywords: "",

      index: false,
    },


    "/register": {
      title:
        "Create an Account | NyumbaDirect Kenya",

      description:
        "Create a NyumbaDirect Kenya account to save homes, contact landlords and manage rental listings.",

      keywords: "",

      index: false,
    },


    "/dashboard": {
      title:
        "Dashboard | NyumbaDirect Kenya",

      description:
        "Manage your NyumbaDirect account and rental properties.",

      keywords: "",

      index: false,
    },


    "/dashboard/add-property": {
      title:
        "Add Property | NyumbaDirect Kenya",

      description:
        "Create and publish a rental property listing on NyumbaDirect Kenya.",

      keywords: "",

      index: false,
    },


    "/messages": {
      title:
        "Messages | NyumbaDirect Kenya",

      description:
        "Manage your conversations with landlords and property managers on NyumbaDirect.",

      keywords: "",

      index: false,
    },


    "/saved-homes": {
      title:
        "Saved Homes | NyumbaDirect Kenya",

      description:
        "View your saved rental properties on NyumbaDirect Kenya.",

      keywords: "",

      index: false,
    },

  };


  /* PROPERTY DETAILS */

  if (
    pathname.startsWith("/properties/")
  ) {

    return {

      title:
        "Rental Property | NyumbaDirect Kenya",

      description:
        "View rental property details, location, rent and property information on NyumbaDirect Kenya.",

      keywords:
        "rental property Kenya, house for rent Kenya, apartment for rent Kenya, NyumbaDirect",

      index: true,

    };

  }


  /* CONVERSATIONS */

  if (
    pathname.startsWith("/messages/")
  ) {

    return {

      title:
        "Conversation | NyumbaDirect Kenya",

      description:
        "Continue your conversation with a landlord or property manager on NyumbaDirect.",

      keywords: "",

      index: false,

    };

  }


  /* EDIT PROPERTY */

  if (
    pathname.startsWith(
      "/dashboard/edit-property/"
    )
  ) {

    return {

      title:
        "Edit Property | NyumbaDirect Kenya",

      description:
        "Update and manage your rental property listing on NyumbaDirect Kenya.",

      keywords: "",

      index: false,

    };

  }


  /* BOOST PROPERTY */

  if (
    pathname.startsWith("/boost/")
  ) {

    return {

      title:
        "Boost Your Property | NyumbaDirect Kenya",

      description:
        "Choose a NyumbaDirect property promotion package and increase your property's visibility.",

      keywords: "",

      index: false,

    };

  }


  return (
    routeMap[pathname] ||
    routeMap["/"]
  );
}


/* =========================================================
   SEO MANAGER
   ========================================================= */

function AppSEO() {

  const location =
    useLocation();


  useEffect(() => {

    const meta =
      getRouteMeta(
        location.pathname
      );


    const siteUrl =
      "https://www.nyumbadirect.co.ke";


    const currentUrl =
      location.pathname === "/"
        ? `${siteUrl}/`
        : `${siteUrl}${location.pathname}`;


    /* TITLE */

    document.title =
      meta.title;


    /* DESCRIPTION */

    let description =
      document.querySelector(
        'meta[name="description"]'
      );


    if (!description) {

      description =
        document.createElement(
          "meta"
        );

      description.setAttribute(
        "name",
        "description"
      );

      document.head.appendChild(
        description
      );

    }


    description.setAttribute(
      "content",
      meta.description
    );


    /* KEYWORDS */

    let keywords =
      document.querySelector(
        'meta[name="keywords"]'
      );


    if (!keywords) {

      keywords =
        document.createElement(
          "meta"
        );

      keywords.setAttribute(
        "name",
        "keywords"
      );

      document.head.appendChild(
        keywords
      );

    }


    keywords.setAttribute(
      "content",
      meta.keywords
    );


    /* ROBOTS */

    let robots =
      document.querySelector(
        'meta[name="robots"]'
      );


    if (!robots) {

      robots =
        document.createElement(
          "meta"
        );

      robots.setAttribute(
        "name",
        "robots"
      );

      document.head.appendChild(
        robots
      );

    }


    robots.setAttribute(
      "content",
      meta.index
        ? "index, follow"
        : "noindex, nofollow"
    );


    /* CANONICAL */

    let canonical =
      document.querySelector(
        'link[rel="canonical"]'
      );


    if (!canonical) {

      canonical =
        document.createElement(
          "link"
        );

      canonical.setAttribute(
        "rel",
        "canonical"
      );

      document.head.appendChild(
        canonical
      );

    }


    canonical.setAttribute(
      "href",
      currentUrl
    );


    /* OG TITLE */

    let ogTitle =
      document.querySelector(
        'meta[property="og:title"]'
      );


    if (!ogTitle) {

      ogTitle =
        document.createElement(
          "meta"
        );

      ogTitle.setAttribute(
        "property",
        "og:title"
      );

      document.head.appendChild(
        ogTitle
      );

    }


    ogTitle.setAttribute(
      "content",
      meta.title
    );


    /* OG DESCRIPTION */

    let ogDescription =
      document.querySelector(
        'meta[property="og:description"]'
      );


    if (!ogDescription) {

      ogDescription =
        document.createElement(
          "meta"
        );

      ogDescription.setAttribute(
        "property",
        "og:description"
      );

      document.head.appendChild(
        ogDescription
      );

    }


    ogDescription.setAttribute(
      "content",
      meta.description
    );


    /* OG URL */

    let ogUrl =
      document.querySelector(
        'meta[property="og:url"]'
      );


    if (!ogUrl) {

      ogUrl =
        document.createElement(
          "meta"
        );

      ogUrl.setAttribute(
        "property",
        "og:url"
      );

      document.head.appendChild(
        ogUrl
      );

    }


    ogUrl.setAttribute(
      "content",
      currentUrl
    );

  }, [
    location.pathname,
  ]);


  return null;
}


/* =========================================================
   AI HELP ASSISTANT
   ========================================================= */

function AIHelpAssistant() {

  const [open, setOpen] =
    useState(false);

  const [question, setQuestion] =
    useState("");

  const [answers, setAnswers] =
    useState([

      {
        from: "assistant",

        text:
          "Hi, I’m NyumbaDirect AI Help. Ask about rents, homes, locations or listing steps.",
      },

    ]);


  const getQuickAnswer =
    (text) => {

      const q =
        text.toLowerCase();


      if (
        q.includes("rent") ||
        q.includes("price") ||
        q.includes("cost") ||
        q.includes("monthly")
      ) {

        return (
          "You can filter homes by rent and compare monthly rent, deposit, and property type on the properties page."
        );

      }


      if (
        q.includes("house") ||
        q.includes("home") ||
        q.includes("property") ||
        q.includes("listing")
      ) {

        return (
          "Browse verified properties, then contact the landlord or property manager directly through the messages page."
        );

      }


      if (
        q.includes("location") ||
        q.includes("nairobi") ||
        q.includes("mombasa") ||
        q.includes("kisumu")
      ) {

        return (
          "Search by town, county, area, or estate to find homes in Nairobi, Mombasa, Kisumu, and other Kenyan locations."
        );

      }


      if (
        q.includes("login") ||
        q.includes("account") ||
        q.includes("register") ||
        q.includes("signup")
      ) {

        return (
          "Create a NyumbaDirect account as a house hunter or landlord/manager, then add or manage rental listings from the dashboard."
        );

      }


      return (
        "I can help you search homes, compare rent, check locations, and guide you through listing or messaging steps on NyumbaDirect."
      );

    };


  const handleAsk =
    () => {

      const cleanQuestion =
        question.trim();


      if (!cleanQuestion) {
        return;
      }


      const newAnswer =
        getQuickAnswer(
          cleanQuestion
        );


      setAnswers(
        (previous) => [

          ...previous,

          {
            from: "user",
            text: cleanQuestion,
          },

          {
            from: "assistant",
            text: newAnswer,
          },

        ]
      );


      setQuestion("");

    };


  return (

    <div className="ai-assistant">

      <button
        type="button"
        className="ai-assistant-toggle"
        onClick={() =>
          setOpen(
            (value) =>
              !value
          )
        }
        aria-label="Open NyumbaDirect AI help"
      >

        {open
          ? "×"
          : "AI"}

      </button>


      {open && (

        <div className="ai-help-panel">


          <div className="ai-help-header">

            <div>

              <span className="ai-help-kicker">
                NyumbaDirect AI
              </span>

              <h3>
                Home Help
              </h3>

            </div>


            <button
              type="button"
              className="ai-help-close"
              onClick={() =>
                setOpen(false)
              }
            >
              ×
            </button>

          </div>


          <div className="ai-help-chat">

            {answers.map(
              (item, index) => (

                <div
                  key={index}
                  className={`ai-help-message ai-help-${item.from}`}
                >

                  {item.text}

                </div>

              )
            )}

          </div>


          <div className="ai-help-form">

            <input
              type="text"
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              placeholder="Ask about homes, rent or Kenya locations"
              onKeyDown={(event) => {

                if (
                  event.key ===
                  "Enter"
                ) {

                  handleAsk();

                }

              }}
            />


            <button
              type="button"
              onClick={handleAsk}
            >
              Ask
            </button>

          </div>

        </div>

      )}

    </div>

  );

}


/* =========================================================
   MAIN APP
   ========================================================= */

function App() {

  return (

    <BrowserRouter>

      <AppSEO />


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


        {/* BOOST */}

        <Route
          path="/boost/:propertyId"
          element={<BoostProperty />}
        />


        {/* MESSAGES */}

        <Route
          path="/messages"
          element={<Conversations />}
        />


        <Route
          path="/messages/:conversationId"
          element={<Messages />}
        />


        {/* SAVED HOMES */}

        <Route
          path="/saved-homes"
          element={<SavedHomes />}
        />


        {/* FALLBACK */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>


      <AIHelpAssistant />

    </BrowserRouter>

  );

}


export default App;