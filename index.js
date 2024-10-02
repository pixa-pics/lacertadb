/*
The MIT License (MIT)
Copyright (c) 2024 Matias Affolter
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
"use strict";
import JOYSON from "joyson";
import snappy from "snappyjs";
import * as triplesec from "triplesec";

triplesec.util.buffer_to_ui8a = function(b) {
    var i, ret, _i, _ref;
    ret = new Uint8Array(b.length);
    for (i = _i = 0, _ref = b.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        ret[i] = b.readUInt8(i);
    }
    return ret;
};

triplesec.util.ui8a_to_buffer = function(v) {
    var i, ret, _i, _ref;
    ret = triplesec.Buffer.alloc(v.length);
    for (i = _i = 0, _ref = v.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        ret.writeUInt8(v[i], i);
    }
    return ret;
};

class IndexedDBUtility {
    /**
     * Open or create a new IndexedDB database.
     * @param {string} dbName - The name of the database.
     * @param {number} version - The version of the database.
     * @param {function} upgradeCallback - Callback function for handling upgrades.
     * @returns {Promise<IDBDatabase>} - Resolves with the opened database.
     */
    static openDatabase(dbName, version = null, upgradeCallback = null) {
        return new Promise((resolve, reject) => {
            let request;

            if (version) {
                request = indexedDB.open(dbName, version);
            } else {
                request = indexedDB.open(dbName);
            }

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion;
                console.log(`Upgrading database "${dbName}" from version ${oldVersion} to ${newVersion}`);

                // Execute the upgrade callback, allowing creation or modification of object stores
                if (upgradeCallback) {
                    upgradeCallback(db, oldVersion, newVersion);
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;

                // Handle the database close event
                db.onclose = () => {
                    console.log(`Database "${dbName}" connection is closing.`);
                };

                // Resolve with the opened database instance
                resolve(db);
            };

            request.onerror = (event) => {
                // Reject if an error occurs while opening the database
                reject(new Error(`Failed to open database "${dbName}": ${event.target.error.message}`));
            };
        });
    }


    /**
     * Perform a transaction on the specified object store with retries.
     * @param {IDBDatabase} db - The IndexedDB instance.
     * @param {string|string[]} storeNames - List of store names or a single store name.
     * @param {string} mode - Transaction mode ("readonly", "readwrite").
     * @param {function} callback - Callback function to perform the transaction.
     * @param {number} retries - Number of retry attempts in case of failure.
     * @returns {Promise<any>} - Resolves with the result of the transaction.
     */
    static async performTransaction(db, storeNames, mode, callback, retries = 3) {
        try {
            if (!db) {
                throw new Error('Database connection is not available.');
            }
            const tx = db.transaction(Array.isArray(storeNames) ? storeNames : [storeNames], mode);
            const stores = Array.isArray(storeNames) ? storeNames.map(name => tx.objectStore(name)) : [tx.objectStore(storeNames)];
            const result = await callback(...stores);

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(new Error(`Transaction failed: ${tx.error ? tx.error.message : 'unknown error'}`));
            });
        } catch (error) {
            if (retries > 0) {
                console.warn(`Transaction failed, retrying... (${retries} attempts left): ${error.message}`);
                return this.performTransaction(db, storeNames, mode, callback, retries - 1);
            } else {
                throw new Error(`Transaction ultimately failed after retries: ${error.message}`);
            }
        }
    }


    /**
     * Add or update a record in a store.
     * @param {IDBObjectStore} store - The object store to add or update the record in.
     * @param {any} record - The record to be added or updated.
     * @returns {Promise<void>} - Resolves when the record is added or updated.
     */
    static add(store, record) {
        return new Promise((resolve, reject) => {
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = event => reject(`Failed to add record: ${event.target.error.message}`);
        });
    }

    /**
     * Delete a record by its key from a store.
     * @param {IDBObjectStore} store - The object store to delete the record from.
     * @param {any} key - The key of the record to delete.
     * @returns {Promise<void>} - Resolves when the record is deleted.
     */
    static delete(store, key) {
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = event => reject(`Failed to delete record: ${event.target.error.message}`);
        });
    }

    /**
     * Get a record by its key from a store.
     * @param {IDBObjectStore} store - The object store to get the record from.
     * @param {any} key - The key of the record to retrieve.
     * @returns {Promise<any>} - Resolves with the record if found.
     */
    static get(store, key) {
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Failed to retrieve record with key ${key}: ${event.target.error.message}`);
        });
    }

    /**
     * Get all records from a store.
     * @param {IDBObjectStore} store - The object store to query.
     * @returns {Promise<any[]>} - Resolves with an array of all records.
     */
    static getAll(store) {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Failed to retrieve records: ${event.target.error.message}`);
        });
    }

    /**
     * Count the number of records in a store.
     * @param {IDBObjectStore} store - The object store to count records.
     * @returns {Promise<number>} - Resolves with the number of records.
     */
    static count(store) {
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(`Failed to count records: ${event.target.error.message}`);
        });
    }

    /**
     * Clear all records from a store.
     * @param {IDBObjectStore} store - The object store to clear.
     * @returns {Promise<void>} - Resolves when the store is cleared.
     */
    static clear(store) {
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = event => reject(`Failed to clear store: ${event.target.error.message}`);
        });
    }

    /**
     * Delete an IndexedDB database.
     * @param {string} dbName - The name of the database to delete.
     * @returns {Promise<void>} - Resolves when the database is deleted.
     */
    static deleteDatabase(dbName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = event => reject(`Failed to delete database: ${event.target.error.message}`);
        });
    }

    /**
     * Open a cursor to iterate over records in a store.
     * @param {IDBObjectStore} store - The object store to open a cursor on.
     * @param {function} processCallback - Callback to process each record.
     * @returns {Promise<void>} - Resolves when the iteration is complete.
     */
    static iterateCursor(store, processCallback) {
        return new Promise((resolve, reject) => {
            const request = store.openCursor();
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    processCallback(cursor.value, cursor.key);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = event => reject(`Cursor iteration failed: ${event.target.error.message}`);
        });
    }
}

