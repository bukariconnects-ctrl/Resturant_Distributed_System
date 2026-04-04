# Restaurant Distributed System Documentation

## 1. System Entities, Roles and Responsibilities

In our distributed system, we categorize entities into two main layers: **Client-side applications** and **Backend Serverless Services**.

### A. Client-Side Entities

#### 1. Customer Application
- **Role**: The primary interface for end-users.
- **Responsibilities**: Browsing menus, placing orders, executing payments, and tracking order status in real-time.

#### 2. Restaurant Dashboard/Terminal
- **Role**: The interface for restaurant staff.
- **Responsibilities**: Managing incoming orders, accepting/rejecting requests, and updating food preparation status (e.g., "Preparing", "Ready for Pickup").

#### 3. Driver Application
- **Role**: The interface for delivery personnel.
- **Responsibilities**: Receiving multicast dispatch requests, broadcasting real-time GPS locations, and confirming delivery completion.

### B. Backend System Entities (Serverless Microservices)

#### 1. API/Edge Gateway
- **Role**: The centralized entry point for client requests.
- **Responsibilities**: Routing requests to appropriate services, enforcing authentication/authorization, and managing API rate limits.

#### 2. Order Service (Edge Function)
- **Role**: The core orchestrator of the order lifecycle.
- **Responsibilities**: Initializing orders, calculating totals, and managing order state transitions based on cross-service events.

#### 3. Payment Service (Edge Function)
- **Role**: Financial transaction handler.
- **Responsibilities**: Processing payments, issuing refunds in case of order rejection, and publishing "Payment Status" events.

#### 4. Restaurant/Menu Service (Edge Function)
- **Role**: Data manager for restaurant catalogs.
- **Responsibilities**: Validating menu item availability, updating inventory, and managing restaurant operating capacity.

#### 5. Delivery/Location Service (Edge Function)
- **Role**: Logistics manager.
- **Responsibilities**: Tracking active driver locations, executing proximity-based driver matching, and calculating ETAs.

#### 6. Event Infrastructure (Supabase Realtime & DB Triggers)
- **Role**: The communication backbone for asynchronous workflows.
- **Responsibilities**: Using database-driven events and Realtime channels to propagate state changes (e.g., "Order Created") to subscribed services, ensuring loose coupling and eventual consistency.

---

## 2. Placement of the Entities

The system follows a geographically distributed topology:

### Edge Devices
- The **Customer**, **Restaurant**, and **Driver** applications reside on heterogeneous devices (smartphones, tablets, and web browsers) scattered across various geographical locations.

### Cloud Infrastructure (Supabase Serverless)
- Backend services are deployed as **Serverless Edge Functions**. These functions are globally distributed via a cloud edge network to minimize latency.
- The system's state is persisted in a managed **PostgreSQL cluster**, which acts as the central coordinator for all distributed transactions, ensuring high availability (HA) and fault tolerance.

---

## 3. Communication Paradigm

We employ a **Hybrid Communication Paradigm** optimized for the serverless environment:

### 1. Synchronous Communication (Request/Reply)
- **Used between**: Client Apps and the Supabase Backend.
- **Mechanism**: RESTful APIs via the Supabase Client SDK over HTTPS.
- **Why**: Operations like user login or fetching a menu require an immediate synchronous response where the client waits for the server to process the request.

### 2. Asynchronous Communication (Event-Driven Propagation)
- **Used between**: Internal Microservices (Edge Functions).
- **Mechanism**: Database-triggered events and Supabase Realtime Broadcast.
- **Why**: To ensure loose coupling. When the Order Service commits a new order to the database, it triggers a database event. The Payment and Restaurant services, which are "Subscribers" to these specific data changes, process the event independently in the background. If one service is temporarily busy, the database state remains consistent, and the event will be processed as soon as the service scales up, ensuring system reliability.

---

## 4. The Suitable Pattern for the DS and its Implementation

### A. The Selected Pattern: Event-Driven Microservices Architecture

The most suitable architectural pattern for our system is the **Event-Driven Microservices Pattern**, implemented via a **Database-Centric Saga Pattern**.

#### Why is this the suitable pattern?

