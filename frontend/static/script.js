const siteId = "aad28051-6dcb-4ce9-8ba5-ba8fc4f8b784";

async function fetchAnalytics(siteId) {
  try {
    const response = await fetch(`http://localhost:8001/analytics/${siteId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Analytics data:", data);
    // TODO: Update the UI with analytics data
  } catch (error) {
    console.error("Failed to fetch analytics data:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // ========== 1. Sidebar Navigation ==========
  const navLinks = document.querySelectorAll(".nav-link");
  const pages = document.querySelectorAll(".page");

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Navigation link clicked:", link);

      // Remove active class from all links
      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      // Hide all pages
      pages.forEach((page) => page.classList.remove("active"));

      // Show the selected page
      const pageId = link.getAttribute("data-page");
      console.log("Showing page:", pageId);
      const pageElement = document.getElementById(pageId);
      if (pageElement) {
        pageElement.classList.add("active");
      } else {
        console.warn("Page element not found for id:", pageId);
      }

      // Fetch analytics data when navigating to analytics page
      if (pageId === "analytics") {
        fetchAnalytics(siteId);
      }
    });
  });

  // ========== 2. Analytics Tabs ==========
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all tabs and contents
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((tab) => tab.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab)?.classList.add("active");
    });
  });

  // ========== 3. Toggle Add Site Form ==========
  const addSiteBtn = document.getElementById("addSiteBtn");
  const addSiteForm = document.getElementById("addSiteForm");
  const cancelSiteBtn = document.getElementById("cancelSiteBtn");

  addSiteBtn?.addEventListener("click", () => addSiteForm.classList.remove("hidden"));
  cancelSiteBtn?.addEventListener("click", () => addSiteForm.classList.add("hidden"));

  // ========== 4. Toggle Add Alert Form ==========
  const addAlertBtn = document.getElementById("addAlertBtn");
  const addAlertForm = document.getElementById("addAlertForm");
  const cancelAlertBtn = document.getElementById("cancelAlertBtn");

  addAlertBtn?.addEventListener("click", () => addAlertForm.classList.remove("hidden"));
  cancelAlertBtn?.addEventListener("click", () => addAlertForm.classList.add("hidden"));

  // ========== 5. Dummy Dynamic Values ==========
  document.getElementById("activeUsers").innerText = "134";
  document.getElementById("totalPageviews").innerText = "3,452";
  document.getElementById("uniqueVisitors").innerText = "1,219";
  document.getElementById("buttonClicks").innerText = "837";

  document.getElementById("pageviewChange").innerText = "+8%";
  document.getElementById("visitorChange").innerText = "+5%";
  document.getElementById("clickChange").innerText = "+3%";

  // ========== 6. Dummy Chart.js Chart ==========
  const pageviewsChart = document.getElementById("pageviewsChart");
  if (pageviewsChart) {
    new Chart(pageviewsChart, {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [{
          label: "Pageviews",
          data: [230, 280, 350, 420, 390, 500, 600],
          borderColor: "#3b82f6",
          fill: true,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  // ========== 7. Dummy Plotly Bar Chart ==========
  const topPagesChart = document.getElementById("topPagesChart");
  if (topPagesChart) {
    Plotly.newPlot("topPagesChart", [{
      x: ["Home", "Blog", "Shop", "Contact"],
      y: [1200, 800, 600, 300],
      type: "bar",
      marker: { color: "#3b82f6" }
    }], {
      margin: { t: 30 },
      title: "Top Pages"
    });
  }

  // ========== 8. Optional: Toast Notification Placeholder ==========
  // showToast("Dashboard loaded successfully!", "success");

  // ========== 9. Refresh Button ==========
  document.getElementById("refreshBtn")?.addEventListener("click", () => {
    showToast("Data refreshed!", "info");
  });

  // ========== 10. Toast Function ==========
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon"><i class="fas fa-info-circle"></i></div>
      <div class="toast-content">
        <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
});

      document
        .getElementById("siteForm")
        .addEventListener("submit", async (e) => {
          e.preventDefault(); // Prevent default form reload

          const data = {
            name: document.getElementById("siteName").value,
            domain: document.getElementById("siteDomain").value,
            owner: document.getElementById("siteOwner").value,
          };

          const res = await fetch("http://localhost:8001/sites", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });

          const result = await res.json();

          if (res.ok) {
            // Show the generated tracking script URL
           showTrackingUrl(result.id);
          } else {
            alert("Error: " + result.detail);
          }
        });
        // Function to show the tracking URL (call this after successful form submission)
        function showTrackingUrl(siteId) {
            const trackingUrl = `http://localhost:8001/tracking-script/${siteId}`;
            document.getElementById('trackingUrlText').value = trackingUrl;
            document.getElementById('trackingUrlContainer').style.display = 'block';
        }

        // Function to copy the tracking URL to clipboard
        function copyTrackingUrl() {
            const urlInput = document.getElementById('trackingUrlText');
            const copyBtn = document.getElementById('copyUrlBtn');
            
            // Select and copy the text
            urlInput.select();
            urlInput.setSelectionRange(0, 99999); // For mobile devices
            
            navigator.clipboard.writeText(urlInput.value).then(function() {
                // Success feedback
                copyBtn.textContent = '✅ Copied!';
                copyBtn.classList.add('copied');
                
                setTimeout(function() {
                    copyBtn.textContent = '📋 Copy';
                    copyBtn.classList.remove('copied');
                }, 2000);
            }).catch(function(err) {
                // Fallback for older browsers
                document.execCommand('copy');
                
                copyBtn.textContent = '✅ Copied!';
                copyBtn.classList.add('copied');
                
                setTimeout(function() {
                    copyBtn.textContent = '📋 Copy';
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
        }
        
    function showTrackingResult(result) {
          showTrackingUrl(result.id);
        }

  //Export feature
    document.getElementById('exportCsv').addEventListener('click', () => {
        const startDate = document.getElementById('csvStartDate').value;
        const endDate = document.getElementById('csvEndDate').value;

        let url = `/analytics/${siteId}/export/csv`;
        if (startDate || endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }
        window.location.href = url;
    });

    document.getElementById('exportPdf').addEventListener('click', () => {
        const startDate = document.getElementById('pdfStartDate').value;
        const endDate = document.getElementById('pdfEndDate').value;

        let url = `/analytics/${siteId}/export/pdf`;
        if (startDate || endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }
        window.location.href = url;
    });