class LocalStorageUtility {
    /**
     * Get an item from localStorage.
     * @param {string} key - The key to retrieve.
     * @returns {any} - The parsed value from localStorage.
     */
    static getItem(key) {
        const value = localStorage.getItem(key) || "";
        return value ? JOYSON.parse(value) : null;
    }

    /**
     * Set an item in localStorage.
     * @param {string} key - The key to set.
     * @param {any} value - The value to store.
     */
    static setItem(key, value) {
        localStorage.setItem(key, JOYSON.stringify(value));
    }

    /**
     * Remove an item from localStorage.
     * @param {string} key - The key to remove.
     */
    static removeItem(key) {
        localStorage.removeItem(key);
    }

    /**
     * Clear all items from localStorage.
     */
    static clear() {
        localStorage.clear();
    }
}

class Document {
    constructor(data, encryptionKey = null) {
        this._id = data._id || this._generateId();
        this._created = data._created || Date.now();
        this._permanent = data._permanent || false;
        this._encrypted = data._encrypted || (encryptionKey ? true : false);
        this._compressed = data._compressed || false;  // Compression flag inside data

        // Check if packedData or raw data is provided
        if (data.packedData) {
            // If packedData is provided, preserve the original _modified field
            this.packedData = data.packedData;
            this._modified = data._modified || Date.now();  // Keep the original modified timestamp if available
            this.data = null; // Unpacked data will be available after unpack
        } else {
            // If raw data is provided, use it directly
            this.data = data.data || {};
            this._modified = Date.now();  // Set _modified to now for new/modified data
            this.packedData = new Uint8Array(0);  // Packed data is empty initially
        }

        this.encryptionKey = encryptionKey || "";
    }

    /**
     * Check if a document is encrypted.
     * @param {object} documentData - The document data to check.
     * @returns {boolean} - True if the document is encrypted, false otherwise.
     */
    static isEncrypted(documentData) {
        return documentData._encrypted && documentData.packedData;
    }

