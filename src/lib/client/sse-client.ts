/**
 * Custom SSE client that supports POST requests
 *
 * The native EventSource API only supports GET requests, but we need POST
 * for better security and to send request bodies with connection parameters.
 * Actually, it's more about circumventing SSE limitations with DigitalOcean
 * App Platform, which tries to cache GET requests.
 */

export interface SSEClientOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface SSEEvent {
  type: string;
  data: string;
  id?: string;
  retry?: number;
}

export type SSEEventHandler = (event: SSEEvent) => void;
export type SSEStateHandler = () => void;
export type SSEErrorHandler = (error: Error) => void;
export type MessageEventHandler = (event: { data: string }) => void;

export class SSEClient {
  private url: string;
  private method: 'GET' | 'POST';
  private headers: Record<string, string>;
  private body: any;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;

  private abortController: AbortController | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private isClosed = false;

  private eventHandlers: Map<string, SSEEventHandler[]> = new Map();
  private onOpenHandler: SSEStateHandler | null = null;
  private onErrorHandler: SSEErrorHandler | null = null;
  private onCloseHandler: SSEStateHandler | null = null;
  private onMessageHandler: MessageEventHandler | null = null;

  public readyState: number = 0; // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED

  constructor(options: SSEClientOptions) {
    this.url = options.url;
    this.method = options.method || 'GET';
    this.headers = {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...options.headers
    };
    this.body = options.body;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;

    this.connect();
  }

  private async connect(): Promise<void> {
    if (this.isClosed || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.readyState = 0; // CONNECTING
    this.abortController = new AbortController();

    try {
      const fetchOptions: RequestInit = {
        method: this.method,
        headers: this.headers,
        signal: this.abortController.signal,
        credentials: 'include' // Include cookies for authentication
      };

      if (this.method === 'POST' && this.body) {
        fetchOptions.body = JSON.stringify(this.body);
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Content-Type': 'application/json'
        };
      }

      const response = await fetch(this.url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      this.readyState = 1; // OPEN
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      if (this.onOpenHandler) {
        this.onOpenHandler();
      }

      await this.processStream(response.body);

    } catch (error) {
      this.isConnecting = false;

      if (error instanceof Error && error.name === 'AbortError') {
        // Connection was deliberately closed
        return;
      }

      this.readyState = 2; // CLOSED

      if (this.onErrorHandler) {
        this.onErrorHandler(error instanceof Error ? error : new Error(String(error)));
      }

      this.scheduleReconnect();
    }
  }

  private async processStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        this.processLines(lines);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        if (this.onErrorHandler) {
          this.onErrorHandler(error);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private processLines(lines: string[]): void {
    let event: Partial<SSEEvent> = {};

    for (const line of lines) {
      if (line === '') {
        // Empty line signals end of event
        if (event.data !== undefined) {
          this.dispatchEvent({
            type: event.type || 'message',
            data: event.data,
            id: event.id,
            retry: event.retry
          });
        }
        event = {};
        continue;
      }

      if (line.startsWith(':')) {
        // Comment line, ignore
        continue;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const field = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      switch (field) {
        case 'event':
          event.type = value;
          break;
        case 'data':
          event.data = (event.data || '') + value + '\n';
          break;
        case 'id':
          event.id = value;
          break;
        case 'retry': {
          const retryMs = parseInt(value, 10);
          if (!isNaN(retryMs)) {
            event.retry = retryMs;
            this.reconnectInterval = retryMs;
          }
          break;
        }
      }
    }
  }

  private dispatchEvent(event: SSEEvent): void {
    // Clean up data field (remove trailing newline)
    if (event.data.endsWith('\n')) {
      event.data = event.data.slice(0, -1);
    }

    // Dispatch to type-specific handlers
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(handler => handler(event));

    // Also dispatch to onmessage handler and 'message' event handlers
    if (this.onMessageHandler) {
      this.onMessageHandler({ data: event.data });
    }

    // Also dispatch to 'message' handlers if this isn't already a 'message' event
    if (event.type !== 'message') {
      const messageHandlers = this.eventHandlers.get('message') || [];
      messageHandlers.forEach(handler => handler(event));
    }
  }

  private scheduleReconnect(): void {
    if (this.isClosed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.readyState = 2; // CLOSED
      if (this.onCloseHandler) {
        this.onCloseHandler();
      }
      return;
    }

    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  // Public API methods to match EventSource interface
  public addEventListener(type: string, handler: SSEEventHandler): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type)!.push(handler);
  }

  public removeEventListener(type: string, handler: SSEEventHandler): void {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public close(): void {
    this.isClosed = true;
    this.readyState = 2; // CLOSED

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.onCloseHandler) {
      this.onCloseHandler();
    }
  }

  // Event handler properties to match EventSource interface
  public set onopen(handler: SSEStateHandler | null) {
    this.onOpenHandler = handler;
  }

  public set onerror(handler: SSEErrorHandler | null) {
    this.onErrorHandler = handler;
  }

  public set onclose(handler: SSEStateHandler | null) {
    this.onCloseHandler = handler;
  }

  public set onmessage(handler: MessageEventHandler | null) {
    this.onMessageHandler = handler;
  }
}
