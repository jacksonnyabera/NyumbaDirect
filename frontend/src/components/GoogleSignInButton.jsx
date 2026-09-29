import { useEffect, useRef, useState } from "react";

let googleScriptPromise;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    if (window.google?.accounts?.id) resolve();
  });

  return googleScriptPromise;
}

function GoogleSignInButton({ onCredential, text = "signin_with" }) {
  const buttonRef = useRef(null);
  const credentialHandler = useRef(onCredential);
  const [error, setError] = useState("");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    credentialHandler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setError("Google sign-in is not configured yet.");
      return () => { active = false; };
    }

    loadGoogleIdentity()
      .then(() => {
        if (!active || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => credentialHandler.current?.(response.credential),
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          width: Math.min(buttonRef.current.clientWidth || 360, 360),
        });
        setError("");
      })
      .catch(() => {
        if (active) setError("Google sign-in could not load. Check your connection and try again.");
      });

    return () => { active = false; };
  }, [clientId, text]);

  return (
    <div className="google-signin-wrap">
      <div ref={buttonRef} className="google-signin-button" />
      {error && <small className="auth-hint" role="status">{error}</small>}
    </div>
  );
}

export default GoogleSignInButton;
