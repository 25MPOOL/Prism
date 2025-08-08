interface WebSocketManagerOptions<T> {
  onOpen?: (manager: WebSocketManager<T>) => void;
  onMessage?: (data: T) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

export class WebSocketManager<ReceiveData, SendData = unknown> {
  private ws: WebSocket | null = null;
  private url: string;
  private options: WebSocketManagerOptions<ReceiveData>;

  constructor(url: string, options: WebSocketManagerOptions<ReceiveData>) {
    this.url = url;
    this.options = options;
  }

  public connect() {
    if (this.ws && this.ws.readyState < WebSocket.CLOSING) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => this.options.onOpen?.(this);
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as ReceiveData;
      this.options.onMessage?.(data);
    };
    this.ws.onerror = (error) => this.options.onError?.(error);
    this.ws.onclose = () => this.options.onClose?.();
  }

  public send(data: SendData) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not open. Cannot send data.");
      return false;
    }
    this.ws.send(JSON.stringify(data));
    return true;
  }

  public disconnect() {
    this.ws?.close();
  }

  public getReadyState(): number | undefined {
    return this.ws?.readyState;
  }
}
