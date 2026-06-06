/**
 * StateManager - 状態管理の関数化
 * 状態変更を一元化し、変更追跡を容易にする
 */

class StateManager {
  constructor(initialState = {}) {
    this.state = initialState;
    this.subscribers = new Map(); // { key -> Set of callbacks }
    this.history = []; // 状態変更の履歴
    this.maxHistory = 50;
  }

  /**
   * 状態を取得
   */
  getState(key = null) {
    if (key === null) return { ...this.state };
    return this.state[key];
  }

  /**
   * 状態を設定（履歴に記録）
   */
  setState(key, value) {
    const oldValue = this.state[key];
    
    // 変更がない場合はスキップ
    if (this._isEqual(oldValue, value)) {
      return;
    }

    // 履歴に記録
    this._recordHistory(key, oldValue, value);

    // 状態を更新
    this.state[key] = value;

    // 購読者に通知
    this._notifySubscribers(key, value, oldValue);
  }

  /**
   * 複数の状態をまとめて設定
   */
  setStateMultiple(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this.setState(key, value);
    }
  }

  /**
   * 状態の変更を購読
   * @returns アンサブスクライブ関数
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key).add(callback);

    // アンサブスクライブ関数を返す
    return () => {
      this.subscribers.get(key).delete(callback);
    };
  }

  /**
   * すべてのキーの変更を購読
   */
  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  /**
   * 状態をリセット
   */
  reset(initialState) {
    this.state = { ...initialState };
    this.history = [];
    this._notifySubscribers('*', this.state, null);
  }

  /**
   * 変更履歴を取得
   */
  getHistory(limit = this.maxHistory) {
    return this.history.slice(-limit);
  }

  /**
   * 変更をUndo（1段階戻る）
   */
  undo() {
    if (this.history.length === 0) return false;

    const lastChange = this.history[this.history.length - 1];
    this.state[lastChange.key] = lastChange.oldValue;
    this.history.pop();

    this._notifySubscribers(lastChange.key, lastChange.oldValue, lastChange.newValue);
    return true;
  }

  /**
   * 内部: 購読者に通知
   */
  _notifySubscribers(key, newValue, oldValue) {
    // 特定のキーの購読者に通知
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(callback => {
        callback(newValue, oldValue, key);
      });
    }

    // ワイルドカードの購読者に通知
    if (this.subscribers.has('*')) {
      this.subscribers.get('*').forEach(callback => {
        callback(this.state, { key, newValue, oldValue });
      });
    }
  }

  /**
   * 内部: 変更を履歴に記録
   */
  _recordHistory(key, oldValue, newValue) {
    this.history.push({
      timestamp: Date.now(),
      key,
      oldValue,
      newValue
    });

    // 履歴の上限を超えたら古い方から削除
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * 内部: 値が等しいか判定
   */
  _isEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object' && a !== null && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  /**
   * デバッグ用: 現在の状態をログ出力
   */
  debug() {
    console.group('[StateManager]');
    console.log('Current State:', this.state);
    console.log('History:', this.getHistory());
    console.groupEnd();
  }
}

export default StateManager;
