import os
import json
from uuid import uuid4
from datetime import datetime
import asyncpg
from fastapi import APIRouter, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse


router = APIRouter()

@router.get("/tracking-script/{site_id}")
async def get_tracking_script(site_id: str):
    """Generate the enhanced tracking script for a specific site"""
    backend_url = os.environ.get('TRACKER_BACKEND_URL', 'http://localhost:8001')

    script_content = f"""(function() {{
    'use strict';

    const SITE_ID = '{site_id}';
    const API_BASE = '{backend_url}/api';

    let sessionId = sessionStorage.getItem('tracker_session_id');
    if (!sessionId) {{
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem('tracker_session_id', sessionId);
    }}

    let userId = localStorage.getItem('tracker_user_id');
    if (!userId) {{
        userId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('tracker_user_id', userId);
    }}

    function trackEvent(eventType, metadata = {{}}) {{
        const data = {{
            site_id: SITE_ID,
            session_id: sessionId,
            user_id: userId,
            event_type: eventType,
            url: window.location.href,
            title: document.title,
            referrer: document.referrer,
            user_agent: navigator.userAgent,
            metadata: metadata,
            ...metadata
        }};

        if (navigator.sendBeacon) {{
            const blob = new Blob([JSON.stringify(data)], {{type: 'application/json'}});
            navigator.sendBeacon(API_BASE + '/track', blob);
        }} else {{
            fetch(API_BASE + '/track', {{
                method: 'POST',
                headers: {{
                    'Content-Type': 'application/json',
                }},
                body: JSON.stringify(data),
                keepalive: true
            }}).catch(err => console.error('Tracking failed:', err));
        }}
    }}

    trackEvent('pageview');

    document.addEventListener('click', function(e) {{
        const element = e.target;
        trackEvent('click', {{
            element_id: element.id || null,
            element_class: element.className || null,
            element_text: element.textContent ? element.textContent.substring(0, 100) : null,
            click_x: e.clientX,
            click_y: e.clientY,
            element_tag: element.tagName,
            element_type: element.type || null,
            href: element.href || null
        }});

        if (element.tagName === 'BUTTON' || element.type === 'button' || element.type === 'submit') {{
            trackEvent('button_click', {{
                element_id: element.id || null,
                element_class: element.className || null,
                element_text: element.textContent ? element.textContent.substring(0, 100) : null,
                button_type: element.type || 'button'
            }});
        }}

        if (element.tagName === 'A' && element.href) {{
            trackEvent('link_click', {{
                element_id: element.id || null,
                element_text: element.textContent ? element.textContent.substring(0, 100) : null,
                href: element.href,
                is_external: !element.href.includes(window.location.hostname)
            }});
        }}
    }});

    let maxScroll = 0;
    let scrollTracked = {{}};
    window.addEventListener('scroll', function() {{
        const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
        if (scrollPercent > maxScroll) {{
            maxScroll = scrollPercent;
            [25, 50, 75, 100].forEach(threshold => {{
                if (scrollPercent >= threshold && !scrollTracked[threshold]) {{
                    scrollTracked[threshold] = true;
                    trackEvent('scroll', {{
                        scroll_depth: threshold,
                        max_scroll: maxScroll
                    }});
                }}
            }});
        }}
    }});

    document.addEventListener('submit', function(e) {{
        const form = e.target;
        trackEvent('form_submit', {{
            form_id: form.id || null,
            form_class: form.className || null,
            form_action: form.action || null,
            form_method: form.method || 'get',
            field_count: form.elements.length
        }});
    }});

    let startTime = Date.now();
    let timeTracked = false;

    window.addEventListener('beforeunload', function() {{
        if (!timeTracked) {{
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            trackEvent('time_on_page', {{
                time_on_page: timeOnPage,
                duration: timeOnPage
            }});
            timeTracked = true;
        }}
    }});

    document.addEventListener('visibilitychange', function() {{
        if (document.hidden) {{
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            trackEvent('page_hidden', {{
                time_on_page: timeOnPage,
                duration: timeOnPage
            }});
        }} else {{
            startTime = Date.now();
            trackEvent('page_visible');
        }}
    }});

    window.addEventListener('error', function(e) {{
        trackEvent('javascript_error', {{
            error_message: e.message,
            error_filename: e.filename,
            error_line: e.lineno,
            error_column: e.colno
        }});
    }});

    window.addEventListener('load', function() {{
        setTimeout(function() {{
            const perfData = performance.getEntriesByType('navigation')[0];
            trackEvent('page_performance', {{
                load_time: Math.round(perfData.loadEventEnd - perfData.navigationStart),
                dom_ready: Math.round(perfData.domContentLoadedEventEnd - perfData.navigationStart),
                first_paint: Math.round(perfData.responseEnd - perfData.requestStart)
            }});
        }}, 1000);
    }});

    window.webTracker = {{
        track: trackEvent,
        getSiteId: () => SITE_ID,
        getSessionId: () => sessionId,
        getUserId: () => userId,
        trackCustomEvent: (eventName, data) => trackEvent('custom_event', {{ event_name: eventName, ...data }})
    }};
}})();
"""

    return PlainTextResponse(
        script_content,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=3600"
        }
    )

@router.post("/api/track")
async def track_event(request: Request):
    try:
        data = await request.json()

        query = """
        INSERT INTO events (
            id, site_id, event_type, session_id, user_id, url, title,
            referrer, user_agent, metadata, created_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11
        )
        """

        values = (
            str(uuid4()),
            data.get("site_id"),
            data.get("event_type"),
            data.get("session_id"),
            data.get("user_id"),
            data.get("url"),
            data.get("title"),
            data.get("referrer"),
            data.get("user_agent"),
            json.dumps(data.get("metadata", {})),  # safely handle JSON
            datetime.utcnow()
        )

        # Replace this with your database connection
        conn: asyncpg.Connection = request.app.state.db
        await conn.execute(query, *values)

        return {"status": "ok"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Tracking error: {str(e)}")

# Attach the router