    /**
     * Unpack and decrypt an encrypted document.
     * @param {object} documentData - The encrypted document data.
     * @param {string} encryptionKey - The key to decrypt the document.
     * @returns {Promise<object>} - Returns the decrypted document.
     */
    static async decryptDocument(documentData, encryptionKey) {
        if (!Document.isEncrypted(documentData)) {
            throw new Error('Document is not encrypted.');
        }
        const decryptedData = await new Promise(function (resolve, reject){
            triplesec.decrypt({
                key: triplesec.Buffer.from(encryptionKey),
                data: triplesec.util.ui8a_to_buffer(documentData.packedData)
            }, function (err, res){
                if(!err){
                    resolve(triplesec.util.buffer_to_ui8a(res));
                }else {
                    reject(err);
                }
            });
        });
        // Unpack the decrypted data
        const unpackedData = JOYSON.unpack(decryptedData);
        return {
            _id: documentData._id,
            _created: documentData._created,
            _modified: documentData._modified,
            _encrypted: true,
            _compressed: documentData._compressed,
            data: unpackedData
        };
    }

    /**
     * Pack the document data using JOYSON, optionally encrypt and compress.
     * @returns {Promise<Uint8Array>} - Packed data ready for storage.
     */
    async pack() {
        if (!this.data) {
            throw new Error('No data to pack');
        }

        let packedData = JOYSON.pack(this.data);  // Pack the raw data
        if (this._compressed) {
            packedData = await this._compressData(packedData);
        }
        if (this._encrypted) {
            packedData = await this._encryptData(packedData);
        }
        this.packedData = packedData;  // Store the packed data
        return packedData;
    }

    /**
     * Unpack the document data, decrypt and decompress if required.
     * @returns {Promise<void>} - Resolves when the data is unpacked.
     */
    async unpack() {
        // Only unpack if there's packedData and data is still null
        if (!this.data && this.packedData.length > 0) {
            let unpackedData = this.packedData;
            if (this._encrypted) {
                unpackedData = await this._decryptData(unpackedData);
            }
            if (this._compressed) {
                unpackedData = await this._decompressData(unpackedData);
            }
            this.data = JOYSON.unpack(unpackedData);  // Store the unpacked data
        }
        return this.data;
    }

    // Private methods for encryption, decryption, compression, decompression.

    async _encryptData(data) {

        const encryptionKey = this.encryptionKey;
        const result = new Promise(function (resolve, reject){
            triplesec.encrypt({
                key: triplesec.Buffer.from(encryptionKey),
                data: triplesec.util.ui8a_to_buffer(data)
            }, function (err, res){
                if(!err){
                    resolve(triplesec.util.buffer_to_ui8a(res));
                }else {
                    reject(err);
                }
            });
        });

        return await result;
    }

    async _decryptData(data) {
        const encryptionKey = this.encryptionKey;
        const result = new Promise(function (resolve, reject){
            triplesec.decrypt({
                key: triplesec.Buffer.from(encryptionKey),
                data: triplesec.util.ui8a_to_buffer(data)
            }, function (err, res){
                if(!err){
                    resolve(triplesec.util.buffer_to_ui8a(res));
                }else {
                    reject(err);
                }
            });
        });

        return await result;
    }

    async _compressData(data) {
        return snappy.compress(data);
    }

    async _decompressData(data) {
        return snappy.uncompress(data);
    }

    _generateId() {
        return 'xxxx-xxxx-xxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16));
    }

    /**
     * Return the document in a format for general object use (readable format).
     * @returns {Promise<object>} - Unpacked document data.
     */
    async objectOutput() {
        if (!this.data) {
            await this.unpack();  // Ensure data is unpacked before returning
        }
        return {
            _id: this._id,
            _created: this._created,
            _modified: this._modified,
            _permanent: this._permanent,
            _encrypted: this._encrypted,
            _compressed: this._compressed,
            data: this.data
        };
    }

    /**
     * Return the document in a format for storage in the database (packed format).
     * @returns {Promise<object>} - Packed document data.
     */
    async databaseOutput() {
        if (!this.packedData || this.packedData.length === 0) {
            await this.pack();  // Ensure the data is packed before returning
        }
        return {
            _id: this._id,
            _created: this._created,
            _modified: this._modified,  // Keep original _modified if packedData was used
            _permanent: this._permanent,
            _compressed: this._compressed,
            _encrypted: this._encrypted,
            packedData: this.packedData  // Packed and ready for storage
        };
    }
}

class Settings {
    constructor(dbName) {
        this.dbName = dbName;
        this.settingsKey = `db_${this.dbName}_settings`;
        this.settings = this._loadSettings();
    }

