let currentSiteId = null; // Will be set when user selects a site

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
    const data = await res.json();

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

    // Update analytics page components
    updateReferrerChart(data.referrers);
    updateDeviceChart(data.devices);
    updateTopPages(data.top_pages);
    updateBehavior(data); // Add user behavior updates
    updatePerformance(data); // Add performance updates

  } catch (err) {
    console.error("Failed to fetch analytics data:", err);
  }
}

function updateReferrerChart(referrers) {
  const chartContainer = document.getElementById("referrerChart");
  if (!chartContainer) return;

  const referrerData = referrers || {};
  const dataEntries = Object.entries(referrerData);

  if (dataEntries.length === 0) {
    chartContainer.innerHTML = "<p>No referrer data available.</p>";
    return;
  }

  const sortedReferrers = dataEntries.sort(([, a], [, b]) => b - a).slice(0, 8);
  const labels = sortedReferrers.map(([ref]) => ref);
  const values = sortedReferrers.map(([, count]) => count);

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

  const deviceData = devices || {};
  const dataEntries = Object.entries(deviceData);

  if (dataEntries.length === 0) {
    chartContainer.innerHTML = "<p>No device data available.</p>";
    return;
  }

  const labels = dataEntries.map(([device]) => device);
  const values = dataEntries.map(([, count]) => count);

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

  const paths = sortedPages.map(p => p.path);
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
  // 1. User Journey Visualization
  const journeyContainer = document.getElementById("userJourneyViz");
  if (journeyContainer) {
    const journeys = data.user_journeys || [];
    const content = journeys
      .map(
        (path, index) => `<div>Visitor ${index + 1}: ${path.join(" → ")}</div>`
      )
      .join("");
    journeyContainer.innerHTML = content || "<div>No user journey data available.</div>";
  }

  // 2. Click Patterns (Heatmap data)
  const clickPatternsContainer = document.getElementById("clickPatterns");
  if (clickPatternsContainer) {
    const patterns = data.click_patterns || {};
    const content = Object.entries(patterns)
      .map(([element, count]) => `<div>${element}: ${count} clicks</div>`)
      .join("");
    clickPatternsContainer.innerHTML = content || "<div>No click pattern data available.</div>";
  }
}

function updatePerformance(data) {
  const performanceData = data.performance || {};

  // 1. Page Load Chart
  const loadTimeChart = document.getElementById("loadTimeChart");
  if (loadTimeChart) {
    const loadData = performanceData.load_times || [];
    loadTimeChart.innerHTML = loadData.length
      ? `<ul>${loadData.map(item => `<li>${item.page}: ${item.time}ms</li>`).join('')}</ul>`
      : "<p>No load time data available.</p>";
  }

  // 2. Error Chart
  const errorChart = document.getElementById("errorChart");
  if (errorChart) {
    const errorData = performanceData.error_counts || {};
    errorChart.innerHTML = Object.keys(errorData).length
      ? `<ul>${Object.entries(errorData).map(([type, count]) => `<li>${type}: ${count}</li>`).join('')}</ul>`
      : "<p>No error data available.</p>";
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
    });
  });

  // ========== Site Dropdown Change Handler ==========
  document.getElementById('siteSelect')?.addEventListener('change', async (e) => {
    currentSiteId = e.target.value;
    
    if (currentSiteId) {
      showToast(`Switched to ${e.target.selectedOptions[0].textContent}`, 'success');
      await fetchAnalytics(currentSiteId);
      await updateDashboardStats();
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

  // ========== 9. Initialize Dashboard ==========
  console.log('🚀 Initializing dashboard...');
  populateSiteDropdown();

  // Add this at the end of DOMContentLoaded
  setTimeout(initializeDateRangePicker, 100);
});

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