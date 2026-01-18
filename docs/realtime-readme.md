# Real-Time in Axiom (WebSockets)

Most frameworks require "Middlewares", "Thunks", or "Sagas" to handle WebSockets.
Axiom requires... **Basic Javascript.**

Because our `state` is a Proxy, you can write to it from *anywhere*. Even a WebSocket callback.

## The Pattern

We treat the WebSocket as just another source of truth.

```javascript
// src/core/socket.js
import { state } from '@state';

let socket;

export function connect() {
  socket = new WebSocket('wss://api.axiom.com/v1/stream');

  socket.onmessage = (event) => {
    const { type, payload } = JSON.parse(event.data);

    // MIND BENDING PART:
    // We just... write to the state.
    // The UI updates automatically.
    
    if (type === 'STOCK_UPDATE') {
       // If you have a list, find and update
       const index = state.data.stocks.findIndex(s => s.id === payload.id);
       if (index !== -1) {
         state.data.stocks[index] = payload; 
       }
    }
    
    if (type === 'CHAT_MESSAGE') {
       // Append to array
       state.data.messages = [...state.data.messages, payload];
    }
  };
}
```

## Usage in Components

Your components don't even need to know WebSockets exist. They just subscribe to the data.

```javascript
// src/features/ticker/ticker.js
import { BaseComponent } from '@shared/base-component.js';

class StockTicker extends BaseComponent {
  connectedCallback() {
    // This component updates whenever 'stocks' changes.
    // It doesn't care if it came from REST, GraphQL, or a Socket.
    this.subscribe('stocks', (stocks) => {
      this.render(stocks);
    });
  }
}
```

## Why this is "Mind Bending"

In Redux/Context, you'd need:
1.  Socket Listener
2.  Dispatch Action
3.  Reducer Case
4.  Selector
5.  Component Re-render

In Axiom:
1.  Socket Listener writes to `state.data`.
2.  Component updates.

**Nullius in verba.**
