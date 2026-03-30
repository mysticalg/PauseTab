import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_PAUSETAB_API_BASE_URL ?? "http://localhost:8787";
const ACTIVATION_CODE_STORAGE_KEY = "pausetab-activation-code";
const ACTIVATION_SESSION_STORAGE_KEY = "pausetab-activation-session";

const state = {
  billingReady: false,
};

const backendStatus = document.getElementById("backend-status");
const stripeStatus = document.getElementById("stripe-status");
const checkoutStatus = document.getElementById("checkout-status");
const successCard = document.getElementById("success-card");
const activationCodeElement = document.getElementById("activation-code");
const copyActivationButton = document.getElementById("copy-activation");
const portalForm = document.getElementById("portal-form");
const portalStatus = document.getElementById("portal-status");
const portalCodeInput = document.getElementById("portal-code");

const setInlineStatus = (node, message, tone = "muted") => {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.dataset.tone = tone;
};

const fetchJson = async (path, options) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  return response.json();
};

const refreshBackendStatus = async () => {
  try {
    const data = await fetchJson("/api/auth/status");
    backendStatus.textContent = data.ok ? "Backend reachable" : "Backend error";
    backendStatus.dataset.variant = data.ok ? "success" : "danger";
    stripeStatus.textContent = data.stripeReady ? "Stripe configured" : "Stripe not configured";
    stripeStatus.dataset.variant = data.stripeReady ? "success" : "warning";
    state.billingReady = Boolean(data.stripeReady);
  } catch {
    backendStatus.textContent = "Backend offline";
    backendStatus.dataset.variant = "danger";
    stripeStatus.textContent = "Billing unavailable";
    stripeStatus.dataset.variant = "warning";
    state.billingReady = false;
  }
};

const checkout = async (plan) => {
  if (!state.billingReady) {
    setInlineStatus(checkoutStatus, "Stripe is not configured yet on the backend.", "warning");
    return;
  }

  setInlineStatus(checkoutStatus, "Creating checkout session…");
  try {
    const data = await fetchJson("/api/billing/checkout-session", {
      method: "POST",
      body: JSON.stringify({
        plan,
        successUrl: `${window.location.origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/?checkout=cancelled`,
      }),
    });

    if (!data.ok || !data.url) {
      setInlineStatus(checkoutStatus, data.error ?? "Checkout could not be started.", "danger");
      return;
    }

    window.location.href = data.url;
  } catch {
    setInlineStatus(checkoutStatus, "Checkout request failed.", "danger");
  }
};

const claimCheckoutSession = async (sessionId) => {
  setInlineStatus(checkoutStatus, "Claiming activation code from completed checkout…");
  try {
    const data = await fetchJson(`/api/license/claim?sessionId=${encodeURIComponent(sessionId)}`);
    if (!data.ok) {
      setInlineStatus(checkoutStatus, data.error ?? "Could not claim activation code.", "danger");
      return;
    }

    const activationCode = data.activationCode;
    localStorage.setItem(ACTIVATION_CODE_STORAGE_KEY, activationCode);
    localStorage.setItem(ACTIVATION_SESSION_STORAGE_KEY, sessionId);
    if (portalCodeInput) {
      portalCodeInput.value = activationCode;
    }

    successCard.hidden = false;
    activationCodeElement.textContent = activationCode;
    setInlineStatus(checkoutStatus, `Checkout claimed for ${data.license.accountEmail}.`, "success");
    window.location.hash = "activation";
  } catch {
    setInlineStatus(checkoutStatus, "Activation claim failed.", "danger");
  }
};

const restoreActivationCode = () => {
  const activationCode = localStorage.getItem(ACTIVATION_CODE_STORAGE_KEY);
  if (activationCode && portalCodeInput) {
    portalCodeInput.value = activationCode;
  }

  return activationCode;
};

document.querySelectorAll(".checkout-button").forEach((button) => {
  button.addEventListener("click", () => {
    const plan = button.getAttribute("data-plan");
    if (plan) {
      void checkout(plan);
    }
  });
});

copyActivationButton?.addEventListener("click", async () => {
  const value = activationCodeElement.textContent;
  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(value);
  copyActivationButton.textContent = "Copied";
  window.setTimeout(() => {
    copyActivationButton.textContent = "Copy code";
  }, 1200);
});

portalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const activationCode = portalCodeInput?.value?.trim();
  if (!activationCode) {
    setInlineStatus(portalStatus, "Enter an activation code first.", "warning");
    return;
  }

  setInlineStatus(portalStatus, "Opening Stripe billing portal…");
  try {
    const data = await fetchJson("/api/billing/portal-session", {
      method: "POST",
      body: JSON.stringify({
        activationCode,
        returnUrl: window.location.href,
      }),
    });

    if (!data.ok || !data.url) {
      setInlineStatus(portalStatus, data.error ?? "Billing portal could not be opened.", "danger");
      return;
    }

    window.location.href = data.url;
  } catch {
    setInlineStatus(portalStatus, "Portal request failed.", "danger");
  }
});

await refreshBackendStatus();
const storedActivationCode = restoreActivationCode();

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");
if (sessionId) {
  if (storedActivationCode && localStorage.getItem(ACTIVATION_SESSION_STORAGE_KEY) === sessionId) {
    successCard.hidden = false;
    activationCodeElement.textContent = storedActivationCode;
    setInlineStatus(checkoutStatus, "Recovered your stored activation code for this checkout session.", "success");
  } else {
    void claimCheckoutSession(sessionId);
  }
}

if (params.get("checkout") === "cancelled") {
  setInlineStatus(checkoutStatus, "Checkout was cancelled. Your free tier still works.", "warning");
}
