import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const API_URL = "http://127.0.0.1:8000";

function PropertyDetails() {
  const { propertyId } = useParams();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [contacting, setContacting] = useState(false);

  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("nyumbadirect_favorites") || "[]"
      );

      return saved.includes(Number(propertyId));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const loadProperty = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/properties/${propertyId}`
        );

        const data = response.data;

        setProperty(data);

        if (data.photos?.length > 0) {
          const primaryPhoto =
            data.photos.find(
              (photo) => photo.is_primary
            ) || data.photos[0];

          setSelectedPhoto(primaryPhoto);
        }
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data?.detail ||
            "Failed to load property."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [propertyId]);

  const toggleFavorite = () => {
    const id = Number(propertyId);

    try {
      const saved = JSON.parse(
        localStorage.getItem("nyumbadirect_favorites") || "[]"
      );

      const updated = saved.includes(id)
        ? saved.filter((favoriteId) => favoriteId !== id)
        : [...saved, id];

      localStorage.setItem(
        "nyumbadirect_favorites",
        JSON.stringify(updated)
      );

      setIsFavorite(updated.includes(id));
    } catch {
      setIsFavorite((previous) => !previous);
    }
  };

  const handleContactLandlord = async () => {
    try {
      setContacting(true);

      const token = localStorage.getItem("access_token");

      if (!token) {
        const shouldLogin = window.confirm(
          "You need to log in before contacting the landlord. Go to login?"
        );

        if (shouldLogin) {
          navigate("/login");
        }

        return;
      }

      const response = await api.post(
        "/messages/conversations",
        {
          property_id: property.id,
        }
      );

      const conversationId = response.data.id;

      navigate(`/messages/${conversationId}`);
    } catch (err) {
      console.error(
        "Failed to start conversation:",
        err
      );

      alert(
        err.response?.data?.detail ||
          "Unable to start conversation."
      );
    } finally {
      setContacting(false);
    }
  };

  const getPhotoUrl = (photo) => {
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

  const formatRole = (role) => {
    if (!role) {
      return "Property Owner";
    }

    return role
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  if (loading) {
    return (
      <div className="property-details-page">
        <div className="property-details-container">
          <div className="details-status-page">
            <div className="details-loading-spinner" />
            <h2>Loading property...</h2>
            <p>
              We're getting the property information ready.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="property-details-page">
        <div className="property-details-container">
          <div className="details-status-page">
            <div className="details-status-icon">
              ⚠️
            </div>

            <h2>
              Unable to load property
            </h2>

            <p>{error}</p>

            <Link
              to="/properties"
              className="details-primary-button"
            >
              ← Back to properties
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="property-details-page">
        <div className="property-details-container">
          <div className="details-status-page">
            <div className="details-status-icon">
              🏠
            </div>

            <h2>
              Property not found
            </h2>

            <p>
              This property may have been removed or is no
              longer available.
            </p>

            <Link
              to="/properties"
              className="details-primary-button"
            >
              ← Browse properties
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const photos = property.photos || [];

  const selectedPhotoUrl =
    getPhotoUrl(selectedPhoto);

  const ownerName =
    property.owner?.full_name ||
    property.owner?.name ||
    "Property Owner";

  const ownerRole =
    property.owner?.role ||
    "PROPERTY OWNER";

  const locationParts = [
    property.area,
    property.town,
    property.county,
  ].filter(Boolean);

  const locationText =
    locationParts.length > 0
      ? locationParts.join(", ")
      : "Location available on request";

  return (
    <div className="property-details-page">

      <div className="property-details-container">

        {/* TOP NAVIGATION */}

        <div className="details-topbar">

          <Link
            to="/properties"
            className="details-back-link"
          >
            ← Back to properties
          </Link>

          <button
            type="button"
            className={`details-favorite-button ${
              isFavorite
                ? "details-favorite-active"
                : ""
            }`}
            onClick={toggleFavorite}
          >
            <span>
              {isFavorite ? "♥" : "♡"}
            </span>

            {isFavorite
              ? "Saved"
              : "Save property"}
          </button>

        </div>

        {/* GALLERY */}

        <section className="details-gallery-section">

          <div className="details-main-image">

            {selectedPhotoUrl ? (
              <img
                src={selectedPhotoUrl}
                alt={
                  selectedPhoto?.caption ||
                  property.title
                }
              />
            ) : (
              <div className="details-image-placeholder">
                <span>🏡</span>
                <strong>
                  Property photo unavailable
                </strong>
                <small>
                  Contact the owner for more information.
                </small>
              </div>
            )}

            <div className="details-image-badges">

              {property.is_verified && (
                <span className="details-verified-badge">
                  ✓ Verified property
                </span>
              )}

              {property.is_available && (
                <span className="details-available-badge">
                  ● Available
                </span>
              )}

            </div>

            {photos.length > 1 && (
              <div className="details-photo-count">
                📷 {photos.length} photos
              </div>
            )}

          </div>

          {photos.length > 0 && (
            <div className="details-thumbnails">

              {photos.map((photo) => {

                const thumbnailUrl =
                  getPhotoUrl(photo);

                return (
                  <button
                    key={photo.id}
                    type="button"
                    className={`details-thumbnail ${
                      selectedPhoto?.id === photo.id
                        ? "details-thumbnail-active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedPhoto(photo)
                    }
                  >
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={
                          photo.caption ||
                          "Property thumbnail"
                        }
                      />
                    ) : (
                      <span>🏡</span>
                    )}
                  </button>
                );
              })}

            </div>
          )}

        </section>

        {/* MAIN CONTENT */}

        <div className="details-layout">

          <main className="details-main-content">

            {/* TITLE */}

            <section className="details-title-section">

              <div className="details-title-top">

                <div>

                  <span className="details-property-type">
                    {formatPropertyType(
                      property.property_type
                    )}
                  </span>

                  <h1>
                    {property.title}
                  </h1>

                  <p className="details-location">
                    📍 {locationText}
                  </p>

                </div>

                <div className="details-status-badges">

                  {property.is_verified && (
                    <span className="details-inline-verified">
                      ✓ Verified
                    </span>
                  )}

                  {property.is_available ? (
                    <span className="details-inline-available">
                      Available
                    </span>
                  ) : (
                    <span className="details-inline-unavailable">
                      Not available
                    </span>
                  )}

                </div>

              </div>

            </section>

            {/* QUICK FACTS */}

            <section className="details-facts">

              <div className="details-fact">

                <span className="details-fact-icon">
                  🛏
                </span>

                <div>
                  <strong>
                    {property.bedrooms ?? 0}
                  </strong>

                  <small>
                    Bedrooms
                  </small>
                </div>

              </div>

              <div className="details-fact">

                <span className="details-fact-icon">
                  🚿
                </span>

                <div>
                  <strong>
                    {property.bathrooms ?? 0}
                  </strong>

                  <small>
                    Bathrooms
                  </small>
                </div>

              </div>

              <div className="details-fact">

                <span className="details-fact-icon">
                  🏠
                </span>

                <div>
                  <strong>
                    {formatPropertyType(
                      property.property_type
                    )}
                  </strong>

                  <small>
                    Property type
                  </small>
                </div>

              </div>

              <div className="details-fact">

                <span className="details-fact-icon">
                  📍
                </span>

                <div>
                  <strong>
                    {property.town ||
                      property.county ||
                      "Kenya"}
                  </strong>

                  <small>
                    Location
                  </small>
                </div>

              </div>

            </section>

            {/* DESCRIPTION */}

            <section className="details-content-section">

              <h2>
                About this property
              </h2>

              <p className="details-description">
                {property.description ||
                  "No detailed description has been provided for this property yet."}
              </p>

            </section>

            {/* LOCATION */}

            <section className="details-content-section">

              <h2>
                Location
              </h2>

              <div className="details-location-box">

                <div className="details-location-icon">
                  📍
                </div>

                <div>

                  <strong>
                    {locationText}
                  </strong>

                  {property.address && (
                    <p>
                      {property.address}
                    </p>
                  )}

                </div>

              </div>

            </section>

            {/* PROPERTY INFORMATION */}

            <section className="details-content-section">

              <h2>
                Property information
              </h2>

              <div className="details-information-grid">

                <div>
                  <span>
                    Property type
                  </span>

                  <strong>
                    {formatPropertyType(
                      property.property_type
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Bedrooms
                  </span>

                  <strong>
                    {property.bedrooms ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Bathrooms
                  </span>

                  <strong>
                    {property.bathrooms ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Availability
                  </span>

                  <strong>
                    {property.is_available
                      ? "Available"
                      : "Not available"}
                  </strong>
                </div>

              </div>

            </section>

            {/* TRUST */}

            <section className="details-trust-section">

              <div className="trust-section-heading">
                <span>🛡️</span>

                <div>
                  <h2>
                    House hunting with confidence
                  </h2>

                  <p>
                    Review the property information
                    carefully before making arrangements.
                  </p>
                </div>
              </div>

              <div className="details-trust-grid">

                <div>
                  <strong>
                    ✓ Check the property
                  </strong>

                  <p>
                    Confirm the property details and
                    availability with the owner.
                  </p>
                </div>

                <div>
                  <strong>
                    ✓ Communicate directly
                  </strong>

                  <p>
                    Use NyumbaDirect messaging to discuss
                    the property before visiting.
                  </p>
                </div>

                <div>
                  <strong>
                    ✓ Verify before paying
                  </strong>

                  <p>
                    Never send money before confirming the
                    property and rental arrangement.
                  </p>
                </div>

              </div>

            </section>

          </main>

          {/* SIDEBAR */}

          <aside className="details-sidebar">

            {/* PRICE CARD */}

            <div className="details-price-card">

              <div className="details-price">

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

              {property.deposit && (
                <div className="details-deposit">
                  Deposit:{" "}
                  <strong>
                    KSh{" "}
                    {Number(
                      property.deposit
                    ).toLocaleString()}
                  </strong>
                </div>
              )}

              <button
                type="button"
                className="details-contact-button"
                onClick={handleContactLandlord}
                disabled={
                  contacting ||
                  !property.is_available
                }
              >
                {contacting
                  ? "Opening conversation..."
                  : property.is_available
                  ? "💬 Contact landlord"
                  : "Property unavailable"}
              </button>

              <p className="details-contact-note">
                Message the property owner directly
                through NyumbaDirect.
              </p>

            </div>

            {/* OWNER CARD */}

            {property.owner && (
              <div className="details-owner-card">

                <h2>
                  Listed by
                </h2>

                <div className="details-owner">

                  <div className="details-owner-avatar">
                    👤
                  </div>

                  <div>

                    <strong>
                      {ownerName}
                    </strong>

                    <span>
                      {formatRole(ownerRole)}
                    </span>

                    {property.owner.is_verified && (
                      <small>
                        ✓ Verified account
                      </small>
                    )}

                  </div>

                </div>

              </div>
            )}

            {/* TRUST CARD */}

            <div className="details-safety-card">

              <div className="details-safety-icon">
                🔒
              </div>

              <div>

                <strong>
                  Stay safe
                </strong>

                <p>
                  Meet in a safe place, inspect the
                  property and verify rental details
                  before making any payment.
                </p>

              </div>

            </div>

          </aside>

        </div>

      </div>
    </div>
  );
}

export default PropertyDetails;

