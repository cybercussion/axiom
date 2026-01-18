# REST in Axiom

REST is the bread and butter of the web. Axiom treats it as a first-class citizen via the `gateway` and `state` modules.

## The Axiom Way

We don't use `axios`. We don't use `jquery`. We use a smart wrapper around `fetch`.

### 1. The Gateway (`src/core/gateway.js`)

The gateway handles the repetitive parts of REST: base URLs, headers, and parsing.

```javascript
import { gateway } from '@core/gateway';

// GEM: GET /api/users/1
const user = await gateway.get('/users/1');

// GEM: POST /api/users
const newUser = await gateway.post('/users', { name: 'Ada' });

// GEM: PUT /api/users/1
const updated = await gateway.put('/users/1', { name: 'Ada Lovelace' });

// GEM: DELETE /api/users/1
await gateway.delete('/users/1');
```

**Key Features:**
-   **Content-Type Agnostic:** Automatically detects JSON, Text, XML, or Blob.
-   **Error Handling:** Throws on 4xx/5xx status codes automatically.
-   **Configurable:** Uses `src/core/config.js` for `API_URL`.

### 2. Fetching Data (`state.query`)

Use `state.query` to fetch data. It handles deduplication, loading states, and caching.

```javascript
// src/features/users/user-api.js
import { gateway } from '@core/gateway';

export const fetchUser = (id) => gateway.get(`/users/${id}`);
```

```javascript
// src/features/users/user-profile.js
import { state } from '@state';
import { fetchUser } from './user-api.js';

connectedCallback() {
  // 1. Trigger the fetch
  // This sets state.data.currentUser.status = 'loading'
  state.query('currentUser', () => fetchUser(this.userId));

  // 2. React to changes
  this.subscribe('currentUser', (userState) => {
    if (userState.status === 'loading') {
      this.renderLoading();
    } else if (userState.status === 'success') {
      this.renderUser(userState.data);
    }
  });
}
```

### 3. Mutating Data (`state.mutate`)

Use `state.mutate` for actions that change data. It provides "Optimistic UI" out of the box.

```javascript
import { gateway } from '@core/gateway';
import { state } from '@state';

const updateUserApi = (id, data) => gateway.put(`/users/${id}`, data);

function onNameChange(userId, newName) {
  state.mutate('currentUser', (current) => {
    // 1. Optimistic Update (Immediate)
    // Return what you expect the new state to look like
    return { ...current, name: newName };
  }, async () => {
    // 2. Network Request (Background)
    // Must return the final confirmed data from server
    return updateUserApi(userId, { name: newName });
  });
}
```

## Summary

1.  **Use `gateway`**: It wraps `fetch` so you don't have to write headers every time.
2.  **Use `state.query`**: For GET requests.
3.  **Use `state.mutate`**: For POST/PUT/DELETE requests requiring optimistic updates.

Simple. Native. Fast.
