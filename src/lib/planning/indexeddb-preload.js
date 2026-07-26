const mockIDB = {
  open: () => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
  deleteDatabase: () => ({}),
  cmp: () => 0,
};

const mockKeyRange = {
  bound: () => ({}),
  lowerBound: () => ({}),
  upperBound: () => ({}),
  only: () => ({}),
};

globalThis.indexedDB = mockIDB;
global.indexedDB = mockIDB;
globalThis.IDBKeyRange = mockKeyRange;
global.IDBKeyRange = mockKeyRange;
