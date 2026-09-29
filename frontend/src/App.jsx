import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyAccount from "./pages/VerifyAccount";
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
import AdminVerification from "./pages/AdminVerification";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PublicInfo from "./pages/PublicInfo";
import api, { API_BASE_URL } from "./services/api";


/* =========================================================
   HOME PAGE
   ========================================================= */

function Home() {
  const [listingStats, setListingStats] = useState({ available: null, verified: null });
  const [featuredProperty, setFeaturedProperty] = useState(null);
  const [inventoryState, setInventoryState] = useState("loading");
  const [homeSearch, setHomeSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/properties", { params: { limit: 1 } }),
      api.get("/properties", { params: { limit: 1, verified_only: true } }),
    ])
      .then(([available, verified]) => {
        if (active) {
          setListingStats({
            available: available.data?.total ?? 0,
            verified: verified.data?.total ?? 0,
          });
          const item = available.data?.items?.[0] || null;
          setFeaturedProperty(item);
          setInventoryState(item ? "available" : "empty");
        }
      })
      .catch(() => {
        if (active) setInventoryState("unavailable");
      });
    return () => { active = false; };
  }, []);

  const handleHomeSearch = (event) => {
    event.preventDefault();
    const query = homeSearch.trim();
    navigate(query ? `/properties?search=${encodeURIComponent(query)}` : "/properties");
  };

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
              <span aria-hidden="true">N</span>
              Rental homes across Kenya
            </div>

            <p className="eyebrow">
              A CLEARER WAY TO RENT
            </p>

            <h1>
              Find a home
              <br />
              <span>that fits.</span>
            </h1>

            <p className="hero-text">
              Search rental listings by location, budget and size. Compare the details, then message the landlord or property manager directly.
            </p>

            <form className="home-search-form" onSubmit={handleHomeSearch}>
              <label className="sr-only" htmlFor="home-search">Town or neighbourhood</label>
              <input
                id="home-search"
                type="search"
                value={homeSearch}
                onChange={(event) => setHomeSearch(event.target.value)}
                placeholder="Town or neighbourhood"
                autoComplete="off"
              />
              <button type="submit" className="search-btn">Search homes <span aria-hidden="true">→</span></button>
            </form>

            <div className="hero-actions">
              <Link to="/properties" className="secondary-btn">Browse all homes</Link>
              <Link to="/register?role=LANDLORD" className="secondary-btn">List a property</Link>
            </div>

            <div className="hero-trust">

              <div>
                <strong>✓</strong>
                Verification status shown
              </div>

              <div>
                <strong>✓</strong>
                Message the property owner
              </div>

              <div>
                <strong>✓</strong>
                Free to browse
              </div>

            </div>

          </div>


          {/* A real listing card keeps homepage claims tied to current inventory. */}
          <div className="hero-image">
            {featuredProperty ? (
              <article className="house-card">
                <div className="house-placeholder">
                  {(() => {
                    const photo = featuredProperty.photos?.find((item) => item.is_primary) || featuredProperty.photos?.[0];
                    const imageUrl = photo?.image_url
                      ? (photo.image_url.startsWith("http") ? photo.image_url : `${API_BASE_URL}${photo.image_url}`)
                      : null;
                    return imageUrl ? <img src={imageUrl} alt={featuredProperty.title} loading="lazy" /> : <span className="home-image-fallback">Photo not provided</span>;
                  })()}
                  {featuredProperty.is_verified && <div className="verified-badge">✓ Verified</div>}
                </div>
                <div className="house-info">
                  <div className="house-card-top">
                    <div>
                      <strong>{featuredProperty.title}</strong>
                      <span>{[featuredProperty.area, featuredProperty.town, featuredProperty.county].filter(Boolean).join(", ") || "Location not provided"}</span>
                    </div>
                  </div>
                  <div className="house-meta">
                    <span>{featuredProperty.bedrooms} beds</span>
                    <span>{featuredProperty.bathrooms} baths</span>
                    <span>{featuredProperty.property_type}</span>
                  </div>
                  <div className="price">
                    KSh {Number(featuredProperty.monthly_rent).toLocaleString()}
                    <small> / month</small>
                  </div>
                  <Link to={`/properties/${featuredProperty.id}`} className="view-home-button">View this home →</Link>
                </div>
              </article>
            ) : inventoryState === "loading" || inventoryState === "unavailable" ? (
              <div className="house-card house-card-empty">
                <div className="house-placeholder"><span aria-hidden="true">N</span></div>
                <div className="house-info">
                  <div className="house-card-top"><div><strong>{inventoryState === "loading" ? "Loading current listings" : "Listings are temporarily unavailable"}</strong><span>{inventoryState === "loading" ? "Checking available rentals" : "Please browse homes or try again shortly"}</span></div></div>
                  {inventoryState === "unavailable" && <Link to="/properties" className="view-home-button">Browse homes →</Link>}
                </div>
              </div>
            ) : (
              <div className="house-card">
                <div className="house-placeholder"><span>🏡</span></div>
                <div className="house-info">
                  <div className="house-card-top"><div><strong>List your home on NyumbaDirect</strong><span>Connect with house hunters directly</span></div></div>
                  <p>There are no available listings right now. Check back soon or browse again later.</p>
                  <Link to="/register?role=LANDLORD" className="view-home-button">List a property →</Link>
                </div>
              </div>
            )}
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
              Search, compare and get in touch
            </h2>

            <p>
              Review each listing at your own pace, then contact the person managing the property when you are ready.
            </p>

          </div>


          <div className="features">

            <div className="feature-card">

              <div className="feature-icon" aria-hidden="true">
                01
              </div>

              <h3>
                Clear Listing Details
              </h3>

              <p>
                See whether a property has a NyumbaDirect verification badge. Always confirm details with the owner before paying.
              </p>

            </div>


            <div className="feature-card">

              <div className="feature-icon" aria-hidden="true">
                02
              </div>

              <h3>
                Chat Directly
              </h3>

              <p>
                Start a conversation from a listing and keep replies together in your inbox.
              </p>

            </div>


            <div className="feature-card">

              <div className="feature-icon" aria-hidden="true">
                03
              </div>

              <h3>
                Smart Search
              </h3>

              <p>
                Narrow the results by location, monthly rent, bedrooms and property type.
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
                {listingStats.available === null ? (inventoryState === "unavailable" ? "—" : "…") : listingStats.available.toLocaleString()}
              </span>

              <span className="stat-label">
                Available Homes
              </span>

            </div>


            <div className="stat-card">

              <span className="stat-number">
                {listingStats.verified === null ? (inventoryState === "unavailable" ? "—" : "…") : listingStats.verified.toLocaleString()}
              </span>

              <span className="stat-label">
                Verified Listings
              </span>

            </div>


            <div className="stat-card">

              <span className="stat-number">
                Direct
              </span>

              <span className="stat-label">
                Landlord contact
              </span>

            </div>


            <div className="stat-card">

              <span className="stat-number">
                Free
              </span>

              <span className="stat-label">
                Cost to browse listings
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
              Search listings in towns and neighbourhoods across Kenya.
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
                Search current listings in Nairobi by area, rent and home type.
              </p>

              <Link
                to="/properties?search=Nairobi"
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
                Browse rentals listed in Mombasa and surrounding neighbourhoods.
              </p>

              <Link
                to="/properties?search=Mombasa"
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
                Find available rentals listed in Kisumu and nearby areas.
              </p>

              <Link
                to="/properties?search=Kisumu"
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

              <p>Review photos, rent, location and any verification badge. Confirm viewing and payment details directly with the owner.</p>

            </div>


            <div className="process-card">

              <span className="process-number">
                03
              </span>

              <h3>
                Contact the Owner
              </h3>

              <p>
                Use your NyumbaDirect inbox to ask questions and arrange a viewing.
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

    "/verify-account": {
      title: "Verify Your Account | NyumbaDirect Kenya",
      description: "Verify your NyumbaDirect account with a one-time email or SMS code.",
      keywords: "",
      index: false,
    },

    "/forgot-password": {
      title: "Reset Password | NyumbaDirect Kenya",
      description: "Request a secure password reset link for your NyumbaDirect account.",
      keywords: "",
      index: false,
    },

    "/reset-password": {
      title: "Choose a New Password | NyumbaDirect Kenya",
      description: "Set a new password for your NyumbaDirect account.",
      keywords: "",
      index: false,
    },

    "/contact": {
      title: "Contact NyumbaDirect | Kenya Property Marketplace",
      description: "Contact NyumbaDirect for account, listing, verification, payment or safety support.",
      keywords: "NyumbaDirect contact, Kenya property support",
      index: true,
    },

    "/privacy-policy": {
      title: "Privacy Policy | NyumbaDirect Kenya",
      description: "Learn how NyumbaDirect uses account, property listing, messaging and promotion information.",
      keywords: "NyumbaDirect privacy policy",
      index: true,
    },

    "/terms-conditions": {
      title: "Terms of Use | NyumbaDirect Kenya",
      description: "Terms for searching homes, publishing property listings, messaging and paid property promotions.",
      keywords: "NyumbaDirect terms of use",
      index: true,
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
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [answers, setAnswers] = useState([
    {
      from: "assistant",
      text: "Hi, I’m NyumbaDirect AI Help. Ask me to find a home, compare rent, or explain how to list or contact a landlord.",
    },
  ]);
  const chatRef = React.useRef(null);

  useEffect(() => {
    if (open && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [answers, open, sending]);

  const handleAsk = async (event) => {
    event?.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || sending) return;

    setQuestion("");
    setAnswers((previous) => [...previous, { from: "user", text: cleanQuestion }]);
    setSending(true);

    try {
      const response = await api.post("/assistant/chat", { question: cleanQuestion });
      setAnswers((previous) => [
        ...previous,
        {
          from: "assistant",
          text: response.data?.reply || "I’m here to help. Try asking about homes, rent or landlord contact.",
          properties: response.data?.properties || [],
        },
      ]);
    } catch (error) {
      console.error("NyumbaDirect assistant request failed:", error);
      setAnswers((previous) => [
        ...previous,
        {
          from: "assistant",
          text: "I can’t reach the help service right now. Please try again, or browse current homes directly.",
          properties: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ai-assistant">
      <button
        type="button"
        className="ai-assistant-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close NyumbaDirect AI help" : "Open NyumbaDirect AI help"}
        aria-expanded={open}
      >
        {open ? "×" : "AI"}
      </button>

      {open && (
        <section className="ai-help-panel" aria-label="NyumbaDirect AI Help">
          <div className="ai-help-header">
            <div>
              <span className="ai-help-kicker">NyumbaDirect AI</span>
              <h3>Home Help</h3>
            </div>
            <button type="button" className="ai-help-close" onClick={() => setOpen(false)} aria-label="Close help">×</button>
          </div>

          <div className="ai-help-chat" ref={chatRef} aria-live="polite">
            {answers.map((item, index) => (
              <div key={`${item.from}-${index}`}>
                <div className={`ai-help-message ai-help-${item.from}`}>{item.text}</div>
                {item.properties?.length > 0 && (
                  <div className="ai-help-property-results">
                    {item.properties.map((property) => (
                      <Link key={property.id} to={`/properties/${property.id}`} className="ai-help-property-card">
                        <strong>{property.title}</strong>
                        <span>{[property.area, property.town].filter(Boolean).join(", ")}</span>
                        <span>KSh {Number(property.monthly_rent).toLocaleString()} / month</span>
                        <small>{property.bedrooms} bedroom{property.bedrooms === 1 ? "" : "s"} · View details →</small>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="ai-help-message ai-help-assistant" role="status">Finding the right information…</div>}
          </div>

          <form className="ai-help-form" onSubmit={handleAsk}>
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about homes, rent or listing"
              maxLength={500}
              aria-label="Ask NyumbaDirect AI"
              disabled={sending}
            />
            <button type="submit" disabled={sending || !question.trim()}>
              {sending ? "…" : "Ask"}
            </button>
          </form>
        </section>
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
        <Route path="/verify-account" element={<VerifyAccount />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/contact" element={<PublicInfo />} />
        <Route path="/privacy-policy" element={<PublicInfo />} />
        <Route path="/terms-conditions" element={<PublicInfo />} />


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
        <Route
           path="/boost-property/:propertyId"
           element={<BoostProperty />}
        />

        <Route
            path="/admin/verification"
            element={<AdminVerification />}
        />

      </Routes>




      <AIHelpAssistant />

    </BrowserRouter>

  );

}


export default App;
