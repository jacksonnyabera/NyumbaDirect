import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { API_BASE_URL } from "../services/api";
import useFavorites from "../hooks/useFavorites";
import { getBedroomDisplay, isPropertyBoostActive } from "../utils/propertyDisplay";

function Properties() {
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");

  const { favoriteIds: favorites, toggleFavorite, error: favoritesError } = useFavorites();

  useEffect(() => {
    const controller = new AbortController();
    const slowTimer = window.setTimeout(() => setSlowLoading(true), 12000);
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setSlowLoading(false);
        setError("");

        const response = await api.get("/properties", {
          params: {
            search: search.trim() || undefined,
            property_type: propertyType || undefined,
            min_bedrooms: bedrooms || undefined,
            max_rent: maxRent || undefined,
            verified_only: verifiedOnly || undefined,
            skip: 0,
            limit: 24,
          },
          signal: controller.signal,
        });

        const data = Array.isArray(response.data)
          ? response.data
          : response.data.items || [];

        setProperties(data);
        setTotal(response.data.total ?? data.length);
      } catch (err) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error(err);
          setError(
            err.response?.data?.detail ||
              (err.code === "ECONNABORTED"
                ? "The property service took too long to respond. Please try again."
                : "Failed to load properties. Please try again.")
          );
        }
      } finally {
        window.clearTimeout(slowTimer);
        if (!controller.signal.aborted) {
          setLoading(false);
          setSlowLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(slowTimer);
      controller.abort();
    };
  }, [search, propertyType, bedrooms, maxRent, verifiedOnly, retryCount]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      setError("");
      const response = await api.get("/properties", {
        params: {
          search: search.trim() || undefined,
          property_type: propertyType || undefined,
          min_bedrooms: bedrooms || undefined,
          max_rent: maxRent || undefined,
          verified_only: verifiedOnly || undefined,
          skip: properties.length,
          limit: 24,
        },
      });
      const items = response.data?.items || [];
      setProperties((current) => [...current, ...items]);
      setTotal(response.data?.total ?? total);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load more homes. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredProperties = [...properties].sort((first, second) => {
    const boostDifference = Number(isPropertyBoostActive(second)) - Number(isPropertyBoostActive(first));
    if (boostDifference) return boostDifference;

    if (sortBy === "rent-low") {
      return Number(first.monthly_rent || 0) - Number(second.monthly_rent || 0);
    }
    if (sortBy === "rent-high") {
      return Number(second.monthly_rent || 0) - Number(first.monthly_rent || 0);
    }
    if (sortBy === "newest") {
      return Date.parse(second.created_at || "") - Date.parse(first.created_at || "");
    }
    return 0;
  });

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

    return `${API_BASE_URL}${photo.image_url}`;
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
              RENTAL MARKETPLACE · KENYA
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
        </header>

        {/* SEARCH PANEL */}

        <section className="marketplace-search">

          <div className="main-search">

            <span className="search-icon">
              Search
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
                Verified listings
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
            <div className="marketplace-results-count">
              <strong>{total.toLocaleString()}</strong>
              <span>{total === 1 ? " home found" : " homes found"}</span>
            </div>

            <div className="marketplace-result-tools">
              <label htmlFor="marketplace-sort">Sort by</label>
              <select
                id="marketplace-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="newest">Newest</option>
                <option value="rent-low">Rent: low to high</option>
                <option value="rent-high">Rent: high to low</option>
              </select>

              {activeFilters && (
                <button
                  type="button"
                  className="results-clear"
                  onClick={clearFilters}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* LOADING */}

        {loading && (
          <div className="marketplace-status">

            <div className="loading-spinner" />

            <h2>Finding homes...</h2>

            <p>
              {slowLoading
                ? "The property service is taking longer than usual. You can keep waiting or retry the search."
                : "We're loading the latest available properties."}
            </p>

            {slowLoading && (
              <button
                type="button"
                className="retry-button"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                Retry search
              </button>
            )}

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

        {favoritesError && (
          <div className="marketplace-status error-state" role="alert">
            <p>{favoritesError}</p>
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
                            No photos added yet
                          </small>
                        </div>
                      )}

                      <div className="image-overlay" />

                      <div className="card-badges">

                        {isPropertyBoostActive(property) && (
                          <span className="featured-badge">
                            Boosted listing
                          </span>
                        )}

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
                        aria-pressed={isFavorite}
                        title={isFavorite ? "Remove from saved homes" : "Save this home"}
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

                        <span>🛏 {getBedroomDisplay(property).summary}</span>

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

        {!loading &&
          !error &&
          properties.length < total && (
            <div className="marketplace-load-more">
              <button
                type="button"
                className="retry-button"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading more homes…" : "Load more homes"}
              </button>
            </div>
          )}

        {!loading && !error && (
          <section className="properties-seo-intro">
            <h2>Rental homes across Kenya</h2>
            <p>
              Search houses, apartments, bedsitters and studios by location, monthly rent,
              bedrooms and property type. Contact landlords and property managers directly
              through NyumbaDirect.
            </p>
            <p>
              Browse homes in Nairobi, Mombasa, Kisumu and other towns. Confirm property
              details and availability with the owner before making any payment.
            </p>
          </section>
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
