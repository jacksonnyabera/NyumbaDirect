import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const API_URL = "http://127.0.0.1:8000";

function Properties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("nyumbadirect_favorites") || "[]"
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const loadProperties = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/properties");

        const data = Array.isArray(response.data)
          ? response.data
          : response.data.items || [];

        setProperties(data);
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data?.detail ||
            "Failed to load properties. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProperties();
  }, []);

  const toggleFavorite = (propertyId) => {
    setFavorites((previous) => {
      const updated = previous.includes(propertyId)
        ? previous.filter((id) => id !== propertyId)
        : [...previous, propertyId];

      localStorage.setItem(
        "nyumbadirect_favorites",
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchText = search.toLowerCase().trim();

      const matchesSearch =
        !searchText ||
        property.title?.toLowerCase().includes(searchText) ||
        property.county?.toLowerCase().includes(searchText) ||
        property.town?.toLowerCase().includes(searchText) ||
        property.area?.toLowerCase().includes(searchText) ||
        property.property_type?.toLowerCase().includes(searchText);

      const matchesType =
        !propertyType ||
        property.property_type === propertyType;

      const matchesBedrooms =
        !bedrooms ||
        Number(property.bedrooms) >= Number(bedrooms);

      const matchesRent =
        !maxRent ||
        Number(property.monthly_rent) <= Number(maxRent);

      const matchesVerified =
        !verifiedOnly || property.is_verified;

      return (
        matchesSearch &&
        matchesType &&
        matchesBedrooms &&
        matchesRent &&
        matchesVerified
      );
    });
  }, [
    properties,
    search,
    propertyType,
    bedrooms,
    maxRent,
    verifiedOnly,
  ]);

  const clearFilters = () => {
    setSearch("");
    setPropertyType("");
    setBedrooms("");
    setMaxRent("");
    setVerifiedOnly(false);
  };

  const activeFilters =
    Boolean(search) ||
    Boolean(propertyType) ||
    Boolean(bedrooms) ||
    Boolean(maxRent) ||
    verifiedOnly;

  const getPropertyPhoto = (property) => {
    const primaryPhoto = property.photos?.find(
      (photo) => photo.is_primary
    );

    const photo = primaryPhoto || property.photos?.[0];

    if (!photo?.image_url) {
      return null;
    }

    if (photo.image_url.startsWith("http")) {
      return photo.image_url;
    }

    return `${API_URL}${photo.image_url}`;
  };

  const formatPropertyType = (type) => {
    if (!type) return "Property";

    return type
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  return (
    <div className="properties-page">

      <div className="properties-container">

        {/* PAGE HEADER */}

        <header className="marketplace-header">

          <div className="marketplace-heading">

            <span className="eyebrow">
              🏠 NYUMBADIRECT MARKETPLACE
            </span>

            <h1>
              Find a home
              <span> you'll love.</span>
            </h1>

            <p>
              Browse rental properties and connect directly
              with landlords and property managers.
            </p>

          </div>

          <div className="marketplace-header-actions">

            <Link
              to="/messages"
              className="marketplace-link"
            >
              💬 Messages
            </Link>

            <Link
              to="/dashboard"
              className="marketplace-link"
            >
              Dashboard
            </Link>

          </div>

        </header>

        {/* SEARCH PANEL */}

        <section className="marketplace-search">

          <div className="main-search">

            <span className="search-icon">
              🔍
            </span>

            <input
              type="text"
              placeholder="Search by town, area, county or property name..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            {search && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}

          </div>

          <div className="filter-row">

            <select
              value={propertyType}
              onChange={(event) =>
                setPropertyType(event.target.value)
              }
              aria-label="Property type"
            >
              <option value="">
                All property types
              </option>

              <option value="APARTMENT">
                Apartment
              </option>

              <option value="HOUSE">
                House
              </option>

              <option value="BEDSITTER">
                Bedsitter
              </option>

              <option value="STUDIO">
                Studio
              </option>

              <option value="MAISONETTE">
                Maisonette
              </option>
            </select>

            <select
              value={bedrooms}
              onChange={(event) =>
                setBedrooms(event.target.value)
              }
              aria-label="Bedrooms"
            >
              <option value="">
                Any bedrooms
              </option>

              <option value="1">
                1+ bedroom
              </option>

              <option value="2">
                2+ bedrooms
              </option>

              <option value="3">
                3+ bedrooms
              </option>

              <option value="4">
                4+ bedrooms
              </option>
            </select>

            <select
              value={maxRent}
              onChange={(event) =>
                setMaxRent(event.target.value)
              }
              aria-label="Maximum rent"
            >
              <option value="">
                Any rent
              </option>

              <option value="10000">
                Up to KSh 10,000
              </option>

              <option value="15000">
                Up to KSh 15,000
              </option>

              <option value="20000">
                Up to KSh 20,000
              </option>

              <option value="30000">
                Up to KSh 30,000
              </option>

              <option value="50000">
                Up to KSh 50,000
              </option>

              <option value="100000">
                Up to KSh 100,000
              </option>
            </select>

            <label className="verified-filter">

              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) =>
                  setVerifiedOnly(event.target.checked)
                }
              />

              <span>
                ✓ Verified only
              </span>

            </label>

            {activeFilters && (
              <button
                type="button"
                className="clear-marketplace"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}

          </div>

        </section>

        {/* RESULTS BAR */}

        {!loading && !error && (
          <div className="marketplace-results-bar">

            <div>
              <strong>
                {filteredProperties.length}
              </strong>{" "}
              {filteredProperties.length === 1
                ? "home"
                : "homes"}{" "}
              found
            </div>

            {activeFilters && (
              <button
                type="button"
                className="results-clear"
                onClick={clearFilters}
              >
                Reset search
              </button>
            )}

          </div>
        )}

        {/* LOADING */}

        {loading && (
          <div className="marketplace-status">

            <div className="loading-spinner" />

            <h2>Finding homes...</h2>

            <p>
              We're loading the latest available properties.
            </p>

          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="marketplace-status error-state">

            <div className="status-icon">
              ⚠️
            </div>

            <h2>
              Unable to load properties
            </h2>

            <p>{error}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="retry-button"
            >
              Try again
            </button>

          </div>
        )}

        {/* EMPTY */}

        {!loading &&
          !error &&
          filteredProperties.length === 0 && (
            <div className="marketplace-status">

              <div className="status-icon">
                🏠
              </div>

              <h2>
                No homes found
              </h2>

              <p>
                We couldn't find properties matching
                your current search.
              </p>

              <button
                type="button"
                className="retry-button"
                onClick={clearFilters}
              >
                Clear all filters
              </button>

            </div>
          )}

        {/* PROPERTY GRID */}

        {!loading &&
          !error &&
          filteredProperties.length > 0 && (
            <div className="marketplace-grid">

              {filteredProperties.map((property) => {

                const photoUrl =
                  getPropertyPhoto(property);

                const isFavorite =
                  favorites.includes(property.id);

                return (
                  <article
                    className="marketplace-card"
                    key={property.id}
                  >

                    {/* IMAGE */}

                    <div className="marketplace-card-image">

                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={property.title}
                          loading="lazy"
                        />
                      ) : (
                        <div className="property-image-placeholder">
                          <span>🏡</span>
                          <small>
                            Property photo unavailable
                          </small>
                        </div>
                      )}

                      <div className="image-overlay" />

                      <div className="card-badges">

                        {property.is_verified && (
                          <span className="verified-badge">
                            ✓ Verified
                          </span>
                        )}

                        {!property.is_available && (
                          <span className="unavailable-badge">
                            Unavailable
                          </span>
                        )}

                      </div>

                      <button
                        type="button"
                        className={`favorite-button ${
                          isFavorite
                            ? "favorite-active"
                            : ""
                        }`}
                        onClick={() =>
                          toggleFavorite(property.id)
                        }
                        aria-label={
                          isFavorite
                            ? "Remove from favorites"
                            : "Add to favorites"
                        }
                      >
                        {isFavorite ? "♥" : "♡"}
                      </button>

                    </div>

                    {/* CONTENT */}

                    <div className="marketplace-card-content">

                      <div className="card-type-row">

                        <span className="property-type-label">
                          {formatPropertyType(
                            property.property_type
                          )}
                        </span>

                        {property.is_available && (
                          <span className="available-label">
                            ● Available
                          </span>
                        )}

                      </div>

                      <h2 className="marketplace-card-title">
                        {property.title}
                      </h2>

                      <p className="marketplace-location">
                        <span>📍</span>

                        <span>
                          {[
                            property.area,
                            property.town,
                            property.county,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                            "Location available on request"}
                        </span>
                      </p>

                      <div className="marketplace-specs">

                        <span>
                          🛏{" "}
                          {property.bedrooms ?? 0}
                          <small>
                            {" "}
                            beds
                          </small>
                        </span>

                        <span>
                          🚿{" "}
                          {property.bathrooms ?? 0}
                          <small>
                            {" "}
                            baths
                          </small>
                        </span>

                        {property.deposit && (
                          <span>
                            💳 Deposit
                          </span>
                        )}

                      </div>

                      <div className="marketplace-card-footer">

                        <div className="marketplace-price">

                          <strong>
                            KSh{" "}
                            {Number(
                              property.monthly_rent || 0
                            ).toLocaleString()}
                          </strong>

                          <span>
                            / month
                          </span>

                        </div>

                        <Link
                          to={`/properties/${property.id}`}
                          className="view-home-button"
                        >
                          View Home
                          <span>→</span>
                        </Link>

                      </div>

                    </div>

                  </article>
                );
              })}

            </div>
          )}

        {/* BOTTOM TRUST STRIP */}

        {!loading &&
          !error &&
          filteredProperties.length > 0 && (
            <div className="marketplace-trust-strip">

              <div>
                <span>✓</span>

                <div>
                  <strong>
                    Direct connections
                  </strong>

                  <small>
                    Talk directly to property owners.
                  </small>
                </div>
              </div>

              <div>
                <span>🔒</span>

                <div>
                  <strong>
                    Safer house hunting
                  </strong>

                  <small>
                    Review property information before contacting.
                  </small>
                </div>
              </div>

              <div>
                <span>💬</span>

                <div>
                  <strong>
                    Built-in messaging
                  </strong>

                  <small>
                    Keep conversations inside NyumbaDirect.
                  </small>
                </div>
              </div>

            </div>
          )}

      </div>
    </div>
  );
}

export default Properties;