    _loadSettings() {
        const settings = LocalStorageUtility.getItem(this.settingsKey);
        return settings ? JOYSON.parse(settings) : {};
    }

    _saveSettings() {
        LocalStorageUtility.setItem(this.settingsKey, JOYSON.stringify(this.settings));
    }

    get(key) {
        return this.settings[key];
    }

    set(key, value) {
        this.settings[key] = value;
        this._saveSettings();
    }

    remove(key) {
        delete this.settings[key];
        this._saveSettings();
    }

    clear() {
        this.settings = {};
        this._saveSettings();
    }
}

class Database {
    constructor(dbName) {
        this.dbName = dbName;
        this.db = null; // IDBDatabase instance
        this.collections = new Map(); // collectionName -> Collection instance
        this.metadata = {
            name: dbName,
            collections: {}, // collectionName -> collection metadata
            totalSizeKB: 0,
            modified: Date.now(),
        };
        this.settings = new Settings(dbName);
    }

    async init() {
        // Load metadata from localStorage
        this._loadMetadata();

        // Open the database
        this.db = await IndexedDBUtility.openDatabase(this.dbName, undefined, (db, oldVersion, newVersion) => {
            this._upgradeDatabase(db, oldVersion, newVersion);
        });

        // Initialize collections
        for (const collectionName in this.metadata.collections) {
            const collection = new Collection(this, collectionName);
            await collection.init();
            this.collections.set(collectionName, collection);
        }
    }

    _loadMetadata() {
        // Load metadata from localStorage
        const metadata = LocalStorageUtility.getItem(`db_${this.dbName}_metadata`);
        if (metadata) {
            this.metadata = metadata;
        } else {
            console.log('No metadata found, initializing new metadata');
            // Save the initial metadata
            this._saveMetadata();
        }
    }

    _saveMetadata() {
        // Save metadata to localStorage
        LocalStorageUtility.setItem(`db_${this.dbName}_metadata`, this.metadata);
    }

    _createDataStores(db) {
        for (const collectionName of this.collections.keys()) {
            this._createDataStore(db, collectionName);
        }
    }

    _createDataStore(db, collectionName) {
        if (!db.objectStoreNames.contains(collectionName)) {
            db.createObjectStore(collectionName, { keyPath: '_id' });
        }
    }

    _upgradeDatabase(db, oldVersion, newVersion) {
        console.log(`Upgrading database "${this.dbName}" from version ${oldVersion} to ${newVersion}`);
        // Create object stores for collections if they don't exist
        this._createDataStores(db);
    }

    async createCollection(collectionName) {
        if (this.collections.has(collectionName)) {
            console.log(`Collection "${collectionName}" already exists.`);
            return this.collections.get(collectionName);
        }
        // Create object store for the collection
        if (!this.db.objectStoreNames.contains(collectionName)) {
            const newVersion = this.db.version + 1;
            this.db.close();
            this.db = await IndexedDBUtility.openDatabase(this.dbName, newVersion, (db, oldVersion, newVersion) => {
                this._createDataStore(db, collectionName);
            });
        }
        // Create a new Collection instance
        const collection = new Collection(this, collectionName);
        await collection.init();
        this.collections.set(collectionName, collection);
        // Update metadata
        this.metadata.collections[collectionName] = collection.metadata;
        this._saveMetadata();
        return collection;
    }

    async deleteCollection(collectionName) {
        if (!this.collections.has(collectionName)) {
            throw new Error(`Collection "${collectionName}" does not exist.`);
        }
        // Delete all documents in the collection
        await IndexedDBUtility.performTransaction(this.db, collectionName, 'readwrite', (store) => {
            return IndexedDBUtility.clear(store);
        });
        // Remove the collection
        this.collections.delete(collectionName);
        // Update metadata
        delete this.metadata.collections[collectionName];
        this._saveMetadata();
    }

    async getCollection(collectionName) {
        if (this.collections.has(collectionName)) {
            return this.collections.get(collectionName);
        } else {
            // Check if the collection exists in the database
            if (this.db.objectStoreNames.contains(collectionName)) {
                // Create a new Collection instance
                const collection = new Collection(this, collectionName);
                await collection.init();
                this.collections.set(collectionName, collection);
                return collection;
            } else {
                throw new Error(`Collection "${collectionName}" does not exist.`);
            }
        }
    }