1. **Scalability**: By utilizing Serverless Edge Functions, each service (Order, Payment, Restaurant) scales independently based on its specific request volume, providing highly efficient resource utilization.

2. **Fault Isolation**: Since services are decoupled via the database state, a failure in the Payment Service does not prevent customers from browsing menus or restaurants from managing existing orders.

3. **Loose Coupling**: Services operate independently. They do not invoke each other synchronously; instead, they react to state changes in the shared database using Supabase Realtime and Database Triggers.

4. **Consistency in Long-Running Processes**: Food delivery involves long-lived transactions. The Event-Driven approach, combined with the Saga pattern, ensures that even complex workflows (Ordering → Paying → Preparing → Delivering) remain consistent without needing to lock database rows for extended periods.

### B. Implementation of the Pattern

To implement this, we shift from traditional synchronous service-to-service calls to **Asynchronous Event Propagation**. Instead of a standalone Message Broker, we use **PostgreSQL Tables** as the Event Store and **Supabase Realtime Broadcast** for event distribution.

#### Scenario: Placing a New Order (The Happy Path)

**1. Event Generation**
- The Order Service (Edge Function) inserts a new order into the `orders` table with a status of `PENDING`.

**2. Event Consumption**
- A Database Trigger detects the insertion.
- The trigger automatically publishes an `OrderCreatedEvent` via Supabase Realtime Broadcast.
- The Payment and Restaurant services, which are subscribed to this channel, receive the event and initiate their respective processing.

**3. State Updating**
- Once the Payment and Restaurant services finish their tasks, they update the status in the shared database (e.g., `PAYMENT_COMPLETED`).
- The Order Service (or a central Orchestrator Function) monitors these changes and finalizes the order status to `PREPARING`.

#### Scenario: Handling Failures (Compensating Transactions)

In a distributed environment, if the restaurant rejects the order after payment is processed, we cannot "undo" the previous action. We implement **Compensating Transactions**:

1. The Restaurant Service sets the status to `REJECTED` in the database.
2. The Order Service detects this state change via a Database Change Listener.
3. It triggers a compensating logic in the Payment Service (e.g., issuing a refund).
4. The Payment Service processes the refund and updates the order status to `REFUNDED`.

> **Note**: By using the database as the event source, we ensure Atomicity and Eventual Consistency, allowing the system to recover from crashes by simply re-processing the events stored in the database logs (Transactional Outbox Pattern).

---

## 5. Fundamental Models of the System

To build a robust distributed system, we define its fundamental characteristics based on the **Interaction**, **Failure**, and **Security** models.

### A. Interaction Model (نموذج التفاعل)

We assume an **Asynchronous Distributed System Model**. Since our system operates over public networks (mobile/cloud), we cannot guarantee strict bounds on message delivery or clock synchronization.

#### Implications on our Design
- Instead of relying on a centralized Message Broker for queuing, we utilize **Supabase Realtime channels** and **Postgres Database events**.
- If a service is slow, the database state remains the source of truth, and Realtime channels ensure that event-based updates are eventually propagated to all interested services.
- We use **Vector Clocks** (or Transaction Sequence Numbers) stored in the database to maintain event causality, ensuring that state transitions (e.g., Payment → Preparing) occur in the correct logical order regardless of physical clock skews.

### B. Failure Model (نموذج الفشل)

Our system is designed for **Fault-Tolerance** and **Recoverability**:

#### 1. Omission Failures
- **Scenario**: A Driver App loses 4G/5G connection while sending a status update.
- **Handling**: We implement Idempotent API endpoints. If an ACK is not received by the client, it retries the request. The backend identifies re-sent requests by a unique `request_id`, ensuring no duplicated operations occur in the database.

#### 2. Crash Failures
- **Scenario**: An Edge Function crashes during execution.
- **Handling**: Since we use the Transactional Outbox Pattern (storing events in the database), the event is not "lost" in memory. Once the Edge Function restarts, it checks the database for pending events (`status='PENDING'`) and resumes processing from the last committed database state.

