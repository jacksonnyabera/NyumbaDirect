import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function AdminVerification() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const loadPendingVerifications = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/verification/admin/pending");

      setUsers(response.data || []);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("access_token");
        navigate("/login");
        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to load verification requests."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingVerifications();
  }, []);

  const handleReview = async (userId, action) => {
    const actionName =
      action === "approve" ? "approve" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionName} this verification request?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(`${action}-${userId}`);

      const notes =
        action === "approve"
          ? "Verification approved by NyumbaDirect administrator."
          : "Verification request requires further review.";

      await api.patch(
        `/verification/admin/${userId}/${action}`,
        { notes }
      );

      setUsers((currentUsers) =>
        currentUsers.filter(
          (user) => user.id !== userId
        )
      );
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.detail ||
          `Unable to ${actionName} verification.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatRole = (role) => {
    if (!role) {
      return "User";
    }

    return role
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const formatDate = (value) => {
    if (!value) {
      return "Not available";
    }

    return new Date(value).toLocaleString();
  };

  return (
    <div className="admin-verification-page">
      <div className="admin-verification-container">

        <div className="admin-verification-header">

          <div>
            <span className="section-label">
              ADMINISTRATION
            </span>

            <h1>
              Verification Requests
            </h1>

            <p>
              Review landlord and property manager
              accounts waiting for verification.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="admin-back-button"
          >
            ← Dashboard
          </Link>

        </div>

        {error && (
          <div className="admin-verification-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="admin-verification-loading">
            <div className="admin-spinner" />

            <h2>
              Loading verification requests...
            </h2>

            <p>
              Please wait while NyumbaDirect loads
              pending accounts.
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="admin-verification-empty">

            <div className="admin-empty-icon">
              ✓
            </div>

            <h2>
              No pending requests
            </h2>

            <p>
              There are currently no landlord or
              property manager accounts waiting for
              verification.
            </p>

          </div>
        ) : (
          <div className="admin-verification-list">

            <div className="admin-verification-count">
              {users.length} pending{" "}
              {users.length === 1
                ? "request"
                : "requests"}
            </div>

            {users.map((user) => (
              <article
                key={user.id}
                className="admin-verification-card"
              >

                <div className="admin-user-main">

                  <div className="admin-user-avatar">
                    {user.full_name
                      ?.charAt(0)
                      .toUpperCase() || "U"}
                  </div>

                  <div>
                    <h2>
                      {user.full_name}
                    </h2>

                    <span className="admin-user-role">
                      {formatRole(user.role)}
                    </span>
                  </div>

                </div>

                <div className="admin-user-details">

                  <div>
                    <span>
                      Email
                    </span>

                    <strong>
                      {user.email}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Phone
                    </span>

                    <strong>
                      {user.phone_number}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Submitted
                    </span>

                    <strong>
                      {formatDate(
                        user.verification_submitted_at
                      )}
                    </strong>
                  </div>

                  {user.verification_notes && (
                    <div className="admin-verification-notes">
                      <span>
                        Applicant note
                      </span>

                      <p>
                        {user.verification_notes}
                      </p>
                    </div>
                  )}

                </div>

                <div className="admin-verification-actions">

                  <button
                    type="button"
                    className="admin-approve-button"
                    disabled={
                      actionLoading !== null
                    }
                    onClick={() =>
                      handleReview(
                        user.id,
                        "approve"
                      )
                    }
                  >
                    {actionLoading ===
                    `approve-${user.id}`
                      ? "Approving..."
                      : "✓ Approve"}
                  </button>

                  <button
                    type="button"
                    className="admin-reject-button"
                    disabled={
                      actionLoading !== null
                    }
                    onClick={() =>
                      handleReview(
                        user.id,
                        "reject"
                      )
                    }
                  >
                    {actionLoading ===
                    `reject-${user.id}`
                      ? "Rejecting..."
                      : "Reject"}
                  </button>

                </div>

              </article>
            ))}

          </div>
        )}

      </div>
    </div>
  );
}

export default AdminVerification;