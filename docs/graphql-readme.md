# GraphQL in Axiom

So you want to use GraphQL.

**STOP.** Put down `apollo-client`. Step away from `urql`.

You do not need a 40kb library to send a POST request string.

## The Axiom Way

GraphQL is just HTTP POST with a specific body shape. Our `gateway.js` can handle this natively with zero dependencies.

### 1. The Wrapper

You can create a specialized `graphql` helper, or extend the gateway. Here is the "vanilla" implementation:

```javascript
// src/core/graphql.js
import { gateway } from './gateway.js';

export const gql = (query, variables = {}) => {
  return gateway.request('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables })
  }).then(res => {
    if (res.errors) throw res.errors; // GraphQL-level errors
    return res.data;
  });
};
```

### 2. State Integration

Axiom's `state.js` doesn't care if data comes from REST or GraphQL. Use `state.query` exactly the same way.

```javascript
// src/features/profile/profile.js
import { state } from '@state';
import { gql } from '@core/graphql';

const GET_PROFILE = `
  query GetProfile($id: ID!) {
    user(id: $id) {
      name
      avatar
      role
    }
  }
`;

// In your component
connectedCallback() {
  state.query('current-user', () => gql(GET_PROFILE, { id: '123' }));
  
  this.subscribe('current-user', (user) => {
    this.render(user);
  });
}
```

### 3. Mutations (Optimistic)

GraphQL mutations work perfectly with `state.mutate` for optimistic UI updates.

```javascript
const UPDATE_AVATAR = `
  mutation UpdateAvatar($url: String!) {
    updateAvatar(url: $url) {
      url
    }
  }
`;

function onAvatarUpload(newUrl) {
  state.mutate('current-user', (current) => {
    // 1. Optimistic Update
    // Return the shape you EXPECT the server to return, or the new state
    return { ...current, avatar: newUrl };
  }, async () => {
    // 2. The Real Network Request
    return gql(UPDATE_AVATAR, { url: newUrl });
  });
}
```

## Summary

1.  **Define Queries as Strings**: Template literals are fine.
2.  **Use `state.query`**: It handles caching, loading states, and deduplication for you.
3.  **Use `state.mutate`**: It handles optimistic rollbacks automatically.

Zero build steps. Zero extra bundles. Pure performance.