#### 3. Byzantine Failures
- **Scenario**: Malicious client attempts to bypass logic (e.g., setting an order price to zero).
- **Handling**: We enforce Server-Side Constraints via Postgres CHECK constraints and Row Level Security (RLS). The logic is validated on the server before being committed to the database, rendering client-side manipulations ineffective.

### C. Security Model (نموذج الأمان)

Our security model follows the **Zero-Trust Principle**, leveraging Supabase's built-in features:

#### 1. Authentication
- We use **Supabase Auth** (powered by GoTrue), implementing JWT-based authentication for all entities.
- Every request must present a valid, short-lived JWT issued by the Supabase Auth server.

#### 2. Authorization
- We implement **Row Level Security (RLS)**. This is a Postgres feature that enforces security policies at the database level.
- For example, a policy ensures that `SELECT * FROM orders` for a driver only returns orders assigned to their `driver_id`. This is significantly more secure than application-level authorization.

#### 3. Confidentiality & Integrity
- All client-server communication is encrypted using **TLS 1.3**.
- Internally, Supabase ensures data encryption at rest (AES-256) and in transit, protecting sensitive user data.

#### 4. Non-repudiation
- We implement **Audit Logging** using Postgres triggers.
- Every critical mutation (Order Creation, Payment, Delivery) is captured in a dedicated `audit_logs` table with an immutable timestamp and the `auth.uid()` of the actor, creating a verifiable trail of actions.

---

## 6. Interprocess Communication (IPC) and Multicast Implementation

To make our Distributed Restaurant Delivery System functional, isolated microservices (Edge Functions) must communicate efficiently. We achieve this by defining specific IPC mechanisms and utilizing Application-Level Multicast for critical operational workflows.

### A. Interprocess Communication (IPC) Mechanisms

Since our backend consists of decoupled Serverless Edge Functions, we rely on high-performance network-based IPC tailored to specific needs:

#### 1. Synchronous IPC (REST over HTTPS)
- **Usage**: Communication between Client Apps and the Supabase Backend.
- **Implementation**: The client applications interact with the system via RESTful API calls to Supabase Edge Functions. The client waits for an immediate response (e.g., `201 Created` upon order submission).

#### 2. Synchronous IPC (Internal Edge Function Invocation)
- **Usage**: When one service requires an immediate response from another.
- **Implementation**: Using the `supabase.functions.invoke()` method, we can trigger one Edge Function from another. This provides high-performance, low-latency communication within the same cloud environment, serving as an efficient alternative to internal gRPC calls.

#### 3. Asynchronous IPC (Database-Driven Event Propagation)
- **Usage**: For decoupled workflows (e.g., the Saga Pattern).
- **Implementation**: Instead of external Message Queues, we use **PostgreSQL as an Event Store**. A service writes an event to a dedicated `outbox` table. Database Triggers then automatically process these records or broadcast them, allowing services to react asynchronously without needing to be active at the same time.

### B. Multicast Implementation in the System

In our system, **Multicast** is used to notify a specific group of relevant receivers (e.g., drivers in a specific zone) simultaneously. We implement this using **Application-Level Multicast** via Supabase Realtime Broadcast.

#### Use Case: Driver Dispatching

When an order is ready, we need to notify only the drivers currently available in the restaurant's vicinity.

#### How we implement Multicast:

**1. Group Formation (Geohashing & Presence)**
- The city is divided into geographical grids (Geohashes).
- As drivers move, their app shares their location with the Location Service.
- Drivers join a **Supabase Realtime Channel** corresponding to their current Geohash (e.g., `channel: 'zone-riyadh-north-a1'`). This channel acts as our **Multicast Group**.

**2. Executing the Multicast**
- When the Delivery Service needs a driver, it acts as the sender.
- It sends a single message ("New Delivery Offer: Order #992") to the specific `zone-riyadh-north-a1` channel using Supabase Realtime Broadcast.
- The Supabase infrastructure handles the "fan-out" process, pushing the message instantly to all connected mobile devices currently subscribed to that specific zone channel.
- **Race Condition Handling**: To ensure the order isn't accepted twice, the first driver to tap "Accept" makes an atomic call to the Order Service (Unicast) to claim the order. Once claimed, a final broadcast is sent to the channel to notify other drivers that the offer is closed.

---

**End of Documentation**
