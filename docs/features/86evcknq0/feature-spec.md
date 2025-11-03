Here is the feature specification for the "Add Activity Log Page" task.

### **Feature Specification: Activity Log Page**

**Task ID:** 86evcknq0

---

### 1. Feature Overview

This feature involves creating a new "Activity Log" page where users can view a history of their recent actions within the application. The primary goal is to enhance user trust and transparency by providing a clear, filterable record of account activity. The expected outcome is a responsive, client-side rendered page that initially uses mock data and is architected for future integration with a live backend.

### 2. Files to Modify

*I am assuming a standard MERN (MongoDB, Express, React, Node.js) or similar stack with a `src` directory. File paths are relative to the repository root: `/Users/user/Documents/Personal-Projects/collabifi-back`.*

**New Files:**

*   `src/api/activity/activity.controller.js` - To be created. Will contain the Express controller logic to handle incoming HTTP requests for activity data, including filtering and pagination.
*   `src/api/activity/activity.service.js` - To be created. Will be responsible for fetching and returning a mock list of user activities. This service will simulate a database or backend call.
*   `src/api/activity/activity.router.js` - To be created. Will define the API routes for the activity feature (e.g., `GET /api/activities`).
*   `src/client/pages/ActivityLogPage.jsx` - To be created. This will be the main React component for the page, managing state for activities, filters, and pagination.
*   `src/client/components/ActivityTable.jsx` - To be created. A presentational component to render the list of activities, a "Load More" button, and the empty state message.
*   `src/client/components/ActivityFilter.jsx` - To be created. A component containing the UI for date range and activity type filters.
*   `src/client/services/activityService.js` - To be created. A client-side service (e.g., using Axios or Fetch) to communicate with the new backend API endpoint.

**Existing Files to Modify:**

*   `src/app.js` - To be modified. The main Express app file will be updated to import and use the new `activity.router.js`.
*   `src/client/App.jsx` - To be modified. The main React router file will be updated to add a new route (`/profile/activity`) that renders the `ActivityLogPage`.
*   `src/client/components/ProfileMenu.jsx` - To be modified. A link to the "Activity Log" page (`/profile/activity`) will be added to the user's profile navigation menu.

### 3. Technical Approach

*   **Architecture:** A new API endpoint will be created on the Express backend to serve mock activity data. The frontend will be built using React, with a new page component that fetches data from this endpoint and renders it using smaller, reusable components for the table and filters.
*   **State Management:** Client-side state (activity list, filter values, current page) will be managed within the `ActivityLogPage.jsx` component using React Hooks (`useState`, `useEffect`).
*   **Data Flow:** The `ActivityLogPage` will fetch initial data on load. User interactions with filters or the "Load More" button will trigger new API calls, and the component will re-render with the updated data without a full page refresh.
*   **Dependencies:** No new external libraries are strictly required, but `axios` is recommended for client-side HTTP requests for cleaner API calls.
*   **Challenges:** Ensuring the filtering logic on the mock backend is robust and that the frontend state updates correctly in response to multiple simultaneous filter changes.

### 4. Implementation Steps

1.  **Backend Setup:**
    1.  Create `src/api/activity/activity.service.js` to export a function that returns a static array of 50-100 mock activity objects.
    2.  Create `src/api/activity/activity.controller.js` to handle `GET` requests. It should use the service to get data and then apply filtering (by date/type) and pagination based on query parameters.
    3.  Create `src/api/activity/activity.router.js` to wire up the controller to the `GET /api/activities` route.
    4.  Modify `src/app.js` to register the new router.
2.  **Frontend Service:**
    1.  Create `src/client/services/activityService.js` with a function to fetch activities from `/api/activities`, passing filter and pagination parameters.
3.  **Component Development:**
    1.  Create the `src/client/components/ActivityFilter.jsx` component with dropdowns and date pickers. It will lift its state up to the parent page.
    2.  Create the `src/client/components/ActivityTable.jsx` to receive an array of activities as a prop and render them. It should also display a message if the array is empty and render a "Load More" button.
4.  **Page Assembly:**
    1.  Create the `src/client/pages/ActivityLogPage.jsx`. This component will manage all state, fetch data using the `activityService`, and pass props down to the `ActivityFilter` and `ActivityTable` components.
5.  **Routing and Navigation:**
    1.  Modify `src/client/App.jsx` to add a route that maps `/profile/activity` to the `ActivityLogPage` component.
    2.  Modify `src/client/components/ProfileMenu.jsx` to include a `<Link>` or `<a>` tag pointing to `/profile/activity`.

### 5. Testing Strategy

*   **Backend Unit Tests:** Create `src/api/activity/activity.controller.test.js` to test the controller's ability to correctly filter by date range and type, handle pagination, and manage invalid query parameters.
*   **Frontend Component Tests:** Create test files like `src/client/components/ActivityTable.test.jsx` to verify that the table renders correctly with data, shows the empty state when given no data, and that the "Load More" button fires its callback.
*   **Integration Tests:** Test the complete flow from the `ActivityLogPage` component making an API call to the mock backend and rendering the results. Mock the HTTP request to avoid actual network calls.
*   **Edge Cases:** Test for scenarios such as: no activities found, filter returning no results, reaching the end of the activity list (disable "Load More"), and responsiveness on various screen sizes.

### 6. Acceptance Criteria

- [ ] A new "Activity Log" link is present in the user profile menu.
- [ ] Clicking the link navigates the user to the `/profile/activity` page.
- [ ] The page displays a table or list of the 20 most recent user activities by default.
- [ ] Each activity entry shows the action type, a description, and a timestamp.
- [ ] The page includes filter controls for a date range and activity type.
- [ ] Applying a filter updates the activity list without a full page reload.
- [ ] A "Load More" button or pagination control is present and functional, fetching the next set of activities.
- [ ] If no activities match the filter criteria or exist at all, an "empty state" message is displayed.
- [ ] The layout is responsive and readable on both desktop and mobile screen sizes.
- [ ] All code is modular, and the frontend is ready to be connected to a real backend by swapping out the mock service.