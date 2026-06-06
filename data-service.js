/**
 * DataService - Firebase/ローカルストレージの分離抽象化
 * Phase 3: 状態管理の関数化と Firebase/ローカル処理の分離
 */

class DataService {
  constructor(config = {}) {
    this.config = config;
    this.isLocal = false;
    this.db = null;
    this.auth = null;
    this.currentUser = null;
    this.listeners = new Map(); // 変更リスナー
  }

  /**
   * Firebase初期化
   */
  async initializeFirebase(firebaseConfig) {
    try {
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
      const { getFirestore } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
      const { getAuth, signInAnonymously, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");

      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app);
      this.auth = getAuth(app);

      return new Promise((resolve) => {
        onAuthStateChanged(this.auth, (user) => {
          this.currentUser = user;
          if (!user) {
            signInAnonymously(this.auth).catch(err => {
              console.error("匿名サインイン失敗", err);
            });
          }
          resolve(user);
        });
      });
    } catch (error) {
      console.warn("Firebase初期化失敗。ローカルモードに移行:", error);
      this.isLocal = true;
      return null;
    }
  }

  /**
   * キャッシュを追加
   */
  async addCache(content, category, elapsedSeconds) {
    if (this.isLocal || !this.db) {
      return this._addLocalCache(content, category, elapsedSeconds);
    } else {
      return this._addFirebaseCache(content, category, elapsedSeconds);
    }
  }

  /**
   * キャッシュを削除
   */
  async deleteCache(id) {
    if (this.isLocal || !this.db) {
      return this._deleteLocalCache(id);
    } else {
      return this._deleteFirebaseCache(id);
    }
  }

  /**
   * キャッシュのアーカイブ状態を切り替え
   */
  async toggleArchive(id, currentStatus) {
    if (this.isLocal || !this.db) {
      return this._toggleLocalArchive(id, currentStatus);
    } else {
      return this._toggleFirebaseArchive(id, currentStatus);
    }
  }

  /**
   * キャッシュのカテゴリを更新
   */
  async updateCategory(id, newCategory) {
    if (this.isLocal || !this.db) {
      return this._updateLocalCategory(id, newCategory);
    } else {
      return this._updateFirebaseCategory(id, newCategory);
    }
  }

  /**
   * スレッドを追加
   */
  async addThread(cacheId, threadText) {
    if (this.isLocal || !this.db) {
      return this._addLocalThread(cacheId, threadText);
    } else {
      return this._addFirebaseThread(cacheId, threadText);
    }
  }

  /**
   * キャッシュ一覧をサブスクライブ
   */
  subscribeCaches(callback) {
    if (this.isLocal || !this.db) {
      this._subscribeLocalCaches(callback);
    } else {
      this._subscribeFirebaseCaches(callback);
    }
  }

  /**
   * ===================== FIREBASE 実装 =====================
   */

  async _addFirebaseCache(content, category, elapsedSeconds) {
    const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    try {
      await addDoc(collection(this.db, "users", this.currentUser.uid, "caches"), {
        content,
        category,
        isArchived: false,
        elapsedSeconds,
        createdAt: serverTimestamp(),
        threads: []
      });
      return true;
    } catch (error) {
      console.error("Firestore追加失敗", error);
      return false;
    }
  }

  async _deleteFirebaseCache(id) {
    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    try {
      await deleteDoc(doc(this.db, "users", this.currentUser.uid, "caches", id));
      return true;
    } catch (error) {
      console.error("Firestore削除失敗", error);
      return false;
    }
  }

  async _toggleFirebaseArchive(id, currentStatus) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    try {
      await updateDoc(doc(this.db, "users", this.currentUser.uid, "caches", id), {
        isArchived: !currentStatus
      });
      return true;
    } catch (error) {
      console.error("Firestore更新失敗", error);
      return false;
    }
  }

  async _updateFirebaseCategory(id, newCategory) {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    try {
      await updateDoc(doc(this.db, "users", this.currentUser.uid, "caches", id), {
        category: newCategory
      });
      return true;
    } catch (error) {
      console.error("Firestore更新失敗", error);
      return false;
    }
  }

  async _addFirebaseThread(cacheId, threadText) {
    const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    try {
      const cacheRef = doc(this.db, "users", this.currentUser.uid, "caches", cacheId);
      const cacheSnap = await getDoc(cacheRef);
      
      if (cacheSnap.exists()) {
        const threads = cacheSnap.data().threads || [];
        threads.push({ text: threadText, createdAt: new Date() });
        await updateDoc(cacheRef, { threads });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Firestore更新失敗", error);
      return false;
    }
  }

  _subscribeFirebaseCaches(callback) {
    const { collection, query, orderBy, onSnapshot } = require("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

    const q = query(
      collection(this.db, "users", this.currentUser.uid, "caches"),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      callback(list);
    }, (error) => {
      console.error("Snapshot error:", error);
      callback([]);
    });
  }

  /**
   * ===================== ローカルストレージ実装 =====================
   */

  _addLocalCache(content, category, elapsedSeconds) {
    const caches = this._getLocalCaches();
    const newCache = {
      id: "temp_" + Date.now(),
      content,
      category,
      isArchived: false,
      elapsedSeconds,
      createdAt: new Date(),
      threads: []
    };
    caches.unshift(newCache);
    this._saveLocalCaches(caches);
    this._notifyListeners(caches);
    return true;
  }

  _deleteLocalCache(id) {
    let caches = this._getLocalCaches();
    caches = caches.filter(c => c.id !== id);
    this._saveLocalCaches(caches);
    this._notifyListeners(caches);
    return true;
  }

  _toggleLocalArchive(id, currentStatus) {
    const caches = this._getLocalCaches();
    const item = caches.find(c => c.id === id);
    if (item) {
      item.isArchived = !currentStatus;
      this._saveLocalCaches(caches);
      this._notifyListeners(caches);
    }
    return true;
  }

  _updateLocalCategory(id, newCategory) {
    const caches = this._getLocalCaches();
    const item = caches.find(c => c.id === id);
    if (item) {
      item.category = newCategory;
      this._saveLocalCaches(caches);
      this._notifyListeners(caches);
    }
    return true;
  }

  _addLocalThread(cacheId, threadText) {
    const caches = this._getLocalCaches();
    const item = caches.find(c => c.id === cacheId);
    if (item) {
      item.threads = item.threads || [];
      item.threads.push({ text: threadText, createdAt: new Date() });
      this._saveLocalCaches(caches);
      this._notifyListeners(caches);
    }
    return true;
  }

  _subscribeLocalCaches(callback) {
    const caches = this._getLocalCaches();
    callback(caches);
    // ローカルの場合は1回の呼び出しのみ（リアルタイム監視がないため）
  }

  /**
   * ===================== ローカルユーティリティ =====================
   */

  _getLocalCaches() {
    return JSON.parse(localStorage.getItem('brain_cache_mock') || '[]');
  }

  _saveLocalCaches(caches) {
    localStorage.setItem('brain_cache_mock', JSON.stringify(caches));
  }

  _notifyListeners(caches) {
    this.listeners.forEach(callback => {
      callback(caches);
    });
  }

  /**
   * リスナーを登録
   */
  addListener(callback) {
    const id = Math.random().toString(36).substr(2, 9);
    this.listeners.set(id, callback);
    return () => this.listeners.delete(id);
  }
}

export default DataService;