    async close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async deleteDatabase() {
        await this.close();
        await IndexedDBUtility.deleteDatabase(this.dbName);
        // Remove metadata from localStorage
        LocalStorageUtility.removeItem(`db_${this.dbName}_metadata`);
        // Remove settings from localStorage
        this.settings.clear();
    }
}

class Collection {
    constructor(database, collectionName) {
        this.database = database; // Reference to the parent Database instance
        this.collectionName = collectionName;
        this.metadata = {
            name: collectionName,
            sizeKB: 0,
            length: 0,
            created: Date.now(),
            modified: Date.now(),
            documents: {}, // Stores document sizes
        };
    }

    async init() {
        // Load collection metadata from database metadata
        if (this.database.metadata.collections[this.collectionName]) {
            this.metadata = this.database.metadata.collections[this.collectionName];
        } else {
            // Collection metadata not found, initialize new
            this.database.metadata.collections[this.collectionName] = this.metadata;
            this.database._saveMetadata();
        }
    }

    async addDocument(documentData, encryptionKey = null) {
        const document = new Document(documentData, encryptionKey);
        const docData = await document.databaseOutput();
        await IndexedDBUtility.performTransaction(this.database.db, this.collectionName, 'readwrite', (store) => {
            return IndexedDBUtility.add(store, docData);
        });

        const docSizeKB = docData.packedData.byteLength / 1024;

        // Update metadata
        if (!this.metadata.documents[docData._id]) {
            this.metadata.length += 1;
            this.metadata.sizeKB += docSizeKB;
            this.metadata.modified = Date.now();
            this.metadata.documents[docData._id] = docSizeKB; // Store size in KB
        } else {
            const previousDocSizeKB = this.metadata.documents[docData._id];
            this.metadata.sizeKB += docSizeKB - previousDocSizeKB;
            this.metadata.modified = Date.now();
            this.metadata.documents[docData._id] = docSizeKB; // Update size in KB
        }

        // Update database metadata
        this.database.metadata.collections[this.collectionName] = this.metadata;
        this.database.metadata.totalSizeKB = Object.values(this.database.metadata.collections).reduce((v, o) => v + o.sizeKB, 0);
        this.database.metadata.modified = Date.now();
        this.database._saveMetadata();
    }

    async deleteDocument(docId) {
        // Get the document size before deleting
        const docSizeKB = this.metadata.documents[docId] || 0;

        if (!docSizeKB) {
            return false;
        }
        await IndexedDBUtility.performTransaction(this.database.db, this.collectionName, 'readwrite', (store) => {
            return IndexedDBUtility.delete(store, docId);
        });

        // Update metadata
        this.metadata.length -= 1;
        this.metadata.sizeKB -= docSizeKB;
        this.metadata.modified = Date.now();
        delete this.metadata.documents[docId];

        // Update database metadata
        this.database.metadata.collections[this.collectionName] = this.metadata;
        this.database.metadata.totalSizeKB = Object.values(this.database.metadata.collections).reduce((v, o) => v + o.sizeKB, 0);
        this.database.metadata.modified = Date.now();
        this.database._saveMetadata();
        return true;
    }

    async getDocument(docId, encryptionKey = null) {
        const docData = await IndexedDBUtility.performTransaction(this.database.db, this.collectionName, 'readonly', (store) => {
            return IndexedDBUtility.get(store, docId);
        });
        if (docData) {
            if (Document.isEncrypted(docData)) {
                if (encryptionKey) {
                    return new Document(docData, encryptionKey).objectOutput();
                } else {
                    return new Document(docData).databaseOutput();
                }
            } else {
                return new Document(docData).objectOutput();
            }
        } else {
            return null;
        }
    }

    async query(filter = {}) {
        const results = [];
        await IndexedDBUtility.performTransaction(this.database.db, this.collectionName, 'readonly', async (store) => {
            await IndexedDBUtility.iterateCursor(store, async (docData) => {
                const document = new Document(docData);
                const object = await document.objectOutput();
                let match = true;
                for (const key in filter) {
                    if (object.data[key] !== filter[key]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    results.push(object);
                }
            });
        });
        return results;
    }
}


var LacertaDB = {
    Collection,
    Database,
    Document
};

module.exports = {LacertaDB: LacertaDB}


