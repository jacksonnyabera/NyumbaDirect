import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const API_URL = "http://127.0.0.1:8000";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadDashboard = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const userResponse = await api.get("/auth/me");
        const currentUser = userResponse.data;

        setUser(currentUser);

        const normalizedRole =
          currentUser?.role?.toUpperCase();

        const isLandlord =
          normalizedRole === "LANDLORD" ||
          normalizedRole === "PROPERTY_MANAGER";

        const requests = [
          api.get("/messages/conversations"),
        ];

        if (isLandlord) {
          requests.push(api.get("/properties"));
        }

        const responses = await Promise.all(requests);

        setConversations(responses[0].data || []);

        if (isLandlord && responses[1]) {
          setProperties(
            responses[1].data?.items ||
              responses[1].data ||
              []
          );
        }
      } catch (err) {
        console.error(err);

        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_id");
          navigate("/login");
          return;
        }

        setError(
          err.response?.data?.detail ||
            "Unable to load your dashboard."
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    navigate("/login");
  };

  const handleDelete = async (propertyId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this property? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/properties/${propertyId}`);

      setProperties((currentProperties) =>
        currentProperties.filter(
          (property) => property.id !== propertyId
        )
      );
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        navigate("/login");
        return;
      }

      alert(
        err.response?.data?.detail ||
          "Unable to delete property."
      );
    }
  };

  const isLandlord =
    user?.role?.toUpperCase() === "LANDLORD" ||
    user?.role?.toUpperCase() === "PROPERTY_MANAGER";

  const availableProperties = useMemo(
    () =>
      properties.filter(
        (property) => property.is_available
      ).length,
    [properties]
  );

  const verifiedProperties = useMemo(
    () =>
      properties.filter(
        (property) => property.is_verified
      ).length,
    [properties]
  );

  const unavailableProperties =
    properties.length - availableProperties;

  const getPhotoUrl = (property) => {
    const photos = property?.photos || [];

    if (!photos.length) {
      return null;
    }

    const photo =
      photos.find((item) => item.is_primary) ||
      photos[0];

    if (!photo?.image_url) {
      return null;
    }

    if (photo.image_url.startsWith("http")) {
      return photo.image_url;
    }

    return `${API_URL}${photo.image_url}`;
  };

  const formatPropertyType = (type) => {
    if (!type) {
      return "Property";
    }

    return type
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const formatRole = (role) => {
    if (!role) {
      return "Member";
    }

    return role
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const formatLocation = (property) => {
    const location = [
      property?.area,
      property?.town,
      property?.county,
    ].filter(Boolean);

    return location.length
      ? location.join(", ")
      : "Location not specified";
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div className="dashboard-loading">
            <div className="dashboard-loading-spinner" />
            <h2>Loading your dashboard...</h2>
            <p>
              We're preparing your NyumbaDirect overview.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* NAVIGATION */}
      <nav className="navbar">
        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>

          <Link to="/properties">
            Properties
          </Link>

          <Link
            to="/dashboard"
            className="active-nav-link"
          >
            Dashboard
          </Link>

          <Link to="/messages">
            Messages
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="logout-btn"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="dashboard-container">
        {/* HEADER */}
        <section className="dashboard-hero">
          <div className="dashboard-hero-content">
            <div className="dashboard-user-badge">
              <div className="dashboard-avatar">
                {user?.full_name
                  ?.charAt(0)
                  ?.toUpperCase() || "U"}
              </div>

              <div>
                <span>
                  {formatRole(user?.role)}
                </span>

                {user?.is_verified && (
                  <small>
                    ✓ Verified account
                  </small>
                )}
              </div>
            </div>

            <p className="dashboard-eyebrow">
              {isLandlord
                ? "🏠 PROPERTY MANAGEMENT"
                : "🔎 HOUSE HUNTING"}
            </p>

            <h1>
              Welcome back,{" "}
              {user?.full_name || "User"}
            </h1>

            <p className="dashboard-hero-text">
              {isLandlord
                ? "Manage your rental properties, connect with house hunters and keep your listings up to date."
                : "Discover your next home and communicate directly with property owners."}
            </p>
          </div>

          {isLandlord && (
            <Link
              to="/dashboard/add-property"
              className="dashboard-primary-action"
            >
              <span>＋</span>
              Add Property
            </Link>
          )}
        </section>

        {/* ERROR */}
        {error && (
          <div className="dashboard-error">
            <span>⚠️</span>
            <div>
              <strong>
                Something went wrong
              </strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* LANDLORD STATS */}
        {isLandlord && (
          <section className="dashboard-stats">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                🏠
              </div>

              <div>
                <strong>
                  {properties.length}
                </strong>

                <span>
                  Total listings
                </span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                ✓
              </div>

              <div>
                <strong>
                  {availableProperties}
                </strong>

                <span>
                  Available
                </span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                🛡️
              </div>

              <div>
                <strong>
                  {verifiedProperties}
                </strong>

                <span>
                  Verified
                </span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                💬
              </div>

              <div>
                <strong>
                  {conversations.length}
                </strong>

                <span>
                  Conversations
                </span>
              </div>
            </div>
          </section>
        )}

        {/* HOUSE HUNTER STATS */}
        {!isLandlord && (
          <section className="dashboard-stats dashboard-hunter-stats">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                🔎
              </div>

              <div>
                <strong>
                  Explore
                </strong>

                <span>
                  Available homes
                </span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                💬
              </div>

              <div>
                <strong>
                  {conversations.length}
                </strong>

                <span>
                  Conversations
                </span>
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-icon">
                🤝
              </div>

              <div>
                <strong>
                  Direct
                </strong>

                <span>
                  Landlord contact
                </span>
              </div>
            </div>
          </section>
        )}

        {/* QUICK ACTIONS */}
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="section-label">
                GET STARTED
              </span>

              <h2>
                Quick Actions
              </h2>

              <p>
                Everything you need is just one click away.
              </p>
            </div>
          </div>

          <div className="dashboard-action-grid">
            <Link
              to="/properties"
              className="dashboard-action-card"
            >
              <div className="dashboard-action-icon">
                🔎
              </div>

              <div>
                <h3>
                  Browse Properties
                </h3>

                <p>
                  Search homes by location, price and property type.
                </p>
              </div>

              <span className="dashboard-action-arrow">
                →
              </span>
            </Link>

            <Link
              to="/messages"
              className="dashboard-action-card"
            >
              <div className="dashboard-action-icon">
                💬
              </div>

              <div>
                <h3>
                  My Conversations
                </h3>

                <p>
                  View your conversations and reply to messages.
                </p>
              </div>

              <span className="dashboard-action-arrow">
                →
              </span>
            </Link>

            {isLandlord && (
              <Link
                to="/dashboard/add-property"
                className="dashboard-action-card"
              >
                <div className="dashboard-action-icon">
                  ➕
                </div>

                <div>
                  <h3>
                    Add Property
                  </h3>

                  <p>
                    Publish a new rental listing on NyumbaDirect.
                  </p>
                </div>

                <span className="dashboard-action-arrow">
                  →
                </span>
              </Link>
            )}
          </div>
        </section>

        {/* LANDLORD PROPERTY MANAGEMENT */}
        {isLandlord && (
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <span className="section-label">
                  MANAGEMENT
                </span>

                <h2>
                  Your Properties
                </h2>

                <p>
                  Manage and monitor your rental listings.
                </p>
              </div>

              <Link
                to="/dashboard/add-property"
                className="dashboard-section-link"
              >
                + Add Property
              </Link>
            </div>

            {/* PROPERTY SUMMARY */}
            {properties.length > 0 && (
              <div className="property-summary-bar">
                <div>
                  <span className="summary-dot summary-total" />
                  <strong>
                    {properties.length}
                  </strong>
                  <span>
                    Total
                  </span>
                </div>

                <div>
                  <span className="summary-dot summary-available" />
                  <strong>
                    {availableProperties}
                  </strong>
                  <span>
                    Available
                  </span>
                </div>

                <div>
                  <span className="summary-dot summary-unavailable" />
                  <strong>
                    {unavailableProperties}
                  </strong>
                  <span>
                    Unavailable
                  </span>
                </div>

                <div>
                  <span className="summary-dot summary-verified" />
                  <strong>
                    {verifiedProperties}
                  </strong>
                  <span>
                    Verified
                  </span>
                </div>
              </div>
            )}

            {properties.length === 0 ? (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-icon">
                  🏠
                </div>

                <h2>
                  Your property portfolio is empty
                </h2>

                <p>
                  Add your first rental property and start connecting with potential tenants.
                </p>

                <Link
                  to="/dashboard/add-property"
                  className="dashboard-primary-action"
                >
                  + Add Your First Property
                </Link>
              </div>
            ) : (
              <div className="dashboard-property-grid">
                {properties.map((property) => {
                  const photoUrl =
                    getPhotoUrl(property);

                  return (
                    <article
                      className="dashboard-property-card"
                      key={property.id}
                    >
                      <div className="dashboard-property-image">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={property.title}
                          />
                        ) : (
                          <div className="dashboard-property-placeholder">
                            🏡
                          </div>
                        )}

                        <div className="dashboard-property-status">
                          {property.is_available ? (
                            <span className="status-available">
                              ● Available
                            </span>
                          ) : (
                            <span className="status-unavailable">
                              ● Unavailable
                            </span>
                          )}
                        </div>

                        {property.is_verified && (
                          <span className="dashboard-property-verified">
                            ✓ Verified
                          </span>
                        )}
                      </div>

                      <div className="dashboard-property-content">
                        <div className="dashboard-property-type">
                          {formatPropertyType(
                            property.property_type
                          )}
                        </div>

                        <h3>
                          {property.title}
                        </h3>

                        <p className="dashboard-property-location">
                          📍 {formatLocation(property)}
                        </p>

                        <div className="dashboard-property-features">
                          <span>
                            🛏{" "}
                            {property.bedrooms ?? 0} Beds
                          </span>

                          <span>
                            🚿{" "}
                            {property.bathrooms ?? 0} Baths
                          </span>
                        </div>

                        <div className="dashboard-property-footer">
                          <div>
                            <strong>
                              KSh{" "}
                              {Number(
                                property.monthly_rent || 0
                              ).toLocaleString()}
                            </strong>

                            <span>
                              /month
                            </span>
                          </div>
                        </div>

                        <div className="dashboard-property-actions">
                          <Link
                            to={`/properties/${property.id}`}
                            className="property-view-action"
                          >
                            View
                          </Link>

                          <Link
                            to={`/dashboard/edit-property/${property.id}`}
                            className="property-edit-action"
                          >
                            Edit
                          </Link>

                          <button
                            type="button"
                            className="property-delete-action"
                            onClick={() =>
                              handleDelete(property.id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* CONVERSATIONS */}
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span className="section-label">
                COMMUNICATION
              </span>

              <h2>
                Recent Conversations
              </h2>

              <p>
                Keep track of your latest property conversations.
              </p>
            </div>

            <Link
              to="/messages"
              className="dashboard-section-link"
            >
              View All →
            </Link>
          </div>

          {conversations.length === 0 ? (
            <div className="dashboard-empty-state dashboard-empty-small">
              <div className="dashboard-empty-icon">
                💬
              </div>

              <h2>
                No conversations yet
              </h2>

              <p>
                {isLandlord
                  ? "Messages from interested house hunters will appear here."
                  : "Contact a landlord from a property listing to start a conversation."}
              </p>

              <Link
                to="/properties"
                className="dashboard-primary-action"
              >
                Browse Properties
              </Link>
            </div>
          ) : (
            <div className="dashboard-conversations-list">
              {conversations
                .slice(0, 5)
                .map((conversation) => {
                  const otherUser = isLandlord
                    ? conversation.house_hunter
                    : conversation.landlord;

                  const otherUserName =
                    otherUser?.full_name ||
                    "User";

                  const propertyTitle =
                    conversation.property?.title ||
                    "Property conversation";

                  return (
                    <Link
                      key={conversation.id}
                      to={`/messages/${conversation.id}`}
                      className="dashboard-conversation"
                    >
                      <div className="conversation-avatar-large">
                        {otherUserName
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="dashboard-conversation-info">
                        <strong>
                          {otherUserName}
                        </strong>

                        <span>
                          {propertyTitle}
                        </span>
                      </div>

                      <div className="dashboard-conversation-meta">
                        <span>
                          Open conversation
                        </span>

                        <strong>
                          →
                        </strong>
                      </div>
                    </Link>
                  );
                })}
            </div>
          )}
        </section>

        {/* ACCOUNT OVERVIEW */}
        <section className="dashboard-account-card">
          <div className="dashboard-account-icon">
            👤
          </div>

          <div className="dashboard-account-info">
            <span className="section-label">
              ACCOUNT
            </span>

            <h2>
              {user?.full_name || "Your Account"}
            </h2>

            <p>
              {user?.email}
            </p>

            <div className="account-meta">
              <span>
                {formatRole(user?.role)}
              </span>

              {user?.is_verified ? (
                <span className="account-verified">
                  ✓ Verified
                </span>
              ) : (
                <span className="account-unverified">
                  Verification pending
                </span>
              )}
            </div>
          </div>

          <Link
            to="/"
            className="dashboard-account-link"
          >
            Back to Home →
          </Link>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;