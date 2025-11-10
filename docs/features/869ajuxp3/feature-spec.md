Of course. Here is a detailed feature specification for the "Extend landing top section" task.

---

### **Feature Specification: Admin Landing Page Calculator**

#### 1. Feature Overview

This feature will replace the existing simple calculator on the admin landing page with a more powerful, multi-functional statistics module. It is needed to provide administrators with quick access to key metrics regarding tour registrations, payments, and overall platform user growth. The expected outcome is an interactive UI component that allows admins to dynamically query and view these different statistics, improving their ability to monitor platform activity.

#### 2. Files to Modify

*Based on a standard MERN/PERN stack architecture. Exact paths may vary.*

*   **Frontend (New Files)**
    *   `src/components/admin/landing/StatsCalculator.jsx` - A new React component to encapsulate the entire logic and UI for the three calculator types. It will manage internal state for the selected type, inputs, and fetched data.
    *   `src/api/services/statsService.js` - A new service file to handle all API requests related to the new statistics endpoints.

*   **Frontend (Existing Files to Modify)**
    *   `src/pages/admin/LandingPage.jsx` - This page will be modified to remove the old calculator component and integrate the new `StatsCalculator` component in its place.

*   **Backend (New Files)**
    *   `src/api/controllers/stats.controller.js` - A new controller to house the business logic for calculating tour registrations, tour payments, and global user counts.
    *   `src/api/routes/stats.routes.js` - A new router file to define the API endpoints for fetching the statistics (e.g., `/api/v1/stats/tour-registrations`, `/api/v1/stats/tour-payments`, `/api/v1/stats/global`).

*   **Backend (Existing Files to Modify)**
    *   `src/app.js` (or `src/server.js`) - To import and mount the new `stats.routes.js` router.
    *   `src/api/services/tour.service.js` - To add a new method that performs the specific aggregation logic for counting all subject registrations for a given tour.
    *   `src/api/services/payment.service.js` - To add a new method for counting all payments associated with a given tour.
    *   `src/api/services/user.service.js` - To add methods for counting the total number of student and teacher accounts across the platform.

#### 3. Technical Approach

*   **Component-Based Frontend:** The entire feature will be built as a single, self-contained `StatsCalculator` React component, which will be responsible for its own UI, state management, and data fetching.
*   **Backend-Driven Logic:** All calculations will be performed on the backend via dedicated API endpoints. This ensures data integrity, performance, and security, as the frontend only needs to query for the final numbers, not the raw data.
*   **New REST Endpoints:** Three new, specific REST endpoints will be created to serve the data for each calculator type, ensuring separation of concerns and making the API easy to understand and test.
*   **Database Aggregation:** The backend logic will rely on efficient database aggregation queries (e.g., `COUNT`) to calculate the required statistics. Performance for global counts should be considered, with caching implemented if necessary.
*   **State Management:** The frontend component will use local state (e.g., React's `useState` and `useEffect` hooks) to manage the active calculator type, user inputs (project, tour, places), and the data returned from the API.

#### 4. Implementation Steps

1.  **Backend: Database & Service Logic**
    *   In `user.service.js`, create functions to get the total count of student users and teacher profiles.
    *   In `tour.service.js`, create a function that accepts a `tourId` and returns the total count of subject registrations.
    *   In `payment.service.js`, create a function that accepts a `tourId` and returns the total count of payments.
2.  **Backend: API Layer**
    *   Create `stats.controller.js` with three methods, one for each calculator type, that call the new service functions.
    *   Create `stats.routes.js` to define the GET routes (e.g., `/global`, `/tour-registrations`, `/tour-payments`) and link them to the controller methods.
    *   Mount the new routes in the main application entry point (`app.js`).
3.  **Frontend: API Service**
    *   Create `statsService.js` with functions to call the three new backend endpoints.
4.  **Frontend: Component Scaffolding**
    *   Create the new `StatsCalculator.jsx` file with the basic JSX structure, including a dropdown to switch between the three types and placeholder divs for the results.
5.  **Frontend: Component Implementation**
    *   Implement state management for the selected calculator type.
    *   Build the UI for each type, conditionally rendering project/tour selectors and the "available places" input field.
    *   Fetch projects and tours to populate the selectors.
    *   Trigger the appropriate `statsService` function when inputs change and display the returned data.
6.  **Frontend: Integration**
    *   In `LandingPage.jsx`, remove the old calculator and import and render the new `StatsCalculator` component.
    *   Apply final styling to match the design requirements (main title, descriptive text, number).

#### 5. Testing Strategy

*   **Backend (Unit/Integration Tests):**
    *   Create `tests/api/controllers/stats.controller.test.js` to test each controller method.
    *   Ensure each endpoint returns the correct status code and payload structure. Mock the service layer to test the controller in isolation.
    *   Test the new service functions with various scenarios: a tour with many registrations, a tour with zero, etc.
*   **Frontend (Component Tests):**
    *   Create `src/components/admin/landing/StatsCalculator.test.jsx`.
    *   Test that the correct inputs and displays render when switching between calculator types.
    *   Mock the `statsService` to verify that the correct API calls are made when the user selects a tour.
    *   Test the "Places left" calculation on the frontend.
*   **End-to-End (E2E) Tests:**
    *   Create a test that simulates an admin logging in, navigating to the landing page, and interacting with each of the three calculator modes to ensure the full flow works as expected.

#### 6. Acceptance Criteria

*   [ ] The old calculator on the admin landing page is replaced by the new `StatsCalculator` component.
*   [ ] The component includes a dropdown to select one of three modes: "Tour Registrations," "Tour Payments," or "Global Stats."
*   [ ] **Tour Registrations Mode:**
    *   [ ] Project and Tour dropdown selectors are displayed.
    *   [ ] Upon selecting a tour, two figures are shown: "Students registered" (total subject registrations for that tour) and "Teachers registered" (total teacher profiles on the platform).
*   [ ] **Tour Payments Mode:**
    *   [ ] Project and Tour dropdown selectors and a numeric input for "Available Places" are displayed.
    *   [ ] Upon selecting a tour, two figures are shown: "Places reserved" (total payments for that tour) and "Places left" (available places minus reserved).
*   [ ] **Global Stats Mode:**
    *   [ ] No selectors or inputs are displayed.
    *   [ ] Two figures are shown: "Total students registered" (total student accounts) and "Total teachers registered" (total teacher profiles).
*   [ ] The UI for each statistic follows the new design: a main title, a small descriptive text above the number, and the number itself.
*   [ ] The component is responsive and visually consistent with the rest of the admin dashboard.