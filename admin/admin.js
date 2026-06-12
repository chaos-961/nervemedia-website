/*
 * SECURITY NOTE — this is client-side privacy, NOT authentication.
 *
 * The login below derives a PBKDF2 key from the password and uses it to
 * AES-GCM *decrypt* an embedded blob (payload.js). The password never leaves
 * the browser, but the encrypted payload ships to every visitor: anyone can
 * read it, and a determined attacker can brute-force a weak password offline.
 * Treat this only as obfuscation of low-sensitivity content.
 *
 * Do NOT store sensitive pricing, client, or personal data in the payload
 * unless/until this is backed by real server-side authentication.
 */
(function () {
  const form = document.getElementById("adminLoginForm");
  const nameInput = document.getElementById("adminName");
  const passwordInput = document.getElementById("adminPassword");
  const submitButton = document.getElementById("adminSubmit");
  const status = document.getElementById("adminStatus");
  const loginView = document.getElementById("loginView");
  const adminContent = document.getElementById("adminContent");
  const logoutButton = document.getElementById("adminLogout");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const body = document.body;
  const root = document.documentElement;

  const payload = window.NERVE_ADMIN_PAYLOAD;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let failedAttempts = 0;

  const setLoginTheme = () => {
    const setVar = (name, value) => {
      root.style.setProperty(name, value);
      body.style.setProperty(name, value, "important");
    };

    body.classList.remove("is-pricing-open", "is-light");
    body.style.setProperty("background-color", "#000", "important");
    body.style.setProperty("color", "#fff", "important");
    root.style.setProperty("background-color", "#000");
    setVar("--theme-bg-rgb", "0, 0, 0");
    setVar("--theme-fg-rgb", "255, 255, 255");
    setVar("--theme-inverse-rgb", "0, 0, 0");
    setVar("--theme-grid-opacity", "0.18");
    setVar("--theme-ambient-opacity", "0.18");
    setVar("--theme-field-opacity", "0.66");
    setVar("--theme-canvas-opacity", "0.86");
    setVar("--theme-grain-opacity", "0.045");
    root.dataset.themeTone = "dark";
    if (themeMeta) {
      themeMeta.setAttribute("content", "#000000");
    }
  };

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  const base64ToBytes = (value) => {
    const binary = window.atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };

  const deriveKey = async (password, salt, iterations) => {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  };

  const decryptPayload = async (password) => {
    if (!payload || payload.algorithm !== "AES-GCM" || payload.kdf !== "PBKDF2-SHA-256") {
      throw new Error("Missing admin payload.");
    }

    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const ciphertext = base64ToBytes(payload.ciphertext);
    const key = await deriveKey(password, salt, payload.iterations);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return JSON.parse(decoder.decode(plaintext));
  };

  const setPricingTheme = () => {
    const setVar = (name, value) => {
      root.style.setProperty(name, value);
      body.style.setProperty(name, value, "important");
    };

    body.classList.add("is-pricing-open", "is-light");
    body.style.setProperty("background-color", "#f5f5f0", "important");
    body.style.setProperty("color", "#000", "important");
    root.style.setProperty("background-color", "#f5f5f0");
    setVar("--theme-bg-rgb", "245, 245, 240");
    setVar("--theme-fg-rgb", "0, 0, 0");
    setVar("--theme-inverse-rgb", "255, 255, 255");
    setVar("--theme-grid-opacity", "0.1");
    setVar("--theme-ambient-opacity", "0.28");
    setVar("--theme-field-opacity", "0.24");
    setVar("--theme-canvas-opacity", "0.78");
    setVar("--theme-grain-opacity", "0.03");
    root.dataset.themeTone = "light";
    if (themeMeta) {
      themeMeta.setAttribute("content", "#f5f5f0");
    }
  };

  const renderAdmin = (bundle) => {
    const style = document.createElement("style");
    style.id = "pricingPayloadStyles";
    style.textContent = bundle.css;
    document.head.appendChild(style);

    setPricingTheme();
    window.requestAnimationFrame(setPricingTheme);
    window.setTimeout(setPricingTheme, 120);

    adminContent.innerHTML = bundle.html;
    loginView.hidden = true;
    adminContent.hidden = false;
    logoutButton.hidden = false;

    const script = document.createElement("script");
    script.id = "pricingPayloadScript";
    script.textContent = bundle.script;
    document.body.appendChild(script);

    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const setBusy = (busy) => {
    form.classList.toggle("is-busy", busy);
    submitButton.disabled = busy;
    nameInput.disabled = busy;
    passwordInput.disabled = busy;
  };

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  if (!window.crypto || !window.crypto.subtle) {
    setStatus("This browser cannot open the admin page.", true);
    setBusy(true);
    return;
  }

  setLoginTheme();

  logoutButton.addEventListener("click", () => {
    window.location.reload();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = nameInput.value.trim().toLowerCase();
    let password = passwordInput.value;

    if (username !== "admin") {
      setStatus("Check the name and password.", true);
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }

    setBusy(true);
    setStatus("Logging in...");

    try {
      const bundle = await decryptPayload(password);
      password = "";
      failedAttempts = 0;
      nameInput.value = "";
      passwordInput.value = "";
      renderAdmin(bundle);
    } catch (error) {
      failedAttempts += 1;
      await wait(Math.min(2200, 400 * failedAttempts));
      passwordInput.value = "";
      passwordInput.focus();
      setBusy(false);
      setStatus("Check the name and password.", true);
    }
  });
})();
