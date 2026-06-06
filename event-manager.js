/**
 * EventManager - イベントリスナーの一元管理
 * メモリリーク防止と責任分離を実現
 */

class EventManager {
  constructor() {
    // 登録済みリスナーを追跡 { selector -> { event -> handler } }
    this.listeners = new Map();
    // グローバルリスナー（window/document） { event -> handler }
    this.globalListeners = new Map();
  }

  /**
   * 要素にリスナーを登録（重複排除）
   */
  on(element, event, handler, options = {}) {
    if (!element) {
      console.warn(`[EventManager] Element is null for event: ${event}`);
      return;
    }

    const key = this._getElementKey(element);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Map());
    }

    const eventMap = this.listeners.get(key);
    if (!eventMap.has(event)) {
      eventMap.set(event, []);
    }

    // 既に同じハンドラが登録されていないか確認
    const handlers = eventMap.get(event);
    if (handlers.find(h => h.handler === handler)) {
      console.warn(`[EventManager] Handler already registered for ${event}`);
      return;
    }

    handlers.push({ handler, options });
    element.addEventListener(event, handler, options);
  }

  /**
   * リスナーを削除
   */
  off(element, event, handler) {
    if (!element) return;

    const key = this._getElementKey(element);
    if (!this.listeners.has(key)) return;

    const eventMap = this.listeners.get(key);
    if (!eventMap.has(event)) return;

    const handlers = eventMap.get(event);
    const index = handlers.findIndex(h => h.handler === handler);

    if (index !== -1) {
      const { handler: fn, options } = handlers[index];
      element.removeEventListener(event, fn, options);
      handlers.splice(index, 1);

      if (handlers.length === 0) {
        eventMap.delete(event);
      }
    }

    if (eventMap.size === 0) {
      this.listeners.delete(key);
    }
  }

  /**
   * 要素のすべてのリスナーを削除
   */
  offAll(element) {
    if (!element) return;

    const key = this._getElementKey(element);
    const eventMap = this.listeners.get(key);

    if (!eventMap) return;

    for (const [event, handlers] of eventMap.entries()) {
      for (const { handler, options } of handlers) {
        element.removeEventListener(event, handler, options);
      }
    }

    this.listeners.delete(key);
  }

  /**
   * グローバルリスナーを登録（window/document等）
   */
  onGlobal(target, event, handler, options = {}) {
    const key = `${target.toString()}:${event}`;

    if (this.globalListeners.has(key)) {
      console.warn(`[EventManager] Global handler already registered for ${key}`);
      return;
    }

    this.globalListeners.set(key, { target, handler, options });
    target.addEventListener(event, handler, options);
  }

  /**
   * グローバルリスナーを削除
   */
  offGlobal(target, event, handler) {
    const key = `${target.toString()}:${event}`;
    const data = this.globalListeners.get(key);

    if (data) {
      target.removeEventListener(event, handler, data.options);
      this.globalListeners.delete(key);
    }
  }

  /**
   * すべてのリスナーを削除（クリーンアップ用）
   */
  destroy() {
    // 要素リスナーをクリア
    for (const [, eventMap] of this.listeners.entries()) {
      for (const [, handlers] of eventMap.entries()) {
        for (const { handler, options } of handlers) {
          // 注: elementへのアクセスがないため、手動削除は不可
          // 要素が削除されれば自動的にクリアされる
        }
      }
    }
    this.listeners.clear();

    // グローバルリスナーをクリア
    for (const [, { target, handler, options }] of this.globalListeners.entries()) {
      target.removeEventListener(event, handler, options);
    }
    this.globalListeners.clear();
  }

  /**
   * 要素の識別キーを生成
   */
  _getElementKey(element) {
    // element.id または element自身をキーとする
    return element.id || `elem_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default EventManager;
