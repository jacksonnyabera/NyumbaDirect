import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function AddProperty() {
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [createdPropertyId, setCreatedPropertyId] = useState(null);
  const [hasPrimaryPhoto, setHasPrimaryPhoto] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (event) => {
  setPhotoError("");

  const files = Array.from(event.target.files || []);

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  const validFiles = files.filter(
    (file) =>
      allowedTypes.includes(file.type) &&
      file.size <= 5 * 1024 * 1024
  );

  if (validFiles.length !== files.length) {
    setPhotoError(
      "Some files were skipped. Only JPG, PNG and WEBP images up to 5 MB are allowed."
    );
  }

  setSelectedFiles(validFiles);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);
    let propertyId = createdPropertyId;

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
        // Keep the listing out of public search until all requested photos
        // have uploaded and the submission can be completed.
        is_available: false,
      };

      if (!propertyId) {
        const propertyResponse = await api.post("/properties", payload);
        propertyId = propertyResponse.data.id;
        setCreatedPropertyId(propertyId);
      }

      if (selectedFiles.length > 0) {
        setUploading(true);
        let primaryAssigned = hasPrimaryPhoto;

        for (let index = 0; index < selectedFiles.length; index++) {
          const file = selectedFiles[index];

          const photoFormData = new FormData();
          photoFormData.append("file", file);
          photoFormData.append("is_primary", !primaryAssigned ? "true" : "false");

          try {
            await api.post(`/properties/${propertyId}/photos`, photoFormData);
          } catch (photoUploadError) {
            // Retry only the photo that failed and those after it. Previously
            // uploaded photos stay on the same saved listing.
            setSelectedFiles(selectedFiles.slice(index));
            throw photoUploadError;
          }

          if (!primaryAssigned) {
            primaryAssigned = true;
            setHasPrimaryPhoto(true);
          }
          setSelectedFiles(selectedFiles.slice(index + 1));
        }
      }

      setSelectedFiles([]);
      await api.put(`/properties/${propertyId}`, {
        ...payload,
        is_available: formData.is_available,
      });

      setSelectedFiles([]);
      setCreatedPropertyId(null);
      setHasPrimaryPhoto(false);
      navigate("/dashboard");

    } catch (err) {
      console.error(err);

      if (propertyId) {
        setCreatedPropertyId(propertyId);
        const reason = typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "A photo or publishing step failed.";
        setError(
          `Your listing details are saved but are not public yet. ${reason} Retry to finish this same listing; it will not create a duplicate.`
        );
      } else if (err.response?.data?.detail) {
        setError(
          typeof err.response.data.detail === "string"
            ? err.response.data.detail
            : "Please check the information you entered."
        );
      } else {
        setError("Unable to create property.");
      }
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="add-property-page">

      <nav className="navbar">
        <Link to="/" className="logo">
          Nyumba<span>Direct</span>
        </Link>

        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/properties">Properties</Link>
        </div>
      </nav>

      <main className="add-property-container">

        <div className="form-header">
          <p className="eyebrow">NYUMBADIRECT · LANDLORD LISTINGS</p>

          <h1>List a property</h1>

          <p>
            Add accurate details and clear photos so house hunters can make an informed enquiry.
          </p>
        </div>

        <div className="property-form-card">

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <div className="form-section">
              <h2>Basic Information</h2>

              <label>Property title</label>

              <input
                type="text"
                name="title"
                value={formData.title}
                placeholder="e.g. Modern 2 Bedroom Apartment"
                onChange={handleChange}
                minLength={5}
                maxLength={200}
                required
              />

              <label>Description</label>

              <textarea
                name="description"
                value={formData.description}
                placeholder="Describe the property, amenities and surroundings..."
                onChange={handleChange}
                rows="5"
                minLength={20}
                maxLength={5000}
                required
              />

              <label>Property type</label>

              <select
                name="property_type"
                value={formData.property_type}
                onChange={handleChange}
              >
                <option value="Apartment">Apartment</option>
                <option value="House">House</option>
                <option value="Bedsitter">Bedsitter</option>
                <option value="Studio">Studio</option>
                <option value="Maisonette">Maisonette</option>
                <option value="Townhouse">Townhouse</option>
                <option value="Bungalow">Bungalow</option>
              </select>

              <div className="form-row">

                <div>
                  <label>Bedrooms {/(bedsitter|studio|bachelor)/i.test(formData.property_type) ? "(enter 0 for a studio or bedsitter)" : ""}</label>

                  <input
                    type="number"
                    name="bedrooms"
                    min={/(bedsitter|studio|bachelor)/i.test(formData.property_type) ? 0 : 1}
                    value={formData.bedrooms}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Bathrooms</label>

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
              <h2>Pricing</h2>

              <div className="form-row">

                <div>
                  <label>Monthly rent (KSh)</label>

                  <input
                    type="number"
                    name="monthly_rent"
                    min="1"
                    placeholder="35000"
                    value={formData.monthly_rent}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Deposit (KSh)</label>

                  <input
                    type="number"
                    name="deposit"
                    min="1"
                    placeholder="35000"
                    value={formData.deposit}
                    onChange={handleChange}
                  />
                </div>

              </div>
            </div>

            <div className="form-section">
              <h2>Location</h2>

              <div className="form-row">

                <div>
                  <label htmlFor="property-county">County</label>

                  <input
                    id="property-county"
                    type="text"
                    name="county"
                    placeholder="Nairobi"
                    value={formData.county}
                    onChange={handleChange}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="property-town">Town</label>

                  <input
                    id="property-town"
                    type="text"
                    name="town"
                    placeholder="Nairobi"
                    value={formData.town}
                    onChange={handleChange}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>

              </div>

              <label htmlFor="property-area">Area / Estate</label>

              <input
                id="property-area"
                type="text"
                name="area"
                placeholder="Kilimani"
                value={formData.area}
                onChange={handleChange}
                minLength={2}
                maxLength={150}
                required
              />

              <label>Full address</label>

              <input
                type="text"
                name="address"
                placeholder="Kilimani, Nairobi"
                value={formData.address}
                onChange={handleChange}
              />

              <div className="form-row">

                <div>
                  <label>Latitude</label>

                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    placeholder="-1.2921"
                    value={formData.latitude}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Longitude</label>

                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    placeholder="36.7875"
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
                <strong>Property is available</strong>
                <p>
                  House hunters can see this listing in search after you finish saving it.
                </p>
              </div>

            </div>

            <div className="form-section photo-upload-section">
  <h2>Property Photos</h2>

  <p>
    Add clear photos of the property. Good photos help
    house hunters understand the property before contacting you.
  </p>

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
      Choose photos
    </label>

    <input
      id="property-photo-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      onChange={handleFileChange}
    />

    <p>
      JPEG, PNG or WebP · Maximum 5 MB per image
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
          {selectedFiles.map((file, index) => (
            <li key={index}>
              {file.name}
            </li>
          ))}
        </ul>
      </div>
    )}
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
                disabled={loading}
                className="submit-property-btn"
              >
                {loading
                  ? uploading
                    ? "Uploading photos..."
                    : createdPropertyId
                      ? "Finishing listing..."
                      : "Saving listing..."
                  : createdPropertyId
                    ? "Retry and finish listing"
                    : "Create listing"}
              </button>

            </div>

          </form>

        </div>

      </main>

    </div>
  );
}

export default AddProperty;


