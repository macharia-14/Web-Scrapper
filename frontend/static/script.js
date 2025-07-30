const siteId = "d33711b1-e17c499e-8705-37c21877d8b6";

async function fetchAnalytics(siteId, startDate = null, endDate = null) {
  let url = `/analytics/${siteId}`;
  if (startDate && endDate) {
    url += `?start_date=${startDate}&end_date=${endDate}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch analytics");
    const data = await res.json();

    // Safe update helper
    const setIfExists = (id, value, suffix = '') => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${value}${suffix}`;
    };

    // General stats
    setIfExists("totalPageviews", data.total_pageviews);
    setIfExists("uniqueVisitors", data.unique_visitors);
    setIfExists("totalSessions", data.total_sessions);
    setIfExists("bounceRate", data.bounce_rate, '%');
    setIfExists("avgSessionDuration", data.avg_session_duration); // if applicable
    setIfExists("formSubmissions", data.form_submissions);
    setIfExists("jsErrors", data.js_errors);
    setIfExists("avgLoadTime", data.avg_load_time, 'ms');
    setIfExists("buttonClicks", data.button_clicks);

    // Pageview/visitor changes if calculated
    setIfExists("pageviewChange", `+${data.pageview_change}%`);
    setIfExists("visitorChange", `+${data.visitor_change}%`);

    // Optional: update charts or top pages if implemented
    if (window.updateReferrerChart && data.referrers) {
      updateReferrerChart(data.referrers);
    }
    if (window.updateDeviceChart && data.devices) {
      updateDeviceChart(data.devices);
    }
    if (window.updateTopPages && data.top_pages) {
      updateTopPages(data.top_pages);
    }

  } catch (err) {
    console.error("Failed to fetch analytics data:", err);
  }
}

async function fetchSites() {
  try {
    const response = await fetch(`/sites`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const sites = await response.json();
    displaySites(sites);
  } catch (error) {
    console.error("Failed to fetch sites:", error);
    document.getElementById("sitesGrid").innerHTML = '<div class="error">Failed to load sites</div>';
  }
}

function displaySites(sites) {
  const sitesGrid = document.getElementById("sitesGrid");
  
  if (sites.length === 0) {
    sitesGrid.innerHTML = '<div class="no-sites">No sites found. Create your first site!</div>';
    return;
  }
  
  sitesGrid.innerHTML = sites.map(site => `
    <div class="site-card">
      <div class="site-header">
        <h3>${site.name}</h3>
        <div class="site-status ${site.is_active ? 'active' : 'inactive'}">
          <span class="status-dot"></span>
          ${site.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>
      <div class="site-details">
        <div class="detail-item">
          <i class="fas fa-globe"></i>
          <span>${site.domain}</span>
        </div>
        <div class="detail-item">
          <i class="fas fa-user"></i>
          <span>${site.owner}</span>
        </div>
        <div class="detail-item">
          <i class="fas fa-calendar"></i>
          <span>Created: ${new Date(site.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="site-actions">
        <button class="btn btn-sm btn-primary" onclick="showTrackingUrl('${site.id}')">
          <i class="fas fa-code"></i> Get Code
        </button>
        <button class="btn btn-sm btn-secondary" onclick="viewSiteAnalytics('${site.id}')">
          <i class="fas fa-chart-bar"></i> Analytics
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteSite('${site.id}', '${site.name}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
}

function viewSiteAnalytics(siteId) {
  // Switch to analytics page and load data for this specific site
  const analyticsLink = document.querySelector('[data-page="analytics"]');
  analyticsLink.click();
  fetchAnalytics(siteId);
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
      } else if (pageId === "sites") {
        fetchSites();
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

  
document.addEventListener('DOMContentLoaded', () => {
  const SITE_ID = 'your-site-id-here'; // Inject dynamically if needed
  const API_BASE = 'http://localhost:8001';

  async function fetchAnalytics(startDate = null, endDate = null) {
    let url = `${API_BASE}/analytics/${SITE_ID}`;
    const params = [];

    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join('&')}`;

    const res = await fetch(url);
    const data = await res.json();
    updateAnalyticsUI(data);
  }

  function updateAnalyticsUI(data) {
    // Top Pages
    const topPagesList = document.getElementById('topPagesList');
    topPagesList.innerHTML = data.top_pages.map(p =>
      `<div>${p.url} - ${p.views} views</div>`
    ).join('');

    // Referrer Chart (basic example)
    const referrerChart = document.getElementById('referrerChart');
    referrerChart.innerHTML = data.referrer_stats.map(r =>
      `<div>${r.referrer}: ${r.count}</div>`
    ).join('');

    // Device Breakdown
    const deviceChart = document.getElementById('deviceChart');
    deviceChart.innerHTML = data.device_stats.map(d =>
      `<div>${d.device}: ${d.count}</div>`
    ).join('');

    // Performance Metrics
    document.getElementById('avgLoadTime').textContent = `${data.avg_load_time}ms`;
    document.getElementById('formSubmissions').textContent = data.form_submissions;
    document.getElementById('jsErrors').textContent = data.error_count;
    document.getElementById('bounceRate').textContent = `${data.bounce_rate}%`;

    // Heatmap and others – plug in charting libs as needed (e.g., Chart.js, Plotly, etc.)
  }

  // Hook to date picker
  document.getElementById('applyDateRange').addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    fetchAnalytics(start, end);
  });

  // Initial Load
  fetchAnalytics();
});



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

          const res = await fetch("/sites", {
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
          // Refresh the sites list
            fetchSites();
          // Clear the form fields
            document.getElementById("siteForm").reset();
          } else {
            alert("Error: " + result.detail);
          }
        });
        // Function to show the tracking URL (call this after successful form submission)
        function showTrackingUrl(siteId) {
            const trackingUrl = `<script src="/tracking-script/${siteId}"></script>`;
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


  async function deleteSite(siteId, siteName) {
  // Show confirmation dialog
  if (!confirm(`Are you sure you want to delete "${siteName}"? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/sites/${siteId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Show success message
    showToast(`Site "${siteName}" deleted successfully!`, "success");
    
    // Refresh the sites list
    fetchSites();
    
  } catch (error) {
    console.error("Failed to delete site:", error);
    showToast("Failed to delete site. Please try again.", "error");
  }
}
