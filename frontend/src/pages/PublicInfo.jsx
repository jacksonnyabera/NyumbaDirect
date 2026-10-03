import { Link, useLocation } from "react-router-dom";

const SUPPORT_EMAIL = "supportnyumbadirect@gmail.com";

function PublicInfo() {
  const { pathname } = useLocation();
  const page = pathname === "/privacy-policy"
    ? "privacy"
    : pathname === "/terms-conditions"
      ? "terms"
      : "contact";

  const title = page === "privacy"
    ? "Privacy Policy"
    : page === "terms"
      ? "Terms of Use"
      : "Contact NyumbaDirect";

  return (
    <main className="public-info-page">
      <div className="public-info-shell">
        <Link to="/" className="logo public-info-logo">Nyumba<span>Direct</span></Link>
        <p className="public-info-kicker">KENYA HOMES · DIRECT CONNECTIONS</p>
        <h1>{title}</h1>
        <p className="public-info-updated">Updated September 29, 2026</p>

        {page === "contact" && (
          <>
            <p>NyumbaDirect connects house hunters with landlords and property managers. For account, listing, verification, payment or safety questions, email our support team.</p>
            <a className="public-info-contact" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            <p>For a property inquiry, open the listing and use its Contact Landlord button so the conversation stays attached to the home.</p>
          </>
        )}

        {page === "privacy" && (
          <>
            <p>This policy explains how NyumbaDirect handles information when people search for homes, list a property, create an account or message another user.</p>
            <h2>Information used</h2>
            <p>Account information includes your name, email address, phone number and account type. Listing information can include property details, location, rent, photos and verification status. Messages are stored with the related property conversation. If you buy a listing promotion, payment status, phone number and the M-Pesa receipt reference may be recorded.</p>
            <p>To show landlords unique property-view totals, we store a random browser identifier locally and save only its hash with the viewed listing. Dashboard totals do not identify individual visitors.</p>
            <h2>How information is used</h2>
            <p>We use this information to operate accounts, show property listings, connect house hunters and property owners, support verification, deliver service notices and process paid property promotions.</p>
            <h2>What other users can see</h2>
            <p>Published listing details and photos are visible to site visitors. Your name and relevant contact information may be shown to the other participant in a property conversation so you can communicate directly.</p>
            <h2>Payments and service providers</h2>
            <p>M-Pesa payments are handled through Safaricom’s payment service. NyumbaDirect stores payment references and promotion status to confirm and manage a paid listing boost; it does not store an M-Pesa PIN.</p>
            <h2>Questions or requests</h2>
            <p>For privacy questions or requests concerning your account information, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
          </>
        )}

        {page === "terms" && (
          <>
            <p>These terms apply when you use NyumbaDirect to search for rental homes, publish a property listing, send messages or purchase a listing promotion.</p>
            <h2>Accounts and listings</h2>
            <p>Provide accurate account details and keep your sign-in information private. Landlords and property managers are responsible for accurate listing descriptions, rent, availability, photos and responses to house hunters. Do not list a home you are not authorized to represent.</p>
            <h2>Verification and property decisions</h2>
            <p>A verification badge means the account or listing completed NyumbaDirect’s review process; it is not a guarantee of ownership, availability, condition or suitability. House hunters should confirm details with the property owner and view the home before paying rent or a deposit.</p>
            <h2>Messages and transactions</h2>
            <p>Use the messaging tools for genuine property inquiries. Rental agreements and payments for rent or deposits are between the house hunter and property owner. NyumbaDirect does not collect rent or act as a party to those agreements.</p>
            <h2>Paid promotions</h2>
            <p>Available promotion packages and prices are displayed before payment. A promotion becomes active after the payment provider confirms payment. Promotion improves listing placement on the platform; it does not guarantee a viewing, tenant or rental.</p>
            <h2>Safety and misuse</h2>
            <p>Do not post misleading, unlawful or fraudulent listings, harass other users, or misuse contact information. NyumbaDirect may restrict or remove content or accounts that undermine user safety or platform operation.</p>
            <h2>Contact</h2>
            <p>Questions about these terms can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
          </>
        )}

        <div className="public-info-actions">
          <Link to="/properties">Browse homes</Link>
          <Link to="/">Back to home</Link>
        </div>
      </div>
    </main>
  );
}

export default PublicInfo;
