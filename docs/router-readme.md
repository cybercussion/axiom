# Router in Axiom

Our router is lightweight (~200 lines) but powerful. It handles:
1.  **Lazy Loading**: Components are imported only when needed.
2.  **Parallel Data Fetching**: Code and Data load simultaneously.
3.  **View Transitions**: Native cross-fades.
4.  **Dynamic Parameters**: `/user/:id` support.

## Route Guards

You can protect routes by adding a `guard` function to the config. If it returns `false`, the user is redirected to `/login`.

```javascript
const ROUTES = {
  'admin': { 
    path: '@features/admin/admin.js',
    // Async supported!
    guard: async () => {
      const user = state.get('currentUser');
      return user && user.role === 'admin';
    } 
  }
};
```

## Dynamic Routes

You can define routes with parameters in `src/core/router.js`.

### 1. Configuration

```javascript
// src/core/router.js
const ROUTES = {
  // Static
  'home': { path: '@features/home/home.js' },

  // Dynamic (Colon syntax)
  'user/:id': { 
     path: '@features/user/user.js',
     // API function receives the params object!
     api: (params) => fetch(`/api/users/${params.id}`).then(r => r.json()), 
     dataKey: 'currentUser'
  },
  
  'library/:category/:item': {
     path: '@features/library/item.js'
  }
};
```

### 2. Usage in Components

The router extracts the parameters and stores them in `state.params`.

```javascript
// src/features/user/user.js
import { state } from '@state';
import { BaseComponent } from '@shared/base-component';

export default class UserProfile extends BaseComponent {
  connectedCallback() {
    this.subscribe('params', (params) => {
      console.log('User ID is:', params.id);
      this.render(params);
    });
  }
}
```

### 3. Navigation

Just link to it normally. The router intercepts clicks.

```html
<a href="/user/42">View Profile</a>
<a href="/library/fiction/dune">View Book</a>
```

## How it works

1.  User clicks `/user/42`.
2.  Router iterates `ROUTES` looking for a match.
3.  Matches `user/:id`.
4.  Sets `state.params = { id: '42' }`.
5.  Sets `state.route = 'user/:id'`.
6.  Loads `@features/user/user.js`.
