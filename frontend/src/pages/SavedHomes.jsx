import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "../components/Navigation";
import api, { API_BASE_URL } from "../services/api";
import useFavorites from "../hooks/useFavorites";
import { getBedroomDisplay } from "../utils/propertyDisplay";
import Icon from "../components/Icon.jsx";

function SavedHomes() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const { favoriteIds, toggleFavorite, clearFavorites, error: favoritesError } = useFavorites();


  const loadSavedHomes = useCallback(async () => {
    try {
      if (!favoriteIds.length) {
        setProperties([]);
        return;
      }

      let favoriteProperties;
      if (localStorage.getItem("access_token")) {
        const response = await api.get("/favorites");
        favoriteProperties = (response.data || [])
          .map((favorite) => favorite.property)
          .filter(Boolean);
      } else {
        const response = await api.get("/properties", {
          params: { limit: 100 },
        });
        const data = response.data;
        const allProperties = Array.isArray(data) ? data : data.items || [];
        favoriteProperties = allProperties.filter((property) =>
          favoriteIds.includes(Number(property.id))
        );
      }

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
  }, [favoriteIds]);

  useEffect(() => {
    loadSavedHomes();
  }, [loadSavedHomes]);

  const removeFavorite = async (propertyId) => {
    if (!(await toggleFavorite(propertyId))) return;
    setProperties((currentProperties) =>
      currentProperties.filter((property) => Number(property.id) !== Number(propertyId))
    );
  };

  const clearAllFavorites = async () => {
    const confirmed = window.confirm(
      "Remove all saved homes?"
    );

    if (!confirmed) {
      return;
    }

    if (await clearFavorites()) setProperties([]);
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

    return `${API_BASE_URL}${photo.image_url}`;
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


  return (
    <div className="saved-homes-page">

      <Navigation />

      <main id="main-content" tabIndex="-1" className="saved-homes-container">

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
            <Icon name="search" /> Find More Homes
          </Link>

        </section>

        {favoritesError && <p role="alert" className="saved-homes-error">{favoritesError}</p>}

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
              <Icon name="heart" />
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
                          <Icon name="home" />
                        </div>
                      )}

                      {property.is_verified && (
                        <span className="saved-verified-badge">
                          <Icon name="check" /> Verified
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
                        <Icon name="heart" filled />
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
                        <Icon name="pin" />{" "}
                        {formatLocation(
                          property
                        )}
                      </p>

                      <div className="saved-home-features">
                        <span><Icon name="bed" /> {getBedroomDisplay(property).summary}</span>

                        <span>
                          <Icon name="bath" />{" "}
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
