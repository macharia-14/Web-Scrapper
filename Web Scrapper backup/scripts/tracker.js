(function () {
  const SITE_ID = "{{SITE_ID}}"; // Will be injected by your backend dynamically
  const TRACKING_ENDPOINT = "https://yourdomain.com/api/track"; // Replace with your backend domain

  // Create a unique visitor ID (stored in localStorage)
  const getVisitorId = () => {
    const key = "tracker_visitor_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "v_" + Math.random().toString(36).substring(2) + Date.now();
      localStorage.setItem(key, id);
    }
    return id;
  };

  const visitorId = getVisitorId();

  // Common event payload structure
  const basePayload = {
    site_id: SITE_ID,
    visitor_id: visitorId,
    url: window.location.href,
    referrer: document.referrer,
    user_agent: navigator.userAgent,
    screen_resolution: `${screen.width}x${screen.height}`,
    timestamp: new Date().toISOString()
  };

  // Send tracking event
  const sendEvent = (type, extraData = {}) => {
    const payload = { ...basePayload, type, ...extraData };
    fetch(TRACKING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(console.error);
  };

  // Track page view
  sendEvent("pageview");

  // Track scroll depth (first time user scrolls 50% or more)
  let scrolled = false;
  window.addEventListener("scroll", () => {
    if (scrolled) return;
    const scrollDepth = window.scrollY + window.innerHeight;
    const totalHeight = document.body.scrollHeight;
    if (scrollDepth / totalHeight > 0.5) {
      scrolled = true;
      sendEvent("scroll", { scroll_depth: "50%" });
    }
  });

  // Track clicks on links/buttons
  document.addEventListener("click", (e) => {
    const target = e.target.closest("a, button");
    if (!target) return;

    sendEvent("click", {
      tag: target.tagName,
      text: (target.innerText || "").trim().slice(0, 100)
    });
  });

  // Track JS errors
  window.onerror = (msg, url, line, col, error) => {
    sendEvent("js_error", {
      message: msg,
      url,
      line,
      col
    });
  };

  // Track time on page (when user leaves or closes tab)
  const startTime = Date.now();
  window.addEventListener("beforeunload", () => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    sendEvent("duration", { seconds: duration });
  });
})();
