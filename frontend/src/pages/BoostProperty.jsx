import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";

const PACKAGES = [
  {
    key: "7_DAYS",
    days: "7 Days",
    amount: 300,
    description: "Give your property a visibility boost for one week.",
  },
  {
    key: "14_DAYS",
    days: "14 Days",
    amount: 700,
    description: "Keep your listing promoted for two weeks.",
  },
  {
    key: "30_DAYS",
    days: "30 Days",
    amount: 1500,
    description: "Maximum promotion period for long-term visibility.",
  },
];

function BoostProperty() {
  const { propertyId } = useParams();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [promotionId, setPromotionId] = useState(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState("");
  const [requiresSupport, setRequiresSupport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  useEffect(() => {
    const loadProperty = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);

        const [propertyResponse, promotionsResponse] = await Promise.all([
          api.get(`/properties/${propertyId}`),
          api.get("/promotions/my", {
            params: { property_id: Number(propertyId), limit: 20 },
          }),
        ]);

        setProperty(propertyResponse.data);
        const pendingPromotion = (promotionsResponse.data || []).find(
          (promotion) =>
            Number(promotion.property_id) === Number(propertyId) &&
            promotion.payment_status === "PENDING"
        );
        if (pendingPromotion) {
          setPromotionId(pendingPromotion.id);
          setCheckoutRequestId(pendingPromotion.checkout_request_id || "");
          setPaymentStatus("PENDING");
          const supportRequired = Boolean(
            pendingPromotion.phone_number && !pendingPromotion.checkout_request_id
          );
          setRequiresSupport(supportRequired);
          setPhoneNumber(pendingPromotion.phone_number || "");
          setSelectedPackage(
            PACKAGES.find((item) => item.key === pendingPromotion.package) || null
          );
          setMessage(supportRequired
            ? pendingPromotion.result_description || "We could not confirm whether M-Pesa received your request. Check your phone and contact support before trying another payment."
            : pendingPromotion.checkout_request_id
              ? "An M-Pesa request is already awaiting confirmation. Check its status here; do not start another payment."
              : "Your boost request is saved. Enter the payment number and continue to send the M-Pesa prompt."
          );
        }
      } catch (err) {
        console.error(err);

        if (err.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_id");
          navigate("/login");
          return;
        }

        setError(
          err.response?.data?.detail ||
            "Unable to load this property."
        );
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [navigate, propertyId]);

  const normalizePhone = (value) => {
    const clean = value.replace(/[\s()-]/g, "").trim();

    if (clean.startsWith("+254")) {
      return clean.slice(1);
    }

    if (clean.startsWith("254")) {
      return clean;
    }

    if (
      clean.startsWith("0") &&
      clean.length === 10
    ) {
      return `254${clean.slice(1)}`;
    }

    return clean;
  };

  const handlePayment = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!selectedPackage) {
      setError(
        "Please choose a boost package first."
      );
      return;
    }

    const normalizedPhone =
      normalizePhone(phoneNumber);

    if (!/^254[17]\d{8}$/.test(normalizedPhone)) {
      setError(
        "Enter a valid Kenyan M-Pesa number, for example 0712345678 or 0112345678."
      );
      return;
    }

    let currentPromotionId = promotionId;
    let currentCheckoutRequestId = checkoutRequestId;
    try {
      setPaying(true);

      /*
       * Create the promotion ONLY after
       * the landlord chooses a package.
       */
      if (!currentPromotionId) {
        const promotionResponse = await api.post("/promotions", {
          property_id: Number(propertyId),
          package: selectedPackage.key,
        });
        currentPromotionId = promotionResponse.data.id;
        currentCheckoutRequestId = promotionResponse.data.checkout_request_id || "";
        setPromotionId(currentPromotionId);
        setCheckoutRequestId(currentCheckoutRequestId);
      }

      if (currentCheckoutRequestId) {
        setPaymentStatus("PENDING");
        setMessage("This M-Pesa request is awaiting confirmation. Check your phone; this page will check for an update for up to one minute.");
        await waitForPayment(currentPromotionId);
        return;
      }

      /*
       * Start M-Pesa payment.
       */
      const paymentResponse =
        await api.post(
          "/payments/mpesa/stk-push",
          {
            promotion_id: currentPromotionId,
            phone_number: normalizedPhone,
          }
        );

      setMessage(
        paymentResponse.data?.message ||
          "STK Push sent. Check your M-Pesa phone and enter your PIN."
      );

      const checkoutId = paymentResponse.data?.checkout_request_id;
      if (!checkoutId) {
        if (paymentResponse.data?.requires_support) {
          setRequiresSupport(true);
          setPaymentStatus("PENDING");
          setMessage(paymentResponse.data.message || "We could not confirm whether M-Pesa received your request. Check your phone and contact support before trying another payment.");
          return;
        }
        throw new Error("M-Pesa did not return a payment request ID.");
      }
      setCheckoutRequestId(checkoutId);
      setRequiresSupport(false);
      setPaymentStatus("PENDING");
      await waitForPayment(currentPromotionId);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        navigate("/login");
        return;
      }

      let reconciledStatus = "";
      if (currentPromotionId) {
        try {
          const statusResponse = await api.get(
            `/payments/mpesa/status/${currentPromotionId}`
          );
          reconciledStatus = String(statusResponse.data?.payment_status || "PENDING").toUpperCase();
          setCheckoutRequestId(statusResponse.data?.checkout_request_id || "");
          setPaymentStatus(reconciledStatus);
          const supportRequired = Boolean(statusResponse.data?.requires_support);
          setRequiresSupport(supportRequired);
          if (reconciledStatus === "PENDING") {
            setMessage(supportRequired
              ? "M-Pesa may have received the request. Check your phone and contact support before trying again."
              : "This boost is still awaiting payment. You can continue when no M-Pesa request has been sent."
            );
          }
        } catch {
          // If the status service is also unreachable, keep the form locked
          // until the customer can confirm whether the STK request arrived.
          reconciledStatus = "PENDING";
          setPaymentStatus("PENDING");
          setRequiresSupport(true);
          setMessage("We could not confirm whether M-Pesa received the request. Check your phone and contact support before trying another payment.");
        }
      }

      if (reconciledStatus === "PENDING") {
        setError("");
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to start the boost payment. Please try again."
        );
      }
    } finally {
      setPaying(false);
    }
  };

  const fetchPaymentStatus = async (id) => {
    const response = await api.get(`/payments/mpesa/status/${id}`);
    const status = String(response.data?.payment_status || "").toUpperCase();
    setPaymentStatus(status);
    setRequiresSupport(Boolean(response.data?.requires_support));

    if (status === "PAID") {
      setMessage("Payment confirmed. Your property boost is now active.");
      setError("");
    } else if (status === "FAILED") {
      setError(response.data?.result_description || "The payment was not completed. You can try again.");
      setMessage("");
      setCheckoutRequestId("");
      setRequiresSupport(false);
    }
    return status;
  };

  const waitForPayment = async (id) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        const status = await fetchPaymentStatus(id);
        if (status === "PAID" || status === "FAILED") return;
      } catch (statusError) {
        console.error("Unable to check boost payment status:", statusError);
      }
    }
    setMessage("Payment is still awaiting confirmation. Check your M-Pesa phone, then use the status button below. A second payment prompt will not be sent while this request is pending.");
  };

  const checkPaymentStatus = async () => {
    if (!promotionId || paying) return;
    setPaying(true);
    setError("");
    try {
      const status = await fetchPaymentStatus(promotionId);
      if (status === "PENDING") {
        setMessage(requiresSupport
          ? "M-Pesa has not confirmed this request. Check your phone and contact support before starting another payment."
          : "M-Pesa has not confirmed this request yet. Check your phone and try again shortly."
        );
      }
    } catch (statusError) {
      if (statusError.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }
      setError("Unable to check payment status right now. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const hasLockedPendingPayment = paymentStatus === "PENDING" &&
    (Boolean(checkoutRequestId) || requiresSupport);
  const paymentButtonText = paying
    ? paymentStatus === "PENDING"
      ? "Waiting for M-Pesa confirmation..."
      : "Sending STK Push..."
    : paymentStatus === "PAID"
      ? "Boost is active"
      : requiresSupport
        ? "Payment needs a status check"
        : hasLockedPendingPayment
          ? "Payment awaiting confirmation"
        : paymentStatus === "PENDING"
          ? "Continue payment"
          : selectedPackage
            ? `Boost for KSh ${selectedPackage.amount.toLocaleString()}`
            : "Choose a package to continue";

  if (loading) {
    return (
      <div className="boost-page">
        <div className="boost-shell boost-loading">
          <div className="boost-spinner" />

          <h2>
            Loading property...
          </h2>
        </div>
      </div>
    );
  }

  if (error && !property) {
    return (
      <div className="boost-page">
        <div className="boost-shell boost-error-state">
          <span className="boost-icon">
            ⚠️
          </span>

          <h1>
            Unable to open boost
          </h1>

          <p>{error}</p>

          <Link
            to="/dashboard"
            className="boost-secondary-button"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="boost-page">
      <div className="boost-shell">

        <div className="boost-topbar">
          <Link
            to="/dashboard"
            className="boost-back-link"
          >
            ← Dashboard
          </Link>

          <span className="boost-brand">
            Nyumba<span>Direct</span>
          </span>
        </div>

        <section className="boost-header">
          <span className="boost-eyebrow">
            PROPERTY PROMOTION
          </span>

          <h1>
            Boost your property
          </h1>

          <p>
            Choose a promotion package to give
            your listing more visibility on
            NyumbaDirect.
          </p>
        </section>

        <section className="boost-property-card">
          <div>
            <span className="boost-property-label">
              SELECTED PROPERTY
            </span>

            <h2>
              {property?.title ||
                `Property #${propertyId}`}
            </h2>

            <p>
              {[
                property?.area,
                property?.town,
                property?.county,
              ]
                .filter(Boolean)
                .join(", ") ||
                "Location not specified"}
            </p>
          </div>

          <strong>
            KSh{" "}
            {Number(
              property?.monthly_rent || 0
            ).toLocaleString()}
            /month
          </strong>
        </section>

        {error && (
          <div className="boost-alert boost-alert-error">
            {error}
          </div>
        )}

        {message && (
          <div className={`boost-alert ${paymentStatus === "PAID" ? "boost-alert-success" : "boost-alert-pending"}`} role="status">
            {paymentStatus === "PAID" ? "✓ " : paymentStatus === "PENDING" ? "⌛ " : ""}{message}
          </div>
        )}

        <section className="boost-packages">

          {PACKAGES.map((item) => {
            const selected =
              selectedPackage?.key === item.key;

            return (
              <button
                key={item.key}
                type="button"
                className={`boost-package-card ${
                  selected ? "selected" : ""
                }`}
                onClick={() => {
                  setSelectedPackage(item);
                  setMessage("");
                  setError("");
                  setPaymentStatus("");
                  setPromotionId(null);
                  setCheckoutRequestId("");
                  setRequiresSupport(false);
                }}
                disabled={paying || paymentStatus === "PENDING" || paymentStatus === "PAID"}
              >

                {item.key === "14_DAYS" && (
                  <span className="boost-popular">
                    POPULAR
                  </span>
                )}

                <span className="boost-package-check">
                  {selected ? "✓" : ""}
                </span>

                <span className="boost-package-days">
                  {item.days}
                </span>

                <strong>
                  KSh{" "}
                  {item.amount.toLocaleString()}
                </strong>

                <span className="boost-package-description">
                  {item.description}
                </span>

              </button>
            );
          })}

        </section>

        <form
          className="boost-payment-card"
          onSubmit={handlePayment}
        >

          <div>
            <span className="boost-eyebrow">
              M-PESA PAYMENT
            </span>

            <h2>
              Pay securely from your phone
            </h2>

            <p>
              After you continue, an M-Pesa STK
              prompt will be sent to this number.
            </p>
          </div>

          <label htmlFor="boost-phone">
            M-Pesa phone number
          </label>

          <input
            id="boost-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="0712345678"
            value={phoneNumber}
            onChange={(event) =>
              setPhoneNumber(
                event.target.value
              )
            }
            disabled={paying || hasLockedPendingPayment || paymentStatus === "PAID"}
          />

          <button
            type="submit"
            className="boost-pay-button"
            disabled={
              paying || !selectedPackage || paymentStatus === "PAID" || hasLockedPendingPayment
            }
          >
            {paymentButtonText}
          </button>

          {hasLockedPendingPayment && (
            <button
              type="button"
              className="boost-secondary-button"
              onClick={checkPaymentStatus}
              disabled={paying}
            >
              {paying ? "Checking payment..." : "Check payment status"}
            </button>
          )}

          {requiresSupport && (
            <div className="boost-payment-support" role="alert">
              <strong>Check before paying again</strong>
              <p>We could not confirm whether M-Pesa received the request. Check your phone, and contact support if you did not receive a prompt. We have blocked another prompt to help prevent a duplicate charge.</p>
              <a href={`mailto:supportnyumbadirect@gmail.com?subject=Boost%20payment%20status%20-%20${promotionId}`}>
                Contact NyumbaDirect support
              </a>
            </div>
          )}

          <p className="boost-secure-note">
            Your property is only marked as
            boosted after a successful M-Pesa
            confirmation.
          </p>

        </form>

      </div>

      <style>{`

        .boost-page {
          min-height: 100vh;
          padding: 24px 16px 60px;
          background:
            linear-gradient(
              180deg,
              #f8fafc 0%,
              #eef6f5 100%
            );
          color: #0f172a;
        }

        .boost-shell {
          width: min(980px, 100%);
          margin: 0 auto;
        }

        .boost-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 44px;
        }

        .boost-back-link {
          color: #475569;
          text-decoration: none;
          font-weight: 700;
        }

        .boost-back-link:hover {
          color: #0f766e;
        }

        .boost-brand {
          font-size: 20px;
          font-weight: 900;
        }

        .boost-brand span {
          color: #0f766e;
        }

        .boost-header {
          max-width: 680px;
          margin-bottom: 24px;
        }

        .boost-eyebrow,
        .boost-property-label {
          color: #2563eb;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .boost-header h1 {
          margin: 8px 0;
          font-size: clamp(
            34px,
            6vw,
            52px
          );
          letter-spacing: -1.8px;
        }

        .boost-header p,
        .boost-payment-card p,
        .boost-property-card p {
          color: #64748b;
          line-height: 1.7;
        }

        .boost-property-card,
        .boost-payment-card {
          background: white;
          border: 1px solid rgba(
            15,
            23,
            42,
            .07
          );
          border-radius: 22px;
          box-shadow:
            0 16px 45px rgba(
              15,
              23,
              42,
              .07
            );
        }

        .boost-property-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 22px;
          margin-bottom: 20px;
        }

        .boost-property-card h2 {
          margin: 7px 0 2px;
        }

        .boost-property-card p {
          margin: 0;
        }

        .boost-property-card > strong {
          white-space: nowrap;
        }

        .boost-alert {
          padding: 13px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-weight: 650;
        }

        .boost-alert-error {
          background: #fef2f2;
          color: #991b1b;
        }

        .boost-alert-success {
          background: #ecfdf5;
          color: #166534;
        }

        .boost-alert-pending {
          background: #fffbeb;
          color: #92400e;
        }

        .boost-packages {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 16px;
          margin-bottom: 22px;
        }

        .boost-package-card {
          position: relative;
          min-height: 230px;
          padding: 24px;
          border: 2px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          text-align: left;
          cursor: pointer;
          transition:
            transform .2s ease,
            border-color .2s ease,
            box-shadow .2s ease;
        }

        .boost-package-card:hover {
          transform:
            translateY(-3px);
          border-color:
            #94a3b8;
          box-shadow:
            0 14px 32px
            rgba(
              15,
              23,
              42,
              .08
            );
        }

        .boost-package-card.selected {
          border-color: #0f766e;
          box-shadow:
            0 14px 34px
            rgba(
              15,
              118,
              110,
              .14
            );
        }

        .boost-package-card strong,
        .boost-package-days,
        .boost-package-description {
          display: block;
        }

        .boost-package-days {
          margin-top: 18px;
          color: #475569;
          font-weight: 800;
        }

        .boost-package-card strong {
          margin: 7px 0 12px;
          font-size: 28px;
        }

        .boost-package-description {
          color: #64748b;
          line-height: 1.5;
          font-size: 14px;
        }

        .boost-package-check {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f1f5f9;
          color: white;
          font-weight: 900;
        }

        .boost-package-card.selected
        .boost-package-check {
          background: #0f766e;
        }

        .boost-popular {
          position: absolute;
          top: 0;
          left: 22px;
          transform:
            translateY(-50%);
          padding: 5px 9px;
          border-radius: 999px;
          background: #2563eb;
          color: white;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .boost-payment-card {
          padding: 26px;
        }

        .boost-payment-card h2 {
          margin: 8px 0 4px;
        }

        .boost-payment-card label {
          display: block;
          margin: 20px 0 8px;
          font-size: 14px;
          font-weight: 800;
        }

        .boost-payment-card input {
          width: 100%;
          box-sizing: border-box;
          min-height: 52px;
          padding: 0 15px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 16px;
          outline: none;
        }

        .boost-payment-card input:focus {
          border-color: #0f766e;
          box-shadow:
            0 0 0 3px
            rgba(
              15,
              118,
              110,
              .1
            );
        }

        .boost-pay-button,
        .boost-secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          border: 0;
          border-radius: 12px;
          margin-top: 14px;
          padding: 0 20px;
          background: #0f766e;
          color: white;
          font-weight: 850;
          text-decoration: none;
          cursor: pointer;
        }

        .boost-pay-button {
          width: 100%;
        }

        .boost-pay-button:hover:not(:disabled) {
          background: #115e59;
        }

        .boost-pay-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .boost-secure-note {
          margin: 12px 0 0;
          font-size: 12px;
        }

        .boost-payment-support {
          margin-top: 16px;
          padding: 14px 16px;
          border: 1px solid #fcd34d;
          border-radius: 12px;
          background: #fffbeb;
          color: #78350f;
          font-size: 13px;
          line-height: 1.5;
        }

        .boost-payment-support p {
          margin: 6px 0 10px;
        }

        .boost-payment-support a {
          color: #0f766e;
          font-weight: 700;
        }

        .boost-loading,
        .boost-error-state {
          min-height: 70vh;
          display: grid;
          place-items: center;
          align-content: center;
          text-align: center;
        }

        .boost-spinner {
          width: 38px;
          height: 38px;
          border: 4px solid #dbeafe;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation:
            boost-spin .8s
            linear infinite;
        }

        .boost-icon {
          font-size: 40px;
        }

        @keyframes boost-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {

          .boost-packages {
            grid-template-columns: 1fr;
          }

          .boost-property-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .boost-topbar {
            margin-bottom: 30px;
          }
        }

        @media (max-width: 480px) {

          .boost-page {
            padding:
              16px 12px 40px;
          }

          .boost-payment-card,
          .boost-property-card {
            padding: 18px;
            border-radius: 18px;
          }

          .boost-package-card {
            min-height: 190px;
            padding: 20px;
          }

          .boost-header h1 {
            font-size: 36px;
          }

        }

      `}</style>
    </div>
  );
}

export default BoostProperty;
