import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const SECTIONS = [
  { id: "overview", label: "Overview", marker: "OV" },
  { id: "users", label: "Users", marker: "US" },
  { id: "properties", label: "Properties", marker: "PR" },
  { id: "verification", label: "Verification", marker: "VE" },
  { id: "promotions", label: "Promotions", marker: "BO" },
  { id: "payments", label: "Payments", marker: "PA" },
  { id: "reports", label: "Reports", marker: "RE" },
  { id: "settings", label: "Settings", marker: "SE" },
];

const PAGE_SIZE = 25;

function formatMoney(value) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function StatusPill({ children, tone }) {
  return <span className={`admin-status-pill ${tone || "neutral"}`}>{children}</span>;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [accessReady, setAccessReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [section, setSection] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let active = true;
    const checkAdmin = async () => {
      if (!localStorage.getItem("access_token")) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const response = await api.get("/auth/me");
        if (!active) return;
        if (response.data?.role?.toUpperCase() !== "ADMIN") {
          navigate("/dashboard", { replace: true });
          return;
        }
        setAdmin(response.data);
        setAccessReady(true);
      } catch (requestError) {
        if (!active) return;
        if (requestError.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_id");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }
        setAuthError(requestError.response?.data?.detail || "Unable to confirm administrator access.");
        setLoading(false);
      }
    };
    checkAdmin();
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    if (!accessReady) return undefined;
    let active = true;
    const loadSection = async () => {
      setLoading(true);
      setError("");
      try {
        const offset = page * PAGE_SIZE;
        let result;
        if (section === "overview") {
          const response = await api.get("/admin/overview");
          result = response.data;
        } else if (section === "users") {
          const response = await api.get("/admin/users", {
            params: {
              q: query || undefined,
              role: roleFilter || undefined,
              active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
              skip: offset,
              limit: PAGE_SIZE,
            },
          });
          result = response.data;
        } else if (section === "properties") {
          const response = await api.get("/admin/properties", {
            params: {
              q: query || undefined,
              available: statusFilter === "available" ? true : statusFilter === "unavailable" ? false : undefined,
              verified: roleFilter === "verified" ? true : roleFilter === "unverified" ? false : undefined,
              skip: offset,
              limit: PAGE_SIZE,
            },
          });
          result = response.data;
        } else if (section === "verification") {
          const [accounts, landlords] = await Promise.all([
            api.get("/verification/admin/pending"),
            api.get("/admin/verifications/landlords", {
              params: { verification_status: statusFilter || "PENDING", limit: PAGE_SIZE },
            }),
          ]);
          result = { accounts: accounts.data || [], landlords: landlords.data?.items || [] };
        } else if (section === "promotions" || section === "payments") {
          const response = await api.get(`/admin/${section}`, {
            params: {
              q: query || undefined,
              payment_status: statusFilter || undefined,
              skip: offset,
              limit: PAGE_SIZE,
            },
          });
          result = response.data;
        } else if (section === "reports") {
          const response = await api.get("/admin/reports");
          result = response.data;
        } else {
          const response = await api.get("/admin/settings");
          result = response.data;
        }
        if (active) setData(result);
      } catch (requestError) {
        if (!active) return;
        if (requestError.response?.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_id");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }
        setError(requestError.response?.data?.detail || "Unable to load this admin view.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSection();
    return () => { active = false; };
  }, [accessReady, navigate, page, query, refreshCount, roleFilter, section, statusFilter]);

  const sectionLabel = SECTIONS.find((item) => item.id === section)?.label || "Overview";
  const applyFilters = (event) => {
    event.preventDefault();
    setPage(0);
    setQuery(queryInput.trim());
  };
  const changeSection = (nextSection) => {
    setSection(nextSection);
    setData(null);
    setError("");
    setNotice("");
    setQueryInput("");
    setQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(0);
  };
  const refresh = () => setRefreshCount((count) => count + 1);
  const reportActionError = (requestError) => {
    if (requestError.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
      return;
    }
    setError(requestError.response?.data?.detail || "The action could not be completed.");
  };

  const reviewAccount = async (userId, action) => {
    const notes = action === "approve"
      ? "Verification approved by NyumbaDirect administrator."
      : window.prompt("Enter a reason for rejecting this verification request:");
    if (notes === null || !notes.trim()) return;
    const key = `account-${action}-${userId}`;
    setActionLoading(key);
    setError("");
    try {
      await api.patch(`/verification/admin/${userId}/${action}`, { notes });
      setNotice("Account verification updated.");
      refresh();
    } catch (requestError) {
      reportActionError(requestError);
    } finally {
      setActionLoading("");
    }
  };

  const reviewLandlord = async (verificationId, action) => {
    const reason = action === "reject"
      ? window.prompt("Enter a reason for rejecting this landlord verification:")
      : null;
    if (action === "reject" && (!reason || !reason.trim())) return;
    const key = `landlord-${action}-${verificationId}`;
    setActionLoading(key);
    setError("");
    try {
      if (action === "approve") {
        await api.put(`/admin/verifications/${verificationId}/approve`);
      } else {
        await api.put(`/admin/verifications/${verificationId}/reject`, null, {
          params: { rejection_reason: reason.trim() },
        });
      }
      setNotice("Landlord verification updated.");
      refresh();
    } catch (requestError) {
      reportActionError(requestError);
    } finally {
      setActionLoading("");
    }
  };

  const signOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const renderOverview = () => (
    <>
      <div className="admin-metric-grid">
        {[
          ["Total users", data?.users_total],
          ["Active users", data?.users_active],
          ["Rental listings", data?.properties_total],
          ["Available now", data?.properties_available],
          ["Verifications pending", (data?.account_verifications_pending || 0) + (data?.landlord_verifications_pending || 0)],
          ["Payments pending", data?.promotions_pending],
          ["Paid promotions", data?.promotions_paid],
          ["Promotion revenue", formatMoney(data?.paid_revenue)],
        ].map(([label, value]) => (
          <article className="admin-metric" key={label}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </article>
        ))}
      </div>
      <div className="admin-overview-bottom">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><span>WORK QUEUE</span><h3>Needs attention</h3></div></div>
          <div className="admin-queue-list">
            <button type="button" onClick={() => changeSection("verification")}><span>Verification requests</span><strong>{(data?.account_verifications_pending || 0) + (data?.landlord_verifications_pending || 0)}</strong></button>
            <button type="button" onClick={() => changeSection("payments")}><span>Pending payments</span><strong>{data?.promotions_pending ?? 0}</strong></button>
          </div>
        </section>
        <section className="admin-panel admin-overview-note">
          <span>ADMIN SESSION</span>
          <strong>{admin?.full_name || "Administrator"}</strong>
          <p>{admin?.email}</p>
          <StatusPill tone="good">Server role: ADMIN</StatusPill>
        </section>
      </div>
    </>
  );

  const renderUsers = () => (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>User</th><th>Contact</th><th>Role</th><th>Account</th><th>Verification</th><th>Joined</th></tr></thead>
        <tbody>{(data?.items || []).map((user) => (
          <tr key={user.id}>
            <td><strong>{user.full_name}</strong><small>#{user.id}</small></td>
            <td>{user.email}<small>{user.phone_number}</small></td>
            <td>{user.role.replaceAll("_", " ")}</td>
            <td><StatusPill tone={user.is_active ? "good" : "muted"}>{user.is_active ? "Active" : "Inactive"}</StatusPill></td>
            <td><StatusPill tone={user.is_verified ? "good" : "neutral"}>{user.verification_status || (user.is_verified ? "Approved" : "Not submitted")}</StatusPill></td>
            <td>{formatDate(user.created_at)}</td>
          </tr>
        ))}</tbody>
      </table>
      {data?.items?.length === 0 && <p className="admin-empty">No users match these filters.</p>}
    </div>
  );

  const renderProperties = () => (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>Listing</th><th>Owner</th><th>Location</th><th>Monthly rent</th><th>Status</th><th>Promotion</th><th>Added</th></tr></thead>
        <tbody>{(data?.items || []).map((property) => (
          <tr key={property.id}>
            <td><Link to={`/properties/${property.id}`} target="_blank" rel="noreferrer">{property.title}</Link><small>{property.property_type} · #{property.id}</small></td>
            <td>{property.owner_name}<small>{property.owner_email}</small></td>
            <td>{[property.town, property.county].filter(Boolean).join(", ") || "—"}</td>
            <td>{formatMoney(property.monthly_rent)}</td>
            <td><StatusPill tone={property.is_available ? "good" : "muted"}>{property.is_available ? "Available" : "Unavailable"}</StatusPill></td>
            <td>{property.is_featured && property.featured_until ? `Until ${formatDate(property.featured_until)}` : "Standard"}</td>
            <td>{formatDate(property.created_at)}</td>
          </tr>
        ))}</tbody>
      </table>
      {data?.items?.length === 0 && <p className="admin-empty">No properties match these filters.</p>}
    </div>
  );

  const renderVerification = () => (
    <div className="admin-verification-groups">
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span>ACCOUNT REVIEW</span><h3>Account verification requests</h3></div><StatusPill>{data?.accounts?.length || 0} pending</StatusPill></div>
        {data?.accounts?.length ? data.accounts.map((user) => (
          <article className="admin-review-row" key={`account-${user.id}`}>
            <div><strong>{user.full_name}</strong><span>{user.email} · {user.phone_number}</span><small>{user.role.replaceAll("_", " ")} · Submitted {formatDate(user.verification_submitted_at)}</small>{user.verification_notes && <p>{user.verification_notes}</p>}</div>
            <div className="admin-row-actions">
              <button type="button" className="admin-approve" disabled={Boolean(actionLoading)} onClick={() => reviewAccount(user.id, "approve")}>{actionLoading === `account-approve-${user.id}` ? "Saving…" : "Approve"}</button>
              <button type="button" className="admin-reject" disabled={Boolean(actionLoading)} onClick={() => reviewAccount(user.id, "reject")}>{actionLoading === `account-reject-${user.id}` ? "Saving…" : "Reject"}</button>
            </div>
          </article>
        )) : <p className="admin-empty">No account verifications are pending.</p>}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span>LANDLORD REVIEW</span><h3>Landlord verification submissions</h3></div><StatusPill>{data?.landlords?.length || 0} pending</StatusPill></div>
        {data?.landlords?.length ? data.landlords.map((item) => (
          <article className="admin-review-row" key={`landlord-${item.id}`}>
            <div><strong>{item.full_name}</strong><span>{item.email} · {item.phone_number}</span><small>Request #{item.id} · Submitted {formatDate(item.submitted_at)}</small>{item.rejection_reason && <p>{item.rejection_reason}</p>}</div>
            <div className="admin-row-actions">
              <button type="button" className="admin-approve" disabled={Boolean(actionLoading)} onClick={() => reviewLandlord(item.id, "approve")}>{actionLoading === `landlord-approve-${item.id}` ? "Saving…" : "Approve"}</button>
              <button type="button" className="admin-reject" disabled={Boolean(actionLoading)} onClick={() => reviewLandlord(item.id, "reject")}>{actionLoading === `landlord-reject-${item.id}` ? "Saving…" : "Reject"}</button>
            </div>
          </article>
        )) : <p className="admin-empty">No landlord verification submissions are pending.</p>}
      </section>
    </div>
  );

  const renderPromotions = (payments = false) => (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>{payments ? "Payment" : "Promotion"}</th><th>Listing</th><th>Account</th><th>Package</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>{(data?.items || []).map((item) => (
          <tr key={item.id}>
            <td>#{item.id}<small>{item.phone_number || "M-Pesa number not entered"}</small></td>
            <td>{item.property_title}<small>Property #{item.property_id}</small></td>
            <td>{item.user_name}<small>{item.user_email}</small></td>
            <td>{item.package.replaceAll("_", " ")}</td>
            <td>{formatMoney(item.amount)}</td>
            <td><StatusPill tone={item.payment_status === "PAID" ? "good" : item.payment_status === "FAILED" ? "bad" : "neutral"}>{item.payment_status}</StatusPill>{item.result_description && <small className="admin-cell-note">{item.result_description}</small>}</td>
            <td>{formatDate(item.created_at)}</td>
          </tr>
        ))}</tbody>
      </table>
      {data?.items?.length === 0 && <p className="admin-empty">No records match these filters.</p>}
    </div>
  );

  const renderReports = () => (
    <div className="admin-report-grid">
      {[
        ["Users by role", data?.users_by_role || [], "role"],
        ["Listings by type", data?.properties_by_type || [], "property_type"],
        ["Promotions by payment state", data?.promotions_by_status || [], "status"],
      ].map(([title, rows, key]) => (
        <section className="admin-panel" key={title}>
          <div className="admin-panel-heading"><div><span>LIVE COUNTS</span><h3>{title}</h3></div></div>
          {rows.length ? rows.map((row) => <div className="admin-report-row" key={row[key]}><span>{String(row[key]).replaceAll("_", " ")}</span><strong>{row.count}</strong></div>) : <p className="admin-empty">No records yet.</p>}
        </section>
      ))}
      <section className="admin-panel admin-report-wide">
        <div className="admin-panel-heading"><div><span>HOUSE-HUNTER INTEREST</span><h3>Most saved properties</h3></div></div>
        {data?.most_saved_properties?.length ? data.most_saved_properties.map((item) => <div className="admin-report-row" key={item.id}><span>{item.title}<small>{item.town || "Location not listed"}</small></span><strong>{item.saves} saves</strong></div>) : <p className="admin-empty">No saved homes recorded yet.</p>}
      </section>
    </div>
  );

  const renderSettings = () => (
    <section className="admin-panel admin-settings-panel">
      <div className="admin-panel-heading"><div><span>RUNTIME</span><h3>Service configuration status</h3></div><StatusPill tone={data?.debug_enabled ? "bad" : "good"}>{data?.debug_enabled ? "Debug on" : "Production-safe"}</StatusPill></div>
      <div className="admin-settings-grid">
        <div><span>Application</span><strong>{data?.app_name || "—"}</strong></div>
        <div><span>Environment</span><strong>{data?.environment || "—"}</strong></div>
        <div className="admin-settings-hosts"><span>Trusted hosts</span><strong>{data?.trusted_hosts?.join(", ") || "Not configured"}</strong></div>
      </div>
      <h4>Service readiness</h4>
      <div className="admin-service-list">
        {Object.entries(data?.services || {}).map(([name, configured]) => (
          <div key={name}><span>{name.replaceAll("_", " ")}</span><StatusPill tone={configured ? "good" : "muted"}>{configured ? "Configured" : "Not configured"}</StatusPill></div>
        ))}
      </div>
    </section>
  );

  const renderData = () => {
    if (loading && !data) return <div className="admin-state" role="status">Loading {sectionLabel.toLowerCase()}…</div>;
    if (error && !data) return <div className="admin-state admin-state-error" role="alert"><strong>Couldn’t load this view</strong><span>{error}</span><button type="button" onClick={refresh}>Retry</button></div>;
    if (section === "overview") return renderOverview();
    if (section === "users") return renderUsers();
    if (section === "properties") return renderProperties();
    if (section === "verification") return renderVerification();
    if (section === "promotions") return renderPromotions(false);
    if (section === "payments") return renderPromotions(true);
    if (section === "reports") return renderReports();
    return renderSettings();
  };

  const hasList = ["users", "properties", "promotions", "payments"].includes(section);
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));

  if (authError) {
    return (
      <main className="admin-console admin-auth-error-page">
        <section className="admin-state admin-state-error" role="alert">
          <strong>Administrator access could not be confirmed</strong>
          <span>{authError}</span>
          <Link to="/dashboard">Return to dashboard</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-console">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand"><span>ND</span><strong>NyumbaDirect<small>CONTROL CENTER</small></strong></Link>
        <nav aria-label="Admin sections" className="admin-nav">
          {SECTIONS.map((item) => (
            <button type="button" key={item.id} className={section === item.id ? "active" : ""} onClick={() => changeSection(item.id)}>
              <span>{item.marker}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom"><span>{admin?.full_name || "Administrator"}</span><small>{admin?.email}</small><button type="button" onClick={signOut}>Sign out</button></div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div><span>NYUMBADIRECT / ADMIN</span><h1>{sectionLabel}</h1></div>
          <div className="admin-topbar-actions"><Link to="/" target="_blank" rel="noreferrer">View marketplace ↗</Link><button type="button" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button></div>
        </header>

        {hasList && (
          <form className="admin-filter-bar" onSubmit={applyFilters}>
            <label className="admin-filter-search"><span className="sr-only">Search {sectionLabel.toLowerCase()}</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder={section === "users" ? "Search name, email or phone" : section === "properties" ? "Search listing, location or owner" : "Search listing or account"} /></label>
            {section === "users" && <select aria-label="Role" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(0); }}><option value="">All roles</option><option value="HOUSE_HUNTER">House hunters</option><option value="LANDLORD">Landlords</option><option value="PROPERTY_MANAGER">Property managers</option><option value="ADMIN">Admins</option></select>}
            {section === "properties" && <select aria-label="Verification filter" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(0); }}><option value="">All verification states</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select>}
            <select aria-label="Status filter" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
              <option value="">All statuses</option>
              {section === "users" && <><option value="active">Active</option><option value="inactive">Inactive</option></>}
              {section === "properties" && <><option value="available">Available</option><option value="unavailable">Unavailable</option></>}
              {(section === "payments" || section === "promotions") && <><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="FAILED">Failed</option></>}
            </select>
            <button type="submit">Apply filters</button>
          </form>
        )}

        {notice && <div className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
        {error && data && <div className="admin-inline-error" role="alert">{error}</div>}
        <div className={`admin-content ${loading && data ? "is-refreshing" : ""}`}>
          {renderData()}
        </div>
        {hasList && data && totalPages > 1 && (
          <footer className="admin-pagination">
            <span>{data.total.toLocaleString()} records · Page {page + 1} of {totalPages}</span>
            <div><button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div>
          </footer>
        )}
      </section>
    </main>
  );
}

export default AdminDashboard;