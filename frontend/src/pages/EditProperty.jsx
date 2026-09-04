import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

function EditProperty() {
  const { propertyId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    property_type: "Apartment",
    bedrooms: 1,
    bathrooms: 1,
    monthly_rent: "",
    deposit: "",
    county: "",
    town: "",
    area: "",
    address: "",
    latitude: "",
    longitude: "",
    is_available: true,
  });

  const [photos, setPhotos] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadProperty = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const response = await api.get(
          `/properties/${propertyId}`
        );

        const property = response.data;

        setFormData({
          title: property.title || "",
          description: property.description || "",
          property_type: property.property_type || "Apartment",
          bedrooms: property.bedrooms ?? 1,
          bathrooms: property.bathrooms ?? 1,
          monthly_rent: property.monthly_rent ?? "",
          deposit: property.deposit ?? "",
          county: property.county || "",
          town: property.town || "",
          area: property.area || "",
          address: property.address || "",
          latitude: property.latitude ?? "",
          longitude: property.longitude ?? "",
          is_available: property.is_available ?? true,
        });

        setPhotos(property.photos || []);

      } catch (err) {
        console.error(err);

        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          navigate("/login");
          return;
        }

        setError(
          err.response?.data?.detail ||
          "Unable to load property."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [propertyId, navigate]);

  const loadPhotos = async () => {
    try {
      const response = await api.get(
        `/properties/${propertyId}/photos`
      );

      setPhotos(response.data || []);
    } catch (err) {
      console.error(err);

      setPhotoError(
        err.response?.data?.detail ||
        "Unable to load photos."
      );
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const payload = {
        ...formData,
        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        monthly_rent: Number(formData.monthly_rent),
        deposit: formData.deposit
          ? Number(formData.deposit)
          : null,
        latitude: formData.latitude
          ? Number(formData.latitude)
          : null,
        longitude: formData.longitude
          ? Number(formData.longitude)
          : null,
      };

      await api.put(
        `/properties/${propertyId}`,
        payload
      );

      setSuccess("Property updated successfully.");

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
        "Unable to update property."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (event) => {
    setPhotoError("");

    const files = Array.from(
      event.target.files || []
    );

    const validFiles = files.filter((file) => {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      return (
        allowedTypes.includes(file.type) &&
        file.size <= 5 * 1024 * 1024
      );
    });

    if (validFiles.length !== files.length) {
      setPhotoError(
        "Some files were skipped. Only JPG, PNG and WEBP images up to 5 MB are allowed."
      );
    }

    setSelectedFiles(validFiles);
  };

  const handleUploadPhotos = async () => {
    if (selectedFiles.length === 0) {
      setPhotoError("Please select at least one image.");
      return;
    }

    setPhotoError("");
    setSuccess("");
    setUploading(true);

    try {
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];

        const formData = new FormData();

        formData.append("file", file);

        formData.append(
          "is_primary",
          photos.length === 0 && index === 0
            ? "true"
            : "false"
        );

        await api.post(
          `/properties/${propertyId}/photos`,
          formData
        );
      }

      setSelectedFiles([]);

      const fileInput =
        document.getElementById("property-photo-input");

      if (fileInput) {
        fileInput.value = "";
      }

      await loadPhotos();

      setSuccess(
        "Property photos uploaded successfully."
      );

    } catch (err) {
      console.error(err);

      setPhotoError(
        err.response?.data?.detail ||
        "Unable to upload photos."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this photo?"
    );

    if (!confirmed) {
      return;
    }

    setPhotoError("");
    setSuccess("");

    try {
      await api.delete(
        `/properties/${propertyId}/photos/${photoId}`
      );

      setPhotos((currentPhotos) =>
        currentPhotos.filter(
          (photo) => photo.id !== photoId
        )
      );

      setSuccess("Photo deleted successfully.");

    } catch (err) {
      console.error(err);

      setPhotoError(
        err.response?.data?.detail ||
        "Unable to delete photo."
      );
    }
  };

  if (loading) {
    return (
      <div className="add-property-page">
        <div className="status-message">
          Loading property...
        </div>
      </div>
    );
  }

  return (
    <div className="add-property-page">

      <nav className="navbar">
        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        <div className="nav-links">
          <Link to="/dashboard">
            Dashboard
          </Link>

          <Link to="/properties">
            Properties
          </Link>
        </div>
      </nav>

      <main className="add-property-container">

        <div className="form-header">

          <p className="eyebrow">
            🏠 NYUMBADIRECT
          </p>

          <h1>
            Edit Property
          </h1>

          <p>
            Update your rental listing and manage its photos.
          </p>

        </div>

        <div className="property-form-card">

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <div className="form-section">

              <h2>
                Basic Information
              </h2>

              <label>
                Property title
              </label>

              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />

              <label>
                Description
              </label>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="5"
                required
              />

              <label>
                Property type
              </label>

              <select
                name="property_type"
                value={formData.property_type}
                onChange={handleChange}
              >
                <option value="Apartment">
                  Apartment
                </option>

                <option value="House">
                  House
                </option>

                <option value="Bedsitter">
                  Bedsitter
                </option>

                <option value="Studio">
                  Studio
                </option>

                <option value="Maisonette">
                  Maisonette
                </option>

                <option value="Townhouse">
                  Townhouse
                </option>

                <option value="Bungalow">
                  Bungalow
                </option>
              </select>

              <div className="form-row">

                <div>
                  <label>
                    Bedrooms
                  </label>

                  <input
                    type="number"
                    name="bedrooms"
                    min="0"
                    value={formData.bedrooms}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>
                    Bathrooms
                  </label>

                  <input
                    type="number"
                    name="bathrooms"
                    min="0"
                    value={formData.bathrooms}
                    onChange={handleChange}
                    required
                  />
                </div>

              </div>

            </div>

            <div className="form-section">

              <h2>
                Pricing
              </h2>

              <div className="form-row">

                <div>
                  <label>
                    Monthly rent (KSh)
                  </label>

                  <input
                    type="number"
                    name="monthly_rent"
                    min="1"
                    value={formData.monthly_rent}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>
                    Deposit (KSh)
                  </label>

                  <input
                    type="number"
                    name="deposit"
                    min="1"
                    value={formData.deposit}
                    onChange={handleChange}
                  />
                </div>

              </div>

            </div>

            <div className="form-section">

              <h2>
                Location
              </h2>

              <div className="form-row">

                <div>
                  <label>
                    County
                  </label>

                  <input
                    type="text"
                    name="county"
                    value={formData.county}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>
                    Town
                  </label>

                  <input
                    type="text"
                    name="town"
                    value={formData.town}
                    onChange={handleChange}
                    required
                  />
                </div>

              </div>

              <label>
                Area / Estate
              </label>

              <input
                type="text"
                name="area"
                value={formData.area}
                onChange={handleChange}
                required
              />

              <label>
                Full address
              </label>

              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
              />

              <div className="form-row">

                <div>
                  <label>
                    Latitude
                  </label>

                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>
                    Longitude
                  </label>

                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                  />
                </div>

              </div>

            </div>

            <div className="availability-box">

              <input
                type="checkbox"
                name="is_available"
                checked={formData.is_available}
                onChange={handleChange}
              />

              <div>
                <strong>
                  Property is available
                </strong>

                <p>
                  House hunters can see this property
                  in search results.
                </p>
              </div>

            </div>

            <div className="form-actions">

              <Link
                to="/dashboard"
                className="cancel-btn"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="submit-property-btn"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </form>

        </div>

        <div className="property-form-card photo-management-card">

          <div className="photo-section-header">

            <div>
              <p className="eyebrow">
                📸 PROPERTY PHOTOS
              </p>

              <h2>
                Manage Photos
              </h2>

              <p>
                Add clear photos of the property to help
                house hunters make a decision.
              </p>
            </div>

            <span className="photo-count">
              {photos.length}{" "}
              {photos.length === 1
                ? "photo"
                : "photos"}
            </span>

          </div>

          {photoError && (
            <div className="error-message">
              {photoError}
            </div>
          )}

          <div className="photo-upload-box">

            <label
              htmlFor="property-photo-input"
              className="photo-file-label"
            >
              📷 Choose Photos
            </label>

            <input
              id="property-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
            />

            <p>
              JPG, PNG or WEBP · Maximum 5 MB per image
            </p>

            {selectedFiles.length > 0 && (
              <div className="selected-files">

                <strong>
                  {selectedFiles.length}{" "}
                  {selectedFiles.length === 1
                    ? "image"
                    : "images"}{" "}
                  selected
                </strong>

                <ul>
                  {selectedFiles.map(
                    (file, index) => (
                      <li key={index}>
                        {file.name}
                      </li>
                    )
                  )}
                </ul>

                <button
                  type="button"
                  className="upload-photos-btn"
                  onClick={handleUploadPhotos}
                  disabled={uploading}
                >
                  {uploading
                    ? "Uploading..."
                    : "Upload Photos"}
                </button>

              </div>
            )}

          </div>

          {photos.length === 0 ? (

            <div className="photo-empty-state">

              <div>
                📷
              </div>

              <h3>
                No photos yet
              </h3>

              <p>
                Upload photos to make this property
                more attractive to house hunters.
              </p>

            </div>

          ) : (

            <div className="photo-gallery">

              {photos.map((photo) => (

                <div
                  className="photo-gallery-item"
                  key={photo.id}
                >

                  <img
                    src={`http://127.0.0.1:8000${photo.image_url}`}
                    alt={
                      photo.caption ||
                      "Property photo"
                    }
                  />

                  {photo.is_primary && (
                    <span className="primary-photo-badge">
                      ⭐ Primary
                    </span>
                  )}

                  <button
                    type="button"
                    className="delete-photo-btn"
                    onClick={() =>
                      handleDeletePhoto(photo.id)
                    }
                  >
                    🗑 Delete
                  </button>

                </div>

              ))}

            </div>

          )}

        </div>

      </main>

    </div>
  );
}

export default EditProperty;