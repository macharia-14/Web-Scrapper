let currentSiteId = null; // Will be set when user selects a site
let heatmapInstance = null; // Define globally, initialize when needed
let scrollmapInstance = null; // For the scrollmap

// ✅ Define globally so all functions can use it
function setIfExists(id, value, suffix = '') {
  const el = document.getElementById(id);
  if (el) el.textContent = `${value}${suffix}`;
}


async function fetchAnalytics(siteId, startDate = null, endDate = null) {
  const targetSiteId = siteId || currentSiteId;
  if (!targetSiteId) {
    console.warn('No site selected for analytics');
    return;
  }
  

  let url = `/analytics/${targetSiteId}`;
  if (startDate && endDate) {
    url += `?start_date=${startDate}&end_date=${endDate}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch analytics");
    const rawData = await res.json();

    // The backend might be wrapping the response in a parent object (e.g., "analytics").
    // This change unwraps it, falling back to the original object if the key doesn't exist.
    const data = rawData.analytics || rawData;

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

    // Update performance metrics on the Analytics page specifically, using their unique IDs.
    setIfExists("analytics-avgLoadTime", data.avg_load_time, 'ms');
    setIfExists("analytics-formSubmissions", data.form_submissions);
    setIfExists("analytics-jsErrors", data.js_errors);
    setIfExists("analytics-bounceRate", data.bounce_rate, '%');

    // Update analytics page components
    updateReferrerChart(data.referrer_stats);
    updateDeviceChart(data.device_stats);
    updateTopPages(data.top_pages);
    updateBehavior(data);
    updatePerformance(data); // Add performance updates

  } catch (err) {
    console.error("Failed to fetch analytics data:", err);
  }
}

function updateReferrerChart(referrers) {
  const chartContainer = document.getElementById("referrerChart");
  if (!chartContainer) return;

  const referrerData = referrers || [];

  if (referrerData.length === 0) {
    chartContainer.innerHTML = "<p>No referrer data available.</p>";
    return;
  }

  // Data is already sorted by backend, but we can re-sort just in case and slice
  const topReferrers = referrerData.sort((a, b) => b.count - a.count).slice(0, 8);
  const labels = topReferrers.map(item => item.referrer);
  const values = topReferrers.map(item => item.count);

  const plotData = [{
    y: labels,
    x: values,
    type: 'bar',
    orientation: 'h', // Horizontal is better for potentially long referrer names
    marker: { color: '#10b981' }
  }];

  const layout = {
    margin: { t: 10, b: 40, l: 120, r: 20 },
    yaxis: { automargin: true },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#a0aec0' }
  };

  Plotly.newPlot(chartContainer, plotData, layout, { responsive: true, displayModeBar: false });
}

function updateDeviceChart(devices) {
  const chartContainer = document.getElementById("deviceChart");
  if (!chartContainer) return;

  const deviceData = devices || [];

  if (deviceData.length === 0) {
    chartContainer.innerHTML = "<p>No device data available.</p>";
    return;
  }

  const labels = deviceData.map(item => item.device);
  const values = deviceData.map(item => item.count);

  const plotData = [{ x: labels, y: values, type: 'bar', marker: { color: ['#3b82f6', '#ef4444', '#f97316'] } }];
  const layout = {
    margin: { t: 10, b: 40, l: 50, r: 20 },
    yaxis: { title: 'Count' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#a0aec0' }
  };

  Plotly.newPlot(chartContainer, plotData, layout, { responsive: true, displayModeBar: false });
}

function updateTopPages(pages) {
  const chartContainer = document.getElementById("analyticsTopPagesChart");
  if (!chartContainer) return;

  const pageData = pages || [];

  if (pageData.length === 0) {
    chartContainer.innerHTML = "<p>No top pages data available.</p>";
    return;
  }

  // Sort pages by views and take the top 10 for clarity
  const sortedPages = pageData.sort((a, b) => b.views - a.views).slice(0, 10);

  const paths = sortedPages.map(p => {
    try {
      return new URL(p.url).pathname; // Use pathname for cleaner labels
    } catch (e) {
      return p.url;
    }
  });
  const views = sortedPages.map(p => p.views);

  const plotData = [{
    x: paths,
    y: views,
    type: 'bar',
    marker: { color: '#3b82f6' }
  }];

  const layout = {
    margin: { t: 10, b: 120, l: 50, r: 20 }, // Adjust margin for labels
    xaxis: { tickangle: -45 },
    yaxis: { title: 'Views' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#a0aec0' }
  };

  Plotly.newPlot(chartContainer, plotData, layout, { responsive: true, displayModeBar: false });
}

function updateBehavior(data) {
  // Data for this section is likely nested under a "behavior" key, similar to "performance".
  const behaviorData = data.behavior || {};
  // 1. User Journey Visualization
  const journeyContainer = document.getElementById("userJourneyViz");
  if (journeyContainer) {
    // Correct key to singular 'user_journey' and check both the nested 'behavior' object
    // and the top-level data object to ensure the data is found.
    const journeys = behaviorData.user_journey || data.user_journey || [];
    const content = journeys
      .map((journey) => {
        // Extract just the path from the URL for readability
        const pathOnly = journey.pages.map(page => {
          try {
            return new URL(page.url).pathname;
          } catch (e) {
            return page.url; // Fallback for invalid URLs
          }
        });
        // Display a truncated user ID for privacy/brevity
        const shortUserId = journey.user_id.substring(0, 8);
        return `<div>User (${shortUserId}...): ${pathOnly.join(" → ")}</div>`;
      })
      .join("");
    journeyContainer.innerHTML = content || "<div>No user journey data available.</div>";
  }

  // 2. Click Patterns
  const clickPatternsContainer = document.getElementById("clickPatterns");
  if (clickPatternsContainer) {
    const totalClicks = data.button_clicks;
    if (typeof totalClicks === 'number') {
      clickPatternsContainer.innerHTML = `<div>Total Button Clicks: ${totalClicks}</div><p style="font-size: 0.8em; color: #a0aec0; margin-top: 5px;">Detailed click positions are available in the 'Heatmap' tab.</p>`;
    } else {
      clickPatternsContainer.innerHTML = "<div>No click pattern data available.</div>";
    }
  }
}

function updatePerformance(data) {
    const performanceData = data.performance || {};

    // 1. Page Load Chart
    const loadTimeChartContainer = document.getElementById("loadTimeChart");
    if (loadTimeChartContainer) {
        const loadData = (performanceData.load_times || []).sort((a, b) => b.time - a.time).slice(0, 10); // Sort and take top 10

        if (loadData.length === 0) {
            loadTimeChartContainer.innerHTML = "<p>No load time data available.</p>";
        } else {
            const labels = loadData.map(item => {
                try {
                    return new URL(item.page).pathname; // Cleaner labels
                } catch (e) {
                    return item.page;
                }
            });
            const values = loadData.map(item => item.time);

            const plotData = [{
                y: labels,
                x: values,
                type: 'bar',
                orientation: 'h',
                marker: { color: '#ef4444' } // Red for performance issues
            }];

            const layout = {
                margin: { t: 10, b: 40, l: 150, r: 20 },
                xaxis: { title: 'Load Time (ms)' },
                yaxis: { automargin: true },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#a0aec0' }
            };

            Plotly.newPlot(loadTimeChartContainer, plotData, layout, { responsive: true, displayModeBar: false });
        }
    }

    // 2. Error Chart
    const errorChartContainer = document.getElementById("errorChart");
    if (errorChartContainer) {
        const errorData = performanceData.error_counts || {};
        const errorEntries = Object.entries(errorData);

        if (errorEntries.length === 0) {
            errorChartContainer.innerHTML = "<p>No error data available.</p>";
        } else {
            const labels = errorEntries.map(([type]) => type);
            const values = errorEntries.map(([, count]) => count);

            const plotData = [{ x: labels, y: values, type: 'bar', marker: { color: '#f97316' } }]; // Orange for errors
            const layout = {
                margin: { t: 10, b: 40, l: 50, r: 20 },
                yaxis: { title: 'Count' },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#a0aec0' }
            };

            Plotly.newPlot(errorChartContainer, plotData, layout, { responsive: true, displayModeBar: false });
        }
    }
}

async function populateHeatmapPages(siteId) {
  const pageSelect = document.getElementById("heatmapPageSelect");
  if (!pageSelect) return;

  // Show a loading state
  pageSelect.innerHTML = '<option value="">Loading pages...</option>';
  pageSelect.disabled = true;

  try {
    // NOTE: Using a RESTful URL consistent with other API calls
    const res = await fetch(`/analytics/${siteId}/heatmap/pages`);
    if (!res.ok) throw new Error("Failed to fetch pages for heatmap");

    const pages = await res.json();
    pageSelect.innerHTML = ""; // Clear loading state

    if (pages.length === 0) {
      pageSelect.innerHTML = '<option value="">No pages found</option>';
      return;
    }

    pages.forEach((page) => {
      const option = document.createElement("option");
      option.value = page;
      option.textContent = (page === "/" || page === "") ? "Homepage" : page;
      pageSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Failed to load heatmap pages:", err);
    pageSelect.innerHTML = '<option value="">Error loading pages</option>';
  } finally {
    pageSelect.disabled = false;
  }
}

function initializeHeatmap() {
  if (heatmapInstance) return; // Already initialized

  const container = document.getElementById('clickHeatmap');
  if (!container) return; // Container not on page

  heatmapInstance = h337.create({
    container: container,
    radius: 40,
    maxOpacity: 0.6,
    minOpacity: 0.1,
    blur: 0.85,
  });
}

async function fetchAndRenderClickHeatmap() {
  if (!currentSiteId) return;

  initializeHeatmap();
  if (!heatmapInstance) return;

  const page = document.getElementById("heatmapPageSelect").value;
  if (!page) {
    heatmapInstance.setData({ max: 0, data: [] }); // Clear heatmap if no page selected
    return;
  }

  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  try {
    let url = `/heatmap/clicks?site_id=${currentSiteId}&page=${page}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch heatmap data');
    const rawData = await res.json();

    const formattedData = rawData.map(pt => ({
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      value: 1, // Each click has a value of 1
    }));

    heatmapInstance.setData({
      max: 5, // Determines the "hotness" threshold. Adjust as needed.
      data: formattedData,
    });
  } catch (err) {
    console.error("Failed to render click heatmap:", err);
    heatmapInstance.setData({ max: 0, data: [] }); // Clear on error
  }
}

function initializeScrollmap() {
  if (scrollmapInstance) return;
  const container = document.getElementById('scrollHeatmap');
  if (!container) return;

  scrollmapInstance = h337.create({
    container: container,
    radius: 50,
    maxOpacity: 0.8,
    // A scrollmap is a vertical gradient
    gradient: {
      '.2': 'blue',
      '.5': 'green',
      '.8': 'yellow',
      '.95': 'red'
    }
  });
}

async function fetchAndRenderScrollmap() {
  if (!currentSiteId) return;

  initializeScrollmap();
  if (!scrollmapInstance) return;

  const page = document.getElementById("heatmapPageSelect").value;
  if (!page) {
    scrollmapInstance.setData({ max: 0, data: [] });
    return;
  }

  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  try {
    let url = `/analytics/${currentSiteId}/scrollmap?page=${page}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch scrollmap data');
    const rawData = await res.json();

    if (rawData.length === 0) {
      scrollmapInstance.setData({ max: 0, data: [] });
      return;
    }

    const container = document.getElementById('scrollHeatmap');
    const max_value = rawData[0]?.total_sessions || 1;
    const formattedData = rawData.map(pt => ({ x: Math.floor(container.offsetWidth / 2), y: Math.floor(container.offsetHeight * (pt.y_percent / 100)), value: pt.value }));

    scrollmapInstance.setData({ max: max_value, data: formattedData });
  } catch (err) {
    console.error("Failed to render scrollmap:", err);
    scrollmapInstance.setData({ max: 0, data: [] });
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

// ADD this function after the displaySites function:
async function populateSiteDropdown() {
  try {
    const response = await fetch('/sites');
    if (!response.ok) throw new Error('Failed to fetch sites');
    
    const sites = await response.json();
    const siteSelect = document.getElementById('siteSelect');
    
    // Clear existing options except the first one
    siteSelect.innerHTML = '<option value="">Select a site...</option>';
    
    // Add sites to dropdown
    sites.forEach(site => {
      const option = document.createElement('option');
      option.value = site.id;
      option.textContent = `${site.name} (${site.domain})`;
      siteSelect.appendChild(option);
    });
    
    // If there's only one site, auto-select it
    if (sites.length === 1) {
      siteSelect.value = sites[0].id;
      currentSiteId = sites[0].id;
      await fetchAnalytics(currentSiteId);
      updateDashboardStats();
    }
    
  } catch (error) {
    console.error('Failed to populate site dropdown:', error);
  }
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

      // Remove active class from all links
      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      // Hide all pages
      pages.forEach((page) => page.classList.remove("active"));

      // Show the selected page
      const pageId = link.getAttribute("data-page");
      
      const pageElement = document.getElementById(pageId);
      if (pageElement) {
        pageElement.classList.add("active");
      } else {
        console.warn("Page element not found for id:", pageId);
      }

      // Fetch analytics data when navigating to analytics page
      if (pageId === "analytics" && currentSiteId) {
        fetchAnalytics(currentSiteId);
      } else if (pageId === "sites") {
        fetchSites();
      } else if (pageId === "dashboard" && currentSiteId) {
        updateDashboardStats();
      }
      // ADDED: Load data when navigating to the Alerts page
      else if (pageId === "alerts") {
        loadAlertsPage();
      }
    });
  });

  // ========== 10. Analytics Page Toggles ==========
  const heatmapToggleButton = document.getElementById('toggleHeatmapType');
  const clickHeatmapContainer = document.getElementById('clickHeatmap');
  const scrollHeatmapContainer = document.getElementById('scrollHeatmap');
  const heatmapTitle = document.getElementById('heatmapTitle');

  heatmapToggleButton?.addEventListener('click', () => {
    const isShowingClickmap = clickHeatmapContainer.style.display !== 'none';
    if (isShowingClickmap) {
      // Switch to scrollmap
      clickHeatmapContainer.style.display = 'none';
      scrollHeatmapContainer.style.display = 'block';
      heatmapTitle.textContent = 'Scroll Map';
      heatmapToggleButton.textContent = 'Show Clickmap';
      fetchAndRenderScrollmap();
    } else {
      // Switch back to clickmap
      scrollHeatmapContainer.style.display = 'none';
      clickHeatmapContainer.style.display = 'block';
      heatmapTitle.textContent = 'Click Heatmap';
      heatmapToggleButton.textContent = 'Show Scrollmap';
    }
  });
  const timeOnElementToggle = document.getElementById('timeOnElementToggle');
  const timeOnElementContainer = document.getElementById('timeOnElementContainer');

  if (timeOnElementToggle && timeOnElementContainer) {
    timeOnElementToggle.addEventListener('change', () => {
      if (timeOnElementToggle.checked) {
        timeOnElementContainer.style.display = 'block';
        fetchTimeOnElementData(currentSiteId);
      } else {
        timeOnElementContainer.style.display = 'none';
      }
    });
  }

  // Mobile/Desktop toggle handled in overview tab
  const deviceToggleRadios = document.querySelectorAll('input[name="deviceToggle"]');
  deviceToggleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (!currentSiteId) return;
      fetchAnalytics(currentSiteId);
    });
  });

function renderTimeOnElementHeatmap(data) {
  const container = document.getElementById('timeOnElementChart');
  if (!container) return;
  // Placeholder: Render time-on-element heatmap visualization
  container.innerHTML = '<p>Time-on-element heatmap visualization coming soon.</p>';
}

  // ========== Site Dropdown Change Handler ==========
  document.getElementById('siteSelect')?.addEventListener('change', async (e) => {
    currentSiteId = e.target.value;
    
    if (currentSiteId) {
      showToast(`Switched to ${e.target.selectedOptions[0].textContent}`, 'success');
      await fetchAnalytics(currentSiteId);
      await updateDashboardStats();

      // If heatmap tab is active, refresh its data
      if (document.querySelector('.tab-btn[data-tab="heatmap"].active')) {
        populateHeatmapPages(currentSiteId);
      }
    } else {
      // Clear dashboard when no site selected
      clearDashboardData();
    }
  });

  // ========== Time Range Dropdown Change Handler ==========
document.getElementById('topPagesFilter')?.addEventListener('change', async (e) => {
  const timeRange = e.target.value;
  
  if (currentSiteId) {
    // Update the label in the Top Pages header
    const label = document.getElementById('topPagesTimeLabel');
    if (label) {
      const labelText = timeRange === 'today' ? 'Today' : 
                       timeRange === 'week' ? 'This Week' : 'This Month';
      label.textContent = labelText;
    }
    
    // Fetch analytics data for the selected time range
    await updateDashboardWithTimeRange(timeRange);
    showToast(`Updated to ${e.target.selectedOptions[0].textContent}`, 'success');
  } else {
    showToast('Please select a site first', 'warning');
    // Reset dropdown to 'today' if no site selected
    e.target.value = 'today';
  }
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
      const tabId = tab.dataset.tab;
      document.getElementById(tabId)?.classList.add("active");

      // When switching to the heatmap tab, populate the page dropdown
      if (tabId === 'heatmap' && currentSiteId) {
        populateHeatmapPages(currentSiteId);
      } else if (tabId === 'overview' && currentSiteId) {
        // Re-fetch analytics if switching back to overview
        // This ensures charts are up-to-date with date range
        const start = document.getElementById('startDate').value;
        const end = document.getElementById('endDate').value;
        fetchAnalytics(currentSiteId, start, end);
      }
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
  cancelAlertBtn?.addEventListener("click", () => {
    addAlertForm.classList.add("hidden");
    document.getElementById('alertForm')?.reset(); // Also reset the form
  });

  // ========== 5. Chart.js Chart ==========
  // const pageviewsChart = document.getElementById("pageviewsChart");
  // if (pageviewsChart) {
  //   new Chart(pageviewsChart, {
  //     type: "line",
  //     data: {
  //       labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  //       datasets: [{
  //         label: "Pageviews",
  //         data: [230, 280, 350, 420, 390, 500, 600],
  //         borderColor: "#3b82f6",
  //         fill: true,
  //         backgroundColor: "rgba(59, 130, 246, 0.1)",
  //         tension: 0.3
  //       }]
  //     },
  //     options: {
  //       responsive: true,
  //       plugins: {
  //         legend: {
  //           display: false
  //         }
  //       }
  //     }
  //   });
  // }

  // // ========== 6. Plotly Bar Chart ==========
  // const topPagesChart = document.getElementById("topPagesChart");
  // if (topPagesChart) {
  //   Plotly.newPlot("topPagesChart", [{
  //     x: ["Home", "Blog", "Shop", "Contact"],
  //     y: [1200, 800, 600, 300],
  //     type: "bar",
  //     marker: { color: "#3b82f6" }
  //   }], {
  //     margin: { t: 30 },
  //     title: "Top Pages"
  //   });
  // }

  // ========== 7. Refresh Button ==========
  document.getElementById("refreshBtn")?.addEventListener("click", () => {
    if (currentSiteId) {
      updateDashboardStats();
      showToast("Data refreshed!", "success");
    } else {
      showToast("Please select a site first", "warning");
    }
  });

  // ========== 8. Toast Function ==========
  

  // ========== 9. Initialize Dashboard ==========
  console.log('🚀 Initializing dashboard...');
  populateSiteDropdown();

  // Add this at the end of DOMContentLoaded
  setTimeout(initializeDateRangePicker, 100);
});

// ADDED: Handle Alert Form Submission
document.getElementById('alertForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentSiteId) {
    showToast('Please select a site before creating an alert.', 'warning');
    return;
  }

  const formData = {
    site_id: currentSiteId,
    name: document.getElementById('alertName').value,
    condition: document.getElementById('alertCondition').value,
    threshold: parseInt(document.getElementById('alertThreshold').value, 10),
    time_window: parseInt(document.getElementById('alertTimeWindow').value, 10),
    notification_email: document.getElementById('alertEmail').value,
  };

  try {
    const res = await fetch('/alerts/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Failed to create alert rule');
    }
    showToast('Alert rule created successfully!', 'success');
    document.getElementById('alertForm').reset();
    document.getElementById('addAlertForm').classList.add('hidden');
    loadAlertsPage(); // Refresh the list
  } catch (err) {
    console.error('Error creating alert:', err);
    showToast(err.message, 'error');
  }
});

// ========== Heatmap Listeners (outside DOMContentLoaded is fine) ==========
document.getElementById("heatmapPageSelect")?.addEventListener("change", fetchAndRenderClickHeatmap);
document.getElementById("heatmapDeviceToggle")?.addEventListener("change", fetchAndRenderClickHeatmap);



// ADD this outside the DOMContentLoaded listener
function initializeDateRangePicker() {
  const applyButton = document.getElementById('applyDateRange');
  if (applyButton) {
    applyButton.addEventListener('click', () => {
      if (!currentSiteId) {
        showToast('Please select a site first', 'warning');
        return;
      }
      
      const start = document.getElementById('startDate').value;
      const end = document.getElementById('endDate').value;
      fetchAnalytics(currentSiteId, start, end);

      // If heatmap tab is active, refresh its data too
      if (document.querySelector('.tab-btn[data-tab="heatmap"].active')) {
        fetchAndRenderClickHeatmap();
      }
    });
  }
}

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
          // Refresh the dropdown
          populateSiteDropdown();
          // Clear the form fields
            document.getElementById("siteForm").reset();
          // Show success message
            showToast(`Site "${data.name}" created successfully!`, 'success');
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
      if (!currentSiteId) {
        showToast('Please select a site first', 'error');
        return;
      }
      
      const startDate = document.getElementById('csvStartDate').value;
      const endDate = document.getElementById('csvEndDate').value;

      let url = `/analytics/${currentSiteId}/export/csv`;
      if (startDate || endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }
      window.location.href = url;
    });

    document.getElementById('exportPdf').addEventListener('click', () => {
      if (!currentSiteId) {
        showToast('Please select a site first', 'error');
        return;
      }
      
      const startDate = document.getElementById('pdfStartDate').value;
      const endDate = document.getElementById('pdfEndDate').value;

      let url = `/analytics/${currentSiteId}/export/pdf`;
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

// ADDED: All functions for managing the Alerts page
async function loadAlertsPage() {
  if (!currentSiteId) {
    showToast("Please select a site to manage alerts.", "warning");
    document.getElementById('alertRulesList').innerHTML = '<p>Select a site to see alert rules.</p>';
    document.getElementById('recentNotificationsList').innerHTML = '<p>Select a site to see notifications.</p>';
    return;
  }
  await fetchAndDisplayAlertRules(currentSiteId);
  await fetchAndDisplayRecentNotifications(currentSiteId);
}

async function fetchAndDisplayAlertRules(siteId) {
  const container = document.getElementById('alertRulesList');
  container.innerHTML = '<div class="loading">Loading rules...</div>';
  try {
    const res = await fetch(`/alerts/rules?site_id=${siteId}`);
    if (!res.ok) throw new Error('Failed to fetch alert rules');
    const rules = await res.json();
    displayAlertRules(rules);
  } catch (err) {
    console.error('Error fetching alert rules:', err);
    container.innerHTML = '<div class="error">Could not load alert rules.</div>';
  }
}

function displayAlertRules(rules) {
  const container = document.getElementById('alertRulesList');
  if (!rules || rules.length === 0) {
    container.innerHTML = '<p>No active alert rules for this site.</p>';
    return;
  }
  container.innerHTML = rules.map(rule => `
    <div class="alert-rule-card">
      <div class="rule-details">
        <strong>${rule.name}</strong>
        <p>Condition: ${rule.condition.replace(/_/g, ' ')} | Threshold: ${rule.threshold}</p>
        <p>Notifies: ${rule.notification_email}</p>
      </div>
      <div class="rule-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteAlertRule('${rule.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
}

async function fetchAndDisplayRecentNotifications(siteId) {
    const container = document.getElementById('recentNotificationsList');
    container.innerHTML = '<div class="loading">Loading notifications...</div>';
    try {
        const res = await fetch(`/alerts/notifications?site_id=${siteId}`);
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const notifications = await res.json();
        displayRecentNotifications(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        container.innerHTML = '<div class="error">Could not load recent notifications.</div>';
    }
}

function displayRecentNotifications(notifications) {
    const container = document.getElementById('recentNotificationsList');
    if (!notifications || notifications.length === 0) {
        container.innerHTML = '<p>No recent notifications for this site.</p>';
        return;
    }
    container.innerHTML = notifications.map(n => `
        <div class="notification-item">
            <i class="fas fa-bell"></i>
            <div class="notification-content">
                <p><strong>${n.alert_name}:</strong> ${n.message}</p>
                <small>${new Date(n.created_at).toLocaleString()}</small>
            </div>
        </div>
    `).join('');
}

async function deleteAlertRule(ruleId) {
  if (!confirm('Are you sure you want to delete this alert rule?')) return;
  try {
    const res = await fetch(`/alerts/rules/${ruleId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete rule');
    showToast('Alert rule deleted successfully.', 'success');
    loadAlertsPage(); // Refresh the lists
  } catch (err) {
    console.error('Error deleting alert rule:', err);
    showToast('Failed to delete alert rule.', 'error');
  }
}


// ADD these new functions:
async function updateDashboardStats() {
  if (!currentSiteId) return;
  
  try {
    // Fetch real-time stats
    const response = await fetch(`/analytics/${currentSiteId}/realtime`);
    if (response.ok) {
      const data = await response.json();
      updateRealtimeStats(data);
    }
  } catch (error) {
    console.error('Failed to fetch realtime stats:', error);
  }
}

// NEW function to update dashboard with specific time range
async function updateDashboardWithTimeRange(timeRange) {
  if (!currentSiteId) return;
  
  try {
    const response = await fetch(`/analytics/${currentSiteId}/realtime?time_range=${timeRange}`);
    if (response.ok) {
      const data = await response.json();
      updateRealtimeStats(data);
    }
  } catch (error) {
    console.error('Failed to fetch time range analytics:', error);
  }
}

function updateRealtimeStats(data) {
  // Update the stat cards with real data
  setIfExists("activeUsers", data.active_users || 0);
  setIfExists("totalPageviews", data.total_pageviews || 0);
  setIfExists("uniqueVisitors", data.unique_visitors || 0);
  setIfExists("buttonClicks", data.button_clicks || 0);
  
  // Update activity feed
  updateActivityFeed(data.recent_events || []);
}

function updateActivityFeed(events) {
  const activityFeed = document.getElementById('activityFeed');
  if (!activityFeed || !events.length) return;
  
  activityFeed.innerHTML = events.slice(0, 10).map(event => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div class="activity-content">
        <div class="activity-text">${event.description}</div>
        <div class="activity-time">${formatTimeAgo(event.created_at)}</div>
      </div>
    </div>
  `).join('');
}

function clearDashboardData() {
  // Clear all stats
  ['activeUsers', 'totalPageviews', 'uniqueVisitors', 'buttonClicks'].forEach(id => {
    setIfExists(id, 0);
  });
  
  // Clear activity feed
  const activityFeed = document.getElementById('activityFeed');
  if (activityFeed) {
    activityFeed.innerHTML = `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div class="activity-content">
          <div class="activity-text">Select a site to view activity...</div>
          <div class="activity-time">Now</div>
        </div>
      </div>
    `;
  }
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// ADD these functions to handle the new dashboard components

function updateDashboardComponents(data) {
  // Update performance metrics (these are already handled by setIfExists)
  
  // Update top pages
  updateTopPagesList(data.top_pages || []);
  
  // Update traffic sources
  updateTrafficSources(data.traffic_sources || []);
  
  // Update geographic distribution
  updateGeoDistribution(data.geo_distribution || []);
}

function updateTopPagesList(pages) {
  const container = document.getElementById('topPagesList');
  if (!container) return;
  
  if (pages.length === 0) {
    container.innerHTML = '<div class="loading-placeholder"><span>No page data available</span></div>';
    return;
  }
  
  container.innerHTML = pages.slice(0, 10).map(page => `
    <div class="page-item">
      <div class="page-info">
        <div class="page-url">${page.url || 'Unknown'}</div>
        <div class="page-title">${page.title || 'No title'}</div>
      </div>
      <div class="page-stats">
        <div class="page-views">${page.views || 0}</div>
        <div class="page-change ${(page.change || 0) >= 0 ? 'positive' : 'negative'}">
          ${(page.change || 0) >= 0 ? '+' : ''}${page.change || 0}%
        </div>
      </div>
    </div>
  `).join('');
}

function updateTrafficSources(sources) {
  const container = document.getElementById('trafficSources');
  if (!container) return;
  
  if (sources.length === 0) {
    container.innerHTML = '<div class="loading-placeholder"><span>No traffic data available</span></div>';
    return;
  }
  
  const getSourceIcon = (source) => {
    const name = source.name.toLowerCase();
    if (name.includes('direct')) return { class: 'source-direct', icon: 'fas fa-arrow-right' };
    if (name.includes('google') || name.includes('search')) return { class: 'source-search', icon: 'fas fa-search' };
    if (name.includes('social') || name.includes('facebook') || name.includes('twitter')) return { class: 'source-social', icon: 'fas fa-share-alt' };
    return { class: 'source-referral', icon: 'fas fa-external-link-alt' };
  };
  
  container.innerHTML = sources.slice(0, 8).map(source => {
    const iconInfo = getSourceIcon(source);
    return `
      <div class="source-item">
        <div class="source-info">
          <div class="source-icon ${iconInfo.class}">
            <i class="${iconInfo.icon}"></i>
          </div>
          <div class="source-name">${source.name || 'Unknown'}</div>
        </div>
        <div class="source-stats">
          <div class="source-visitors">${source.visitors || 0}</div>
          <div class="source-percentage">${source.percentage || 0}%</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateGeoDistribution(countries) {
  const container = document.getElementById('geoDistribution');
  if (!container) return;
  
  if (countries.length === 0) {
    container.innerHTML = '<div class="loading-placeholder"><span>No location data available</span></div>';
    return;
  }
  
  const getCountryFlag = (countryCode) => {
    // Simple flag emoji mapping - you can expand this
    const flags = {
      'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'DE': '🇩🇪', 'FR': '🇫🇷',
      'IT': '🇮🇹', 'ES': '🇪🇸', 'JP': '🇯🇵', 'AU': '🇦🇺', 'BR': '🇧🇷',
      'IN': '🇮🇳', 'CN': '🇨🇳', 'RU': '🇷🇺', 'KE': '🇰🇪', 'NG': '🇳🇬'
    };
    return flags[countryCode] || '🌐';
  };
  
  container.innerHTML = countries.slice(0, 10).map(country => `
    <div class="country-item">
      <div class="country-info">
        <span class="country-flag">${getCountryFlag(country.code)}</span>
        <span class="country-name">${country.name || 'Unknown'}</span>
      </div>
      <div class="country-visitors">${country.visitors || 0}</div>
    </div>
  `).join('');
}

// UPDATE the updateRealtimeStats function to include new components
function updateRealtimeStats(data) {
  // Update the stat cards with real data
  setIfExists("activeUsers", data.active_users || 0);
  setIfExists("totalPageviews", data.total_pageviews || 0);
  setIfExists("uniqueVisitors", data.unique_visitors || 0);
  setIfExists("buttonClicks", data.button_clicks || 0);
  
  // Update performance metrics
  setIfExists("avgLoadTime", data.avg_load_time || 0, 'ms');
  setIfExists("bounceRate", data.bounce_rate || 0, '%');
  setIfExists("jsErrors", data.js_errors || 0);
  setIfExists("formSubmissions", data.form_submissions || 0);
  
  // Update new dashboard components with time range context
  updateDashboardComponents(data);
  
  // Update activity feed
  updateActivityFeed(data.recent_events || []);
  
  // Update chart headers based on current time range
  updateChartHeaders(data.time_range || 'today');
}

// NEW function to update chart headers based on time range
function updateChartHeaders(timeRange) {
  const timeLabel = timeRange === 'today' ? 'Today' : 
                   timeRange === 'week' ? 'This Week' : 'This Month';
  
  // Update Top Pages header
  const topPagesLabel = document.getElementById('topPagesTimeLabel');
  if (topPagesLabel) {
    topPagesLabel.textContent = timeLabel;
  }
  
  // Update other chart headers if they have dynamic labels
  const trafficHeader = document.querySelector('#trafficSources .chart-header h3');
  if (trafficHeader) {
    trafficHeader.innerHTML = `<i class="fas fa-share-alt"></i> Traffic Sources (${timeLabel})`;
  }
  
  const geoHeader = document.querySelector('#geoDistribution .chart-header h3');
  if (geoHeader) {
    geoHeader.innerHTML = `<i class="fas fa-globe-americas"></i> Geographic Distribution (${timeLabel})`;
  }
}

// Initialize dashboard date range
function initializeDateRange() {
  const startDate = document.getElementById('dashboardStartDate');
  const endDate = document.getElementById('dashboardEndDate');
  const applyBtn = document.getElementById('applyDashboardDateRange');
  if (!startDate || !endDate || !applyBtn) return; 

  // Set default to today
  const today = new Date().toISOString().split('T')[0];
  startDate.value = today;
  endDate.value = today;
  
  // Apply date range when button is clicked
  applyBtn.addEventListener('click', function() {
    if (startDate.value && endDate.value) {
      if (startDate.value <= endDate.value) {
        updateDashboardData(startDate.value, endDate.value);
      } else {
        showToast('End date must be after start date', 'error');
      }
    } else {
      showToast('Please select both start and end dates', 'error');
    }
  });
}

// Update dashboard data based on date range
function updateDashboardData(startDate, endDate) {
  const selectedSiteId = document.getElementById('siteSelect').value;
  if (!selectedSiteId || selectedSiteId === 'Select a site...') {
    showToast('Please select a site first', 'warning');
    return;
  }
  
  // Update the date range display
  const dateDisplay = document.getElementById('currentDateRange');
  if (startDate === endDate) {
    dateDisplay.textContent = `Data for ${new Date(startDate).toLocaleDateString()}`;
  } else {
    dateDisplay.textContent = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
  }
  
  // Fetch filtered data from your API
  fetchDashboardDataForDateRange(selectedSiteId, startDate, endDate);
}

// Function to fetch data for specific date range
async function fetchDashboardDataForDateRange(siteId, startDate, endDate) {
  try {
    showLoading();

    // The original URL `/api/analytics/.../dashboard` was causing a 404 Not Found error.
    // 1. The `/api` prefix is inconsistent with other API calls in this file.
    // 2. Other dashboard functions use the `/realtime` endpoint. This change aligns the URL.
    // Note: Your backend must be able to handle `start_date` and `end_date` on this endpoint.
    const response = await fetch(`/analytics/${siteId}/realtime?start_date=${startDate}&end_date=${endDate}`);
    const data = await response.json();

    if (response.ok) {
      // The function `updateDashboardElements` was not defined.
      // `updateRealtimeStats` is the correct function to update the dashboard components.
      updateRealtimeStats(data);
      showToast('Dashboard updated successfully', 'success');
    } else {
      throw new Error(data.detail || 'Failed to fetch data');
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    showToast('Error loading dashboard data', 'error');
  } finally {
    hideLoading();
  }
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // ... your existing code ...
  initializeDateRange();
});

function showLoading() {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(255,255,255,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 2000;
    overlay.innerHTML = `<div style="font-size:2rem;color:#3b82f6;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>`;
    document.body.appendChild(overlay);
  } else {
    overlay.style.display = 'flex';
  }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    
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