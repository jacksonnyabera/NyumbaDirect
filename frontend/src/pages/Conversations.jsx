import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Conversations() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let hasLoaded = false;

    const loadConversations = async (initial = false) => {
      if (!active || inFlight || document.visibilityState !== "visible") return;

      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate("/login");
        return;
      }

      inFlight = true;
      const firstLoad = !hasLoaded;
      try {
        if (initial) setLoading(true);
        const conversationsRequest = api.get("/messages/conversations", {
          params: { skip: 0, limit: 50 },
        });

        let conversationsResponse;
        if (firstLoad) {
          const [userResponse, response] = await Promise.all([
            api.get("/auth/me"),
            conversationsRequest,
          ]);
          if (!active) return;
          setUser(userResponse.data);
          conversationsResponse = response;
        } else {
          conversationsResponse = await conversationsRequest;
          if (!active) return;
        }

        const incoming = conversationsResponse.data?.items || [];
        setConversations((current) => {
          if (firstLoad || current.length === 0) return incoming;
          const merged = new Map(current.map((item) => [item.id, item]));
          incoming.forEach((item) => merged.set(item.id, item));
          return [...merged.values()].sort(
            (left, right) =>
              new Date(right.updated_at || right.created_at) -
              new Date(left.updated_at || left.created_at)
          );
        });
        setTotal(conversationsResponse.data?.total || 0);
        setError("");
        hasLoaded = true;
      } catch (err) {
        if (!active) return;
        console.error("Failed to load conversations:", err);

        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_id");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }

        setError(
          err.response?.data?.detail ||
            "Unable to load your conversations."
        );
      } finally {
        inFlight = false;
        if (initial && active) setLoading(false);
      }
    };

    loadConversations(true);
    const interval = window.setInterval(
      () => loadConversations(!hasLoaded),
      15000
    );
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        loadConversations(!hasLoaded);
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [navigate]);

  const loadMoreConversations = async () => {
    try {
      setLoadingMore(true);
      const response = await api.get("/messages/conversations", {
        params: { skip: conversations.length, limit: 50 },
      });
      setConversations((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...(response.data?.items || []).filter((item) => !knownIds.has(item.id))];
      });
      setTotal(response.data?.total || total);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load more conversations.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user");
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
    return name?.trim()?.charAt(0)?.toUpperCase() || "U";
  };

  const getPropertyTitle = (conversation) => {
    return conversation.property?.title || "Property conversation";
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

  const getContact = (conversation) => {
    if (conversation.contact) {
      return conversation.contact;
    }

    const otherUser = getOtherUser(conversation);

    return {
      name: otherUser?.full_name || "Property owner",
      role: isLandlord ? "House Hunter" : "Landlord",
      phone_number: otherUser?.phone_number || null,
    };
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
    const sameDay = date.toDateString() === now.toDateString();

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
          <p>We're getting your conversations ready.</p>
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
            <span className="section-label">COMMUNICATION</span>
            <h1>Your Messages</h1>
            <p>
              {isLandlord
                ? "Reply directly to house hunters interested in your properties."
                : "Ask landlords about homes you're interested in and get help from NyumbaDirect AI when available."}
            </p>
          </div>

          <Link
            to="/properties"
            className="conversations-browse-button"
          >
            🔎 Browse Properties
          </Link>
        </section>

        {!isLandlord && (
          <div className="conversation-ai-notice">
            <span className="conversation-ai-icon">🤖</span>
            <div>
              <strong>NyumbaDirect AI assistance</strong>
              <p>
                When the landlord or property manager has not replied yet,
                AI may provide listing guidance. It will always be labelled as
                AI and will direct you to call the property owner for current
                availability and viewing confirmation.
              </p>
            </div>
          </div>
        )}

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
              <div className="conversations-empty-icon">💬</div>
              <h2>No conversations yet</h2>
              <p>
                {isLandlord
                  ? "When house hunters contact you about your properties, their messages will appear here."
                  : "Find a property you're interested in, open it and contact the landlord directly."}
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
                const otherUserName = getOtherUserName(conversation);
                const contact = getContact(conversation);
                const property = conversation.property;

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
                        <strong>{otherUserName}</strong>
                        <span>
                          {formatDate(
                            conversation.updated_at ||
                              conversation.created_at
                          )}
                        </span>
                      </div>

                      <div className="conversation-property">
                        🏠 {getPropertyTitle(conversation)}
                      </div>

                      <div className="conversation-location">
                        📍 {getPropertyLocation(conversation)}
                      </div>

                      <div className="conversation-role">
                          {isLandlord ? "House hunter" : contact.role}
                      </div>

                      {conversation.unread_count > 0 && (
                        <div className="conversation-unread-count" aria-label={`${conversation.unread_count} unread messages`}>
                          {conversation.unread_count} unread
                        </div>
                      )}

                      {!isLandlord && contact.phone_number && (
                        <div className="conversation-phone">
                          📞 {contact.phone_number}
                        </div>
                      )}

                      {property?.monthly_rent != null && (
                        <div className="conversation-rent">
                          KSh {Number(property.monthly_rent).toLocaleString()}/month
                        </div>
                      )}
                    </div>

                    <div className="conversation-arrow">→</div>
                  </Link>
                );
              })}
            </div>
          )}

          {conversations.length < total && (
            <div className="conversations-load-more">
              <button
                type="button"
                onClick={loadMoreConversations}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more conversations"}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Conversations;
