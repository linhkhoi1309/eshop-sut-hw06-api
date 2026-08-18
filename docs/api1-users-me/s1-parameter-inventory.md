# Stage S1: Parameter Inventory for API 1 (`PUT /api/users/me`)

| Parameter | Source | Type | Required/Optional | Spec Constraints | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Authorization` | Header | String | Required | Must be a valid JWT token (SEC-02). | Used to authenticate the user and extract user identity. |
| `name` | Body | String | Undetermined | Basic profile information. | Spec does not state if required. |
| `shipping_address` | Body | String | Undetermined | Default shipping address. | Spec does not state if required. |
| `phone` | Body | String | Undetermined | Must start with '0', length 10-11 digits (FR-04). | Spec does not state if required. |
| `email` | Body | String | Not Allowed | Cannot be changed via interface (FR-04). | Must be ignored or rejected if present. |
| `role` | Body | String | Not Allowed | User cannot change their own role (FR-04, SEC-06). | Must be ignored or rejected if present. |
| `user_id` | Implicit (JWT) | Integer | Required | Must match the authenticated user's ID. | Extracted from JWT to ensure user updates own profile (FR-04). |
| `User Record` | DB State | Record | Required | User must exist in the database. | Target resource for the update. |
