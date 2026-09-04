import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = "http://127.0.0.1:8000";
const FAVORITES_KEY = "nyumbadirect_favorites";

function SavedHomes() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const getFavorites = () => {
    try {
      const saved =
        localStorage.getItem(FAVORITES_KEY);

      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const loadSavedHomes = async () => {
    try {
      setLoading(true);

      const favoriteIds = getFavorites();

      if (!favoriteIds.length) {
        setProperties([]);
        return;
      }

      const response = await fetch(
        `${API_URL}/properties?limit=100`
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load properties."
        );
      }

      const data = await response.json();

      const allProperties =
        Array.isArray(data)
          ? data
          : data.items || [];

      const favoriteProperties =
        allProperties.filter((property) =>
          favoriteIds.includes(
            Number(property.id)
          )
        );

      setProperties(favoriteProperties);
    } catch (error) {
      console.error(
        "Failed to load saved homes:",
        error
      );
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedHomes();
  }, []);

  const removeFavorite = (propertyId) => {
    const currentFavorites = getFavorites();

    const updatedFavorites =
      currentFavorites.filter(
        (id) => Number(id) !== Number(propertyId)
      );

    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(updatedFavorites)
    );

    setProperties((currentProperties) =>
      currentProperties.filter(
        (property) =>
          Number(property.id) !==
          Number(propertyId)
      )
    );
  };

  const clearAllFavorites = () => {
    const confirmed = window.confirm(
      "Remove all saved homes?"
    );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem(FAVORITES_KEY);
    setProperties([]);
  };

  const getPhotoUrl = (property) => {
    const photos = property?.photos || [];

    if (!photos.length) {
      return null;
    }

    const photo =
      photos.find(
        (item) => item.is_primary
      ) || photos[0];

    if (!photo?.image_url) {
      return null;
    }

    if (
      photo.image_url.startsWith("http")
    ) {
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

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem("user_id");

    navigate("/login");
  };

  return (
    <div className="saved-homes-page">

      <nav className="navbar">
        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>

          <Link to="/properties">
            Properties
          </Link>

          <Link to="/dashboard">
            Dashboard
          </Link>

          <Link
            to="/saved-homes"
            className="active-nav-link"
          >
            Saved Homes
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

      <main className="saved-homes-container">

        <section className="saved-homes-header">

          <div>
            <span className="section-label">
              YOUR COLLECTION
            </span>

            <h1>Saved Homes</h1>

            <p>
              Keep track of properties you're
              interested in and come back to them
              anytime.
            </p>
          </div>

          <Link
            to="/properties"
            className="saved-browse-button"
          >
            🔎 Find More Homes
          </Link>

        </section>

        {loading ? (
          <div className="saved-homes-loading">
            <div className="saved-homes-spinner" />

            <h2>
              Loading your saved homes...
            </h2>

            <p>
              We're preparing your collection.
            </p>
          </div>
        ) : properties.length === 0 ? (
          <section className="saved-homes-empty">

            <div className="saved-homes-empty-icon">
              ♡
            </div>

            <h2>
              No saved homes yet
            </h2>

            <p>
              When you find a property you like,
              tap the heart icon to save it here.
            </p>

            <Link
              to="/properties"
              className="saved-empty-button"
            >
              Explore Properties
            </Link>

          </section>
        ) : (
          <section>

            <div className="saved-homes-toolbar">

              <div>
                <strong>
                  {properties.length}
                </strong>{" "}
                {properties.length === 1
                  ? "saved home"
                  : "saved homes"}
              </div>

              <button
                type="button"
                onClick={clearAllFavorites}
                className="clear-saved-button"
              >
                Clear All
              </button>

            </div>

            <div className="saved-homes-grid">

              {properties.map((property) => {
                const photoUrl =
                  getPhotoUrl(property);

                return (
                  <article
                    className="saved-home-card"
                    key={property.id}
                  >

                    <div className="saved-home-image">

                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={property.title}
                        />
                      ) : (
                        <div className="saved-home-placeholder">
                          🏡
                        </div>
                      )}

                      {property.is_verified && (
                        <span className="saved-verified-badge">
                          ✓ Verified
                        </span>
                      )}

                      <button
                        type="button"
                        className="saved-remove-button"
                        onClick={() =>
                          removeFavorite(
                            property.id
                          )
                        }
                        aria-label="Remove saved home"
                        title="Remove saved home"
                      >
                        ♥
                      </button>

                    </div>

                    <div className="saved-home-content">

                      <span className="saved-home-type">
                        {formatPropertyType(
                          property.property_type
                        )}
                      </span>

                      <h2>
                        {property.title}
                      </h2>

                      <p className="saved-home-location">
                        📍{" "}
                        {formatLocation(
                          property
                        )}
                      </p>

                      <div className="saved-home-features">
                        <span>
                          🛏{" "}
                          {property.bedrooms ?? 0}{" "}
                          Beds
                        </span>

                        <span>
                          🚿{" "}
                          {property.bathrooms ?? 0}{" "}
                          Baths
                        </span>
                      </div>

                      <div className="saved-home-bottom">

                        <div>
                          <strong>
                            KSh{" "}
                            {Number(
                              property.monthly_rent ||
                                0
                            ).toLocaleString()}
                          </strong>

                          <span>
                            /month
                          </span>
                        </div>

                        <Link
                          to={`/properties/${property.id}`}
                          className="saved-view-button"
                        >
                          View Home →
                        </Link>

                      </div>

                    </div>

                  </article>
                );
              })}

            </div>

          </section>
        )}

      </main>
    </div>
  );
}

export default SavedHomes;