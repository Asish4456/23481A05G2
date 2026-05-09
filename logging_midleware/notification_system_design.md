# Stage 1

## Campus Notifications Microservice - REST API Design

### 1. Core Actions
The notification platform will support the following core actions:
- **Fetch Notifications:** Retrieve a list of notifications for the logged-in student (with pagination and filtering).
- **Mark as Read/Unread:** Update the status of a specific notification.
- **Get Unread Count:** Quickly retrieve the number of unread notifications for UI badges.
- **Delete Notification:** Remove a notification from the student's view.
- **Fetch Notification Details:** Get full content for a specific notification.

### 2. REST API Endpoints

#### A. Fetch Notifications
- **Endpoint:** `GET /api/v1/notifications`
- **Headers:**
  - `Authorization: Bearer <token>`
- **Query Parameters:**
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20)
  - `type`: Filter by type (`Event`, `Result`, `Placement`)
- **Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "id": "uuid-1",
        "type": "Placement",
        "title": "New Drive: Google",
        "message": "Google is visiting campus for SWE roles.",
        "isRead": false,
        "createdAt": "2026-05-09T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20
    }
  }
}
```

#### B. Mark Notification as Read
- **Endpoint:** `PATCH /api/v1/notifications/:id/read`
- **Headers:**
  - `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "status": "success",
  "message": "Notification marked as read."
}
```

#### C. Get Unread Count
- **Endpoint:** `GET /api/v1/notifications/unread-count`
- **Headers:**
  - `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "unreadCount": 5
  }
}
```

### 3. Real-time Notifications Mechanism
To provide real-time updates, I recommend using **WebSockets (Socket.io)**. 

**Mechanism:**
1. **Connection:** When a student logs in, the front-end establishes a WebSocket connection with the server.
2. **Room Joining:** The server puts the connection into a "room" identified by the `studentID`.
3. **Pushing:** When a new notification is generated (e.g., by an HR or Faculty), the server emits an event to that specific student's room.
4. **Fallback:** If the WebSocket connection fails, the client can fallback to **Long Polling** or **Server-Sent Events (SSE)**.

# Stage 2

## Persistent Storage Choice

### Database Suggestion: PostgreSQL (Relational Database)
I suggest using a Relational Database like **PostgreSQL** for the following reasons:
1. **ACID Compliance:** Ensures that notification status updates (e.g., marking as read) are atomic and reliable.
2. **Structured Data:** Notifications have a well-defined schema (Student ID, Title, Message, Type, isRead).
3. **Relational Integrity:** Strong relationships between students and their notifications.
4. **Indexing:** Excellent support for complex indexes (B-Tree, GIN) which will be crucial as the data volume grows.

### Database Schema

#### 1. `notifications` Table
| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| `student_id` | INT | NOT NULL, FK to users(id) | Target student |
| `type` | ENUM | NOT NULL ('Event', 'Result', 'Placement') | Notification category |
| `title` | VARCHAR(255) | NOT NULL | Brief summary |
| `message` | TEXT | NOT NULL | Full content |
| `is_read` | BOOLEAN | DEFAULT FALSE | Read status |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |

### Scalability Challenges & Solutions
**Problems as data volume increases:**
1. **Slow Queries:** Fetching unread notifications for a specific student will slow down if the table has millions of rows.
2. **Storage Costs:** Older notifications take up space and might not be frequently accessed.
3. **Write Bottlenecks:** During "Notify All" events, thousands of inserts happen simultaneously.

**Solutions:**
1. **Indexing:** Create composite indexes on `(student_id, is_read, created_at)`.
2. **Database Partitioning:** Partition the table by `created_at` (e.g., monthly partitions).
3. **Archiving:** Move notifications older than 6 months to a secondary/cold storage or a data warehouse.

### SQL Queries (PostgreSQL)

**1. Fetch unread notifications for a student:**
```sql
SELECT * FROM notifications 
WHERE student_id = 1042 AND is_read = FALSE 
ORDER BY created_at DESC;
```

**2. Mark a notification as read:**
```sql
UPDATE notifications 
SET is_read = TRUE 
WHERE id = 'uuid-123' AND student_id = 1042;
```

# Stage 3

## Query Optimization Analysis

### 1. Is the query accurate?
**Yes**, the query is logically accurate for fetching unread notifications for a specific student, sorted by the most recent first.

### 2. Why is this slow?
The query is slow because the database has to perform a **Full Table Scan** or a suboptimal scan. With 5,000,000 notifications:
- The database has to look through millions of rows to find those matching `studentID = 1042`.
- It then filters by `isRead = false`.
- Finally, it must sort the results by `createdAt DESC`.
Without proper indexes, this process is $O(N)$ where $N$ is the total number of notifications.

### 3. What would you change?
I would add a **Composite B-Tree Index** on the columns used in the `WHERE` and `ORDER BY` clauses.

**SQL to add the index:**
```sql
CREATE INDEX idx_notifications_student_unread_date 
ON notifications (student_id, is_read, created_at DESC);
```

### 4. Likely Computation Cost
- **Without Index:** $O(N)$ - Full Table Scan.
- **With Index:** $O(\log N)$ - Index Seek + Range Scan.
The performance improvement will be massive, reducing query time from seconds to milliseconds.

### 5. Is adding indexes on every column effective?
**No**, this is a bad practice.
- **Write Performance:** Every time a row is inserted or updated, the database must also update all related indexes, slowing down write operations.
- **Storage Overhead:** Indexes take up significant disk space.
- **Optimizer Confusion:** Too many indexes can sometimes lead the query optimizer to choose a less efficient plan.
Indexes should be added strategically based on actual query patterns.

### 6. Query to find all students who got a placement notification in the last 7 days:
```sql
SELECT DISTINCT student_id 
FROM notifications 
WHERE notification_type = 'Placement' 
AND created_at >= CURRENT_DATE - INTERVAL '7 days';
```

# Stage 4

## Scaling Strategy for High Fetch Load

### 1. Suggested Solution: Caching Layer (Redis)
To prevent the database from being overwhelmed on every page load, I suggest implementing a **Caching Layer using Redis**.

### 2. Implementation Strategy
- **Cache Aside Pattern:** When a student requests notifications:
    1. Check if the notifications for that `student_id` are in Redis.
    2. If **Hit**: Return data immediately from Redis (super fast).
    3. If **Miss**: Fetch from the PostgreSQL database, store the result in Redis with an Expiry Time (TTL), and return it to the user.
- **Cache Invalidation:** 
    - When a new notification is added for a student, delete their cached notifications in Redis.
    - When a student marks a notification as read, update/delete the cache.

### 3. Alternative Strategies & Tradeoffs

#### Strategy A: Caching (Redis)
- **Pros:** Extremely fast (sub-millisecond), reduces DB load significantly.
- **Cons:** Cache consistency management (ensuring Redis matches the DB).

#### Strategy B: Read Replicas
- **Pros:** Distributes read traffic across multiple database instances.
- **Cons:** Costs more (multiple DB instances), small replication lag.

#### Strategy C: HTTP Caching (ETags)
- **Pros:** Reduces network bandwidth; if data hasn't changed, server returns `304 Not Modified`.
- **Cons:** Still requires a hit to the server/application logic to check for changes.

### 4. Recommendation
I recommend a combination of **Redis Caching** for the most frequent requests (like unread count and latest notifications) and **Read Replicas** for horizontal scaling of the database.

# Stage 5

## Redesigning "Notify All" for Reliability and Speed

### 1. Shortcomings of the Current Implementation
- **Synchronous Execution:** The function iterates through 50,000 students one by one. If each operation takes 100ms, it would take ~1.4 hours to complete.
- **Blocking Operation:** The API request remains open for the entire duration, likely causing a timeout.
- **No Error Handling:** If `send_email` fails for student 201, the entire loop might crash or skip, with no way to retry only the failed ones.
- **No Persistence of Progress:** If the server restarts midway, you lose track of who was notified and who wasn't.
- **Tight Coupling:** Email, DB, and App Push are all in the same loop. A failure in one affects the others.

### 2. Proposed Redesign: Asynchronous Messaging (Message Queue)
I suggest using a **Message Queue (RabbitMQ or Kafka)** with **Background Workers**.

**Mechanism:**
1. **Producer:** The "Notify All" action only creates a single "Broadcast Job" in the database and adds a message to the queue. The HR gets an immediate "Broadcast Started" response.
2. **Fan-out:** A background worker picks up the "Broadcast Job" and pushes 50,000 individual tasks into a `notification-tasks` queue.
3. **Consumers:** Multiple worker instances pull tasks from the queue and process them in parallel.
4. **Reliability:** Each worker handles retries (with exponential backoff) if `send_email` or `push_to_app` fails.

### 3. Should saving to DB and sending email happen together?
**No**, they should be decoupled using the **Transactional Outbox Pattern**:
1. Save the notification to the DB and an "Outbox" table in the same transaction.
2. A separate process reads from the Outbox and sends the email/push.
This ensures that if the email service is down, the notification is still saved in the DB and will be emailed once the service is back.

### 4. Revised Pseudocode

```python
# API Endpoint Handler
def handle_notify_all_request(message):
    job_id = db.create_broadcast_job(message, status="PENDING")
    # Queue a background job to start the fan-out
    message_queue.publish("start_fanout", {"job_id": job_id})
    return {"status": "accepted", "job_id": job_id}

# Background Worker for Fan-out
def process_fanout(job_id):
    student_ids = db.get_all_student_ids()
    for student_id in student_ids:
        # Publish individual tasks to the queue
        message_queue.publish("send_notification", {
            "student_id": student_id,
            "message": message,
            "job_id": job_id
        })
    db.update_job_status(job_id, "PROCESSING")

# Background Worker for Individual Notifications
def process_notification_task(task):
    try:
        # These can also be parallelized internally or sent to separate queues
        save_to_db(task.student_id, task.message)
        send_email_with_retry(task.student_id, task.message)
        push_to_app(task.student_id, task.message)
    except Exception as e:
        # Queue system handles automatic retries with backoff
        raise e 
```

# Stage 6

## Priority Inbox Implementation

### 1. Approach for Priority Ranking
To determine the "most important" notifications, we use a scoring algorithm that combines **Weight** (Categorical importance) and **Recency** (Temporal importance).

**Weights:**
- **Placement:** 3 (Highest)
- **Result:** 2
- **Event:** 1 (Lowest)

**Scoring Formula:**
`PriorityScore = (Weight * 10^14) + UnixTimestampInMilliseconds`
By using a large multiplier for the weight, we ensure that a 'Placement' notification will almost always outrank a 'Result', but among notifications of the same type, the most recent one will appear first.

### 2. Maintaining the Top 'n' Efficiently
As new notifications arrive, recalculating and re-sorting the entire list is inefficient ($O(N \log N)$).

**Optimized Solution: Min-Priority Queue (Min-Heap)**
1. We maintain a **Min-Heap** of size `n`.
2. For every new notification:
    - If the heap size is less than `n`, add the notification.
    - If the heap is full, compare the new notification's `PriorityScore` with the heap's root (the minimum in the top `n`).
    - If the new notification has a *higher* score, remove the root and insert the new notification.
3. This reduces the complexity of maintaining the top `n` to **$O(\log n)$** per arrival, which is extremely efficient for real-time systems.

### 3. Functional Implementation
A functional Node.js script has been created at `Backend\notification_app_be\priority_inbox.js` that:
- Fetches data from the Notification API.
- Implements the weighted scoring logic.
- Displays the Top 10 notifications sorted by priority.
