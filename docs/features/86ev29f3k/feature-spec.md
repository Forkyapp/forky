Here is the feature specification for the "Add User Profile Update Feature" task.

### **Feature Specification: User Profile Update (Task 86ev29f3k)**

---

### 1. Feature Overview

This feature will introduce a user profile editing page where users can update their name, email, and profile picture. It is needed to provide users with control over their personal information, enhancing their experience and trust in the platform. The expected outcome is a seamless, in-app profile update process that reflects changes immediately without requiring a page reload.

### 2. Files to Modify

_Note: The following file paths are based on a standard Node.js/Express project structure. The exact paths may vary._

**New Files:**

*   `src/routes/userRoutes.js` - To define the new `PUT /api/users/profile` endpoint for handling profile updates.
*   `src/controllers/userController.js` - To create a `updateUserProfile` function that processes the request, validates input, and calls the user service.
*   `src/middleware/uploadMiddleware.js` - To create a middleware (using a library like `multer`) for handling profile picture file uploads.
*   `frontend/src/components/Profile/EditProfileForm.js` - A new frontend component for the profile editing form.
*   `frontend/src/services/userService.js` - A new frontend service to handle API requests related to user profiles.
*   `frontend/src/styles/EditProfile.css` - New CSS rules for styling the edit profile form and its elements.

**Existing Files to Modify:**

*   `src/models/User.js` - Add a `profilePictureUrl` field (String) to the user schema to store the path to the user's profile image.
*   `src/app.js` (or `server.js`) - To register the new `userRoutes.js` and apply the file upload middleware.
*   `frontend/src/App.js` (or router file) - To add a new route for the profile editing page (e.g., `/profile/edit`).

### 3. Technical Approach

*   **Backend (API):** A new RESTful `PUT` endpoint (`/api/users/profile`) will be created. It will be responsible for receiving user data, validating it, and updating the corresponding user record in the database.
*   **File Uploads:** Profile picture uploads will be handled using `multipart/form-data`. A middleware (e.g., `multer`) will process the image, save it to a designated server directory (e.g., `public/uploads/avatars`), and attach the file path to the request object for the controller to process.
*   **Frontend (UI):** The frontend will feature a form pre-filled with the user's current data. An asynchronous request (using `fetch` or `axios`) will be sent to the backend upon submission, preventing a full page reload and providing a smoother user experience.
*   **State Management:** Upon a successful API response, the local user state in the frontend application will be updated immediately, causing the UI (e.g., profile picture in the header) to re-render with the new information.
*   **Error Handling:** Both client-side and server-side validation will be implemented. The API will return clear error messages, which the frontend will display to the user in a non-intrusive manner (e.g., toast notifications or inline error messages).

### 4. Implementation Steps

1.  **Backend Setup:**
    1.  Modify the `User` schema in `src/models/User.js` to include the `profilePictureUrl` field.
    2.  Create the `uploadMiddleware.js` to handle image uploads, including validation for file type and size.
2.  **API Endpoint Creation:**
    1.  In `src/controllers/userController.js`, create the `updateUserProfile` function to handle the logic for validating input (name, email), updating the user document in the database, and returning the updated user object.
    2.  Define the `PUT /api/users/profile` route in `src/routes/userRoutes.js`, applying authentication middleware and the new `uploadMiddleware`.
    3.  Integrate the new user routes into the main application file (`src/app.js`).
3.  **Frontend Form:**
    1.  Create the `EditProfileForm.js` component with input fields for name and email, and a file input for the profile picture.
    2.  Style the form using `EditProfile.css` for a clean and user-friendly layout.
4.  **Frontend Logic:**
    1.  In `frontend/src/services/userService.js`, create a function to fetch the current user's profile data to pre-fill the form.
    2.  Implement a function in `userService.js` to send the `PUT` request with the form data (including the image as `FormData`) to the backend.
    3.  In `EditProfileForm.js`, implement client-side validation and handle the form submission. On success, update the local user state and display a success message. On failure, display the error message returned from the API.
5.  **UI Integration:**
    1.  Add a link or button to the main UI that navigates the user to the edit profile page.
    2.  Ensure that components displaying user information (e.g., header, dashboard) are subscribed to the user state and update automatically when the profile is changed.

### 5. Testing Strategy

*   **Unit Tests:**
    *   Create `src/controllers/userController.test.js` to test the `updateUserProfile` controller logic with mock requests, ensuring it correctly handles valid and invalid data.
    *   Test the `uploadMiddleware` to ensure it correctly filters file types and handles errors.
*   **Integration Tests:**
    *   Create `tests/integration/profile.test.js` to test the `PUT /api/users/profile` endpoint from end-to-end. This test should simulate a real request with a file upload and verify that the database is updated correctly.
*   **Frontend Tests:**
    *   Create `frontend/src/components/Profile/EditProfileForm.test.js` to test the form component. Tests should cover rendering, input validation, and correct submission handling.
*   **Edge Cases:**
    *   Test with invalid inputs (e.g., empty name, invalid email format).
    *   Test uploading incorrect file types (e.g., `.txt`, `.pdf`) and files that exceed the size limit.
    *   Test the behavior when the update request fails due to a server or network error.

### 6. Acceptance Criteria

- [ ] An "Edit Profile" button or link is available in the user interface.
- [ ] The edit profile form is pre-filled with the user's current name and email.
- [ ] The form validates that the name field is not empty.
- [ ] The form validates that the email field contains a correctly formatted email address.
- [ ] Users can select a new profile picture (e.g., JPG, PNG) from their device.
- [ ] Submitting the form with valid data sends a `PUT` request to the backend.
- [ ] A success message is displayed upon successful submission.
- [ ] The user's name, email, and profile picture update immediately in the UI without a page refresh.
- [ ] Updated profile information persists after the user refreshes the page.
- [ ] An appropriate error message is displayed if the form submission fails (eg., due to invalid data or a server error).