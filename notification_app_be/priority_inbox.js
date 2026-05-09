const NOTIFICATION_API = 'http://4.224.186.213/evaluation-service/notifications';

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJteWxhYXNpc2g0NUBnbWFpbC5jb20iLCJleHAiOjE3NzgzMTA3MTIsImlhdCI6MTc3ODMwOTgxMiwiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6ImZjYzUwNzdhLTA3NTMtNDQxYS05NTZjLWRhOGRlZTEzMDllOSIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6Im15bGEga2FzdGh1cmkgYXNpc2giLCJzdWIiOiI1NWQ1ODkyYy04MzNhLTQ2ZWUtYThmNC1kYjQ0NTJmMTJkNTQifSwiZW1haWwiOiJteWxhYXNpc2g0NUBnbWFpbC5jb20iLCJuYW1lIjoibXlsYSBrYXN0aHVyaSBhc2lzaCIsInJvbGxObyI6IjIzNDgxYTA1ZzIiLCJhY2Nlc3NDb2RlIjoiZUpkQ3VDIiwiY2xpZW50SUQiOiI1NWQ1ODkyYy04MzNhLTQ2ZWUtYThmNC1kYjQ0NTJmMTJkNTQiLCJjbGllbnRTZWNyZXQiOiJYa1J2SnFXcUtCTUpOUFB6In0.jeWItt1zZx1cu3_rJK6aGrU4sIvXpLReUsdCoymweug';

const TYPE_WEIGHTS = {
    'Placement': 3,
    'Result': 2,
    'Event': 1
};

function getPriorityScore(notification) {
    const weight = TYPE_WEIGHTS[notification.Type] || 0;
    const recency = new Date(notification.Timestamp).getTime();
    return (weight * Math.pow(10, 14)) + recency;
}

async function fetchPriorityInbox(n = 10) {
    try {
        const response = await fetch(NOTIFICATION_API, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (!data.notifications) {
            console.error('No notifications found. Check token or API.');
            return;
        }

        // Sort notifications: High priority score first
        const sortedNotifications = data.notifications.sort((a, b) => {
            return getPriorityScore(b) - getPriorityScore(a);
        });

        // Get top N
        const topN = sortedNotifications.slice(0, n);

        console.log(`--- Priority Inbox: Top ${n} Notifications ---`);
        topN.forEach((notif, index) => {
            console.log(`${index + 1}. [${notif.Type}] ${notif.Message}`);
            console.log(`   Time: ${notif.Timestamp} | ID: ${notif.ID}`);
            console.log('---------------------------------------------');
        });

    } catch (error) {
        console.error('Error fetching priority inbox:', error.message);
    }
}

// Fetch top 10
fetchPriorityInbox(10);
