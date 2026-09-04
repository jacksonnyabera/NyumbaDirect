import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Conversations() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadConversations = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [userResponse, conversationsResponse] =
          await Promise.all([
            api.get("/auth/me"),
            api.get("/messages/conversations"),
          ]);

        setUser(userResponse.data);
        setConversations(
          conversationsResponse.data || []
        );
      } catch (err) {
        console.error("Failed to load conversations:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_id");
          navigate("/login");
          return;
        }

        setError(
          err.response?.data?.detail ||
            "Unable to load your conversations."
        );
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    navigate("/login");
  };

  const isLandlord =
    user?.role?.toUpperCase() === "LANDLORD" ||
    user?.role?.toUpperCase() === "PROPERTY_MANAGER";

  const getOtherUser = (conversation) => {
    return isLandlord
      ? conversation.house_hunter
      : conversation.landlord;
  };

  const getOtherUserName = (conversation) => {
    const otherUser = getOtherUser(conversation);

    return otherUser?.full_name || "NyumbaDirect User";
  };

  const getInitial = (name) => {
    return (
      name?.trim()?.charAt(0)?.toUpperCase() || "U"
    );
  };

  const getPropertyTitle = (conversation) => {
    return (
      conversation.property?.title ||
      "Property conversation"
    );
  };

  const getPropertyLocation = (conversation) => {
    const property = conversation.property;

    if (!property) {
      return "Property";
    }

    const location = [
      property.area,
      property.town,
      property.county,
    ].filter(Boolean);

    return location.length
      ? location.join(", ")
      : "Location not specified";
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = new Date();

    const sameDay =
      date.toDateString() === now.toDateString();

    if (sameDay) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year:
        date.getFullYear() !== now.getFullYear()
          ? "numeric"
          : undefined,
    });
  };

  if (loading) {
    return (
      <div className="conversations-page">
        <div className="conversations-loading">
          <div className="conversations-spinner" />
          <h2>Loading your messages...</h2>
          <p>
            We're getting your conversations ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversations-page">
      <nav className="navbar">
        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/properties">Properties</Link>
          <Link to="/dashboard">Dashboard</Link>

          <Link
            to="/messages"
            className="active-nav-link"
          >
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

      <main className="conversations-container">
        <section className="conversations-header">
          <div>
            <span className="section-label">
              COMMUNICATION
            </span>

            <h1>Your Messages</h1>

            <p>
              Communicate directly with{" "}
              {isLandlord
                ? "house hunters interested in your properties."
                : "landlords about homes you're interested in."}
            </p>
          </div>

          <Link
            to="/properties"
            className="conversations-browse-button"
          >
            🔎 Browse Properties
          </Link>
        </section>

        {error && (
          <div className="conversations-error">
            <span>⚠️</span>
            <div>
              <strong>Something went wrong</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <section className="conversations-card">
          <div className="conversations-card-header">
            <div>
              <h2>Conversations</h2>
              <span>
                {conversations.length}{" "}
                {conversations.length === 1
                  ? "conversation"
                  : "conversations"}
              </span>
            </div>
          </div>

          {conversations.length === 0 ? (
            <div className="conversations-empty">
              <div className="conversations-empty-icon">
                💬
              </div>

              <h2>No conversations yet</h2>

              <p>
                {isLandlord
                  ? "When house hunters contact you about your properties, your conversations will appear here."
                  : "Find a property you're interested in and contact the landlord directly."}
              </p>

              <Link
                to="/properties"
                className="conversations-empty-button"
              >
                Explore Properties
              </Link>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conversation) => {
                const otherUserName =
                  getOtherUserName(conversation);

                return (
                  <Link
                    key={conversation.id}
                    to={`/messages/${conversation.id}`}
                    className="conversation-row"
                  >
                    <div className="conversation-avatar">
                      {getInitial(otherUserName)}
                    </div>

                    <div className="conversation-main">
                      <div className="conversation-top">
                        <strong>
                          {otherUserName}
                        </strong>

                        <span>
                          {formatDate(
                            conversation.updated_at ||
                              conversation.created_at
                          )}
                        </span>
                      </div>

                      <div className="conversation-property">
                        🏠{" "}
                        {getPropertyTitle(
                          conversation
                        )}
                      </div>

                      <div className="conversation-location">
                        📍{" "}
                        {getPropertyLocation(
                          conversation
                        )}
                      </div>

                      <div className="conversation-role">
                        {isLandlord
                          ? "House hunter"
                          : "Property owner"}
                      </div>
                    </div>

                    <div className="conversation-arrow">
                      →
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Conversations;