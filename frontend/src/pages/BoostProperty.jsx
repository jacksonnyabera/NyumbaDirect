import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const PACKAGES = [
  {
    id: "7_DAYS",
    name: "Starter Boost",
    days: 7,
    price: 300,
    description: "Give your property extra visibility for 7 days.",
  },
  {
    id: "14_DAYS",
    name: "Growth Boost",
    days: 14,
    price: 700,
    description: "Keep your property promoted for two weeks.",
    popular: true,
  },
  {
    id: "30_DAYS",
    name: "Premium Boost",
    days: 30,
    price: 1500,
    description: "Maximum promotion for landlords who want longer visibility.",
  },
];

export default function BoostProperty() {
  const { propertyId } = useParams();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState("14_DAYS");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProperty = async () => {
      try {
        const response = await api.get(`/properties/${propertyId}`);
        setProperty(response.data);
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.detail || "Unable to load this property."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [propertyId]);

  const selected = PACKAGES.find(
    (item) => item.id === selectedPackage
  );

  const handlePayment = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!phoneNumber.trim()) {
      setError("Enter the M-Pesa phone number to receive the payment prompt.");
      return;
    }

    try {
      setPaying(true);

      const response = await api.post("/payments/mpesa/stk-push", {
        property_id: Number(propertyId),
        package: selectedPackage,
        phone_number: phoneNumber.trim(),
      });

      setMessage(
        response.data?.message ||
          "M-Pesa payment prompt sent. Complete the payment on your phone."
      );
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          "Unable to start the M-Pesa payment. Please try again."
      );
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main className="boost-page">
        <div className="boost-container">
          <p>Loading property...</p>
        </div>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="boost-page">
        <div className="boost-container">
          <h1>Property not found</h1>
          <button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="boost-page">
      <div className="boost-container">

        <button
          type="button"
          className="boost-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          ← Back to Dashboard
        </button>

        <div className="boost-header">
          <span className="boost-badge">PROPERTY BOOST</span>

          <h1>Boost Your Property</h1>

          <p>
            Get your property more visibility and help more house hunters
            discover your listing.
          </p>

          <div className="boost-property-summary">
            <h2>{property.title}</h2>

            <p>
              {property.town || property.county || "Kenya"}
              {property.monthly_rent
                ? ` • KSh ${Number(property.monthly_rent).toLocaleString()}/month`
                : ""}
            </p>
          </div>
        </div>

        <section className="boost-packages">

          <h2>Choose Your Boost Package</h2>

          <p className="boost-section-description">
            Select how long you want your property to be promoted.
          </p>

          <div className="boost-package-grid">

            {PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                className={`boost-package-card ${
                  selectedPackage === pkg.id ? "selected" : ""
                }`}
                onClick={() => setSelectedPackage(pkg.id)}
              >
                {pkg.popular && (
                  <span className="boost-popular">
                    MOST POPULAR
                  </span>
                )}

                <div className="boost-package-icon">
                  🚀
                </div>

                <h3>{pkg.name}</h3>

                <div className="boost-duration">
                  {pkg.days} Days
                </div>

                <div className="boost-price">
                  KSh {pkg.price.toLocaleString()}
                </div>

                <p>{pkg.description}</p>

                <div className="boost-select-indicator">
                  {selectedPackage === pkg.id
                    ? "✓ Selected"
                    : "Select Package"}
                </div>
              </button>
            ))}

          </div>
        </section>

        <section className="boost-payment-card">

          <h2>Complete Payment</h2>

          <p>
            You selected{" "}
            <strong>{selected?.name}</strong> for{" "}
            <strong>
              KSh {selected?.price.toLocaleString()}
            </strong>.
          </p>

          <form onSubmit={handlePayment}>

            <label htmlFor="boost-phone">
              M-Pesa Phone Number
            </label>

            <input
              id="boost-phone"
              type="tel"
              value={phoneNumber}
              onChange={(event) =>
                setPhoneNumber(event.target.value)
              }
              placeholder="e.g. 0712345678"
              autoComplete="tel"
            />

            <small>
              You will receive an M-Pesa payment prompt on this number.
            </small>

            {error && (
              <div className="boost-error">
                {error}
              </div>
            )}

            {message && (
              <div className="boost-success">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="boost-pay-btn"
              disabled={paying}
            >
              {paying
                ? "Sending Payment Prompt..."
                : `Pay KSh ${selected?.price.toLocaleString()} & Boost`}
            </button>

          </form>
        </section>

        <div className="boost-trust">
          <span>🔒 Secure Payment</span>
          <span>📱 M-Pesa</span>
          <span>🚀 More Visibility</span>
        </div>

      </div>
    </main>
  );
}
