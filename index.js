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
     * Add (insert) a new record into the store. Fails if the record already exists.
     * @param {IDBObjectStore} store - The object store to insert the record into.
     * @param {any} record - The record to be inserted.
     * @returns {Promise<void>} - Resolves when the record is inserted.
     */
    static add(store, record) {
        return new Promise((resolve, reject) => {
            const request = store.add(record);
            request.onsuccess = () => resolve();
            request.onerror = event => reject(`Failed to insert record: ${event.target.error.message}`);
        });
    }

    /**
     * Put (insert or update) a record into the store.
     * @param {IDBObjectStore} store - The object store to put the record into.
     * @param {any} record - The record to be put.
     * @returns {Promise<void>} - Resolves when the record is put.
     */
    static put(store, record) {
        return new Promise((resolve, reject) => {
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = event => reject(`Failed to put record: ${event.target.error.message}`);
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
        const value = localStorage.getItem(key);
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

class DatabaseMetadata {
    constructor(dbName) {
        this._dbName = dbName;
        this._metadataKey = `db_${this._dbName}_metadata`;
        this._metadata = this._loadMetadata();
        this._collections = new Map(); // Map of collectionName -> CollectionMetadata
    }

    _loadMetadata() {
        const metadata = LocalStorageUtility.getItem(this._metadataKey);
        if (metadata) {
            // Recreate CollectionMetadata instances
            for (const collectionName in metadata.collections) {
                const collectionData = metadata.collections[collectionName];
                const collectionMetadata = new CollectionMetadata(collectionName, this, collectionData);
                this._collections.set(collectionName, collectionMetadata);
            }
            this._metadata = metadata;
        } else {
            this._metadata = {
                name: this._dbName,
                collections: {}, // collectionName -> collection metadata data
                totalSizeKB: 0,
                totalLength: 0,
                modifiedAt: Date.now(),
            };
        }
        return this._metadata;
    }

    // Getter for name
    get name() {
        return this._metadata.name;
    }

    // Getter for totalSizeKB
    get totalSizeKB() {
        return this._metadata.totalSizeKB;
    }

    // Getter for totalLength
    get totalLength() {
        return this._metadata.totalLength;
    }

    // Getter for modifiedAt
    get modifiedAt() {
        return this._metadata.modifiedAt;
    }

    // Get or create CollectionMetadata
    getCollectionMetadata(collectionName) {
        if (!this._collections.has(collectionName)) {
            // Create new CollectionMetadata
            const collectionMetadata = new CollectionMetadata(collectionName, this);
            this._collections.set(collectionName, collectionMetadata);
            this._metadata.collections[collectionName] = collectionMetadata.getRawMetadata();
            this._metadata.modifiedAt = Date.now();
        }
        return this._collections.get(collectionName);
    }

    // Remove a collection's metadata
    removeCollectionMetadata(collectionName) {
        const collectionMetadata = this._collections.get(collectionName);
        if (collectionMetadata) {
            // Subtract collection's size and length from totals
            this._metadata.totalSizeKB -= collectionMetadata.sizeKB;
            this._metadata.totalLength -= collectionMetadata.length;
            // Remove the collection's metadata
            this._collections.delete(collectionName);
            delete this._metadata.collections[collectionName];
            // Update modifiedAt internally
            this._metadata.modifiedAt = Date.now();
        }
    }

    // Adjust totalSizeKB and totalLength (used by CollectionMetadata)
    adjustTotals(sizeKBChange, lengthChange) {
        this._metadata.totalSizeKB += sizeKBChange;
        this._metadata.totalLength += lengthChange;
        this._metadata.modifiedAt = Date.now();
    }

    // Get all collection names
    getCollectionNames() {
        return Array.from(this._collections.keys());
    }

    // Get raw metadata (for saving)
    getRawMetadata() {
        // Before returning, ensure that collections in _metadata are updated
        for (const [collectionName, collectionMetadata] of this._collections.entries()) {
            this._metadata.collections[collectionName] = collectionMetadata.getRawMetadata();
        }
        return this._metadata;
    }

    // Set raw metadata (e.g., after loading)
    setRawMetadata(metadata) {
        this._metadata = metadata;
        // Recreate CollectionMetadata instances
        this._collections.clear();
        for (const collectionName in metadata.collections) {
            const collectionData = metadata.collections[collectionName];
            const collectionMetadata = new CollectionMetadata(collectionName, this, collectionData);
            this._collections.set(collectionName, collectionMetadata);
        }
    }

    // Accessor methods for private properties (if needed)
    get dbName() {
        return this._dbName;
    }

    get metadataKey() {
        return this._metadataKey;
    }

    // Method to save metadata
    saveMetadata() {
        LocalStorageUtility.setItem(this._metadataKey, this.getRawMetadata());
    }
}

class CollectionMetadata {
    constructor(collectionName, databaseMetadata, existingMetadata = null) {
        this._collectionName = collectionName;
        this._databaseMetadata = databaseMetadata;

        if (existingMetadata) {
            this._metadata = existingMetadata;
        } else {
            this._metadata = {
                name: collectionName,
                sizeKB: 0,
                length: 0,
                createdAt: Date.now(),
                modifiedAt: Date.now(),
                documentSizes: {},     // Stores document sizes in KB
                documentModifiedAt: {},  // Stores document modification timestamps
                documentPermanent: {}, // Stores document permanent flags
            };
            // Update databaseMetadata
            this._databaseMetadata._metadata.collections[collectionName] = this._metadata;
            this._databaseMetadata._metadata.modifiedAt = Date.now();
        }
    }

    // Getter for collection name
    get collectionName() {
        return this._collectionName;
    }

    // Getter for sizeKB
    get sizeKB() {
        return this._metadata.sizeKB;
    }

    // Getter for length
    get length() {
        return this._metadata.length;
    }

    // Getter for modifiedAt
    get modifiedAt() {
        return this._metadata.modifiedAt;
    }

    // Methods to add, update, delete documents

    // Add or update a document
    updateDocument(docId, docSizeKB, isPermanent = false) {
        const isNewDocument = !(docId in this._metadata.documentSizes);
        const previousDocSizeKB = this._metadata.documentSizes[docId] || 0;
        const sizeKBChange = docSizeKB - previousDocSizeKB;
        const lengthChange = isNewDocument ? 1 : 0;

        // Update document metadata
        this._metadata.documentSizes[docId] = docSizeKB;
        this._metadata.documentModifiedAt[docId] = Date.now();
        this._metadata.documentPermanent[docId] = isPermanent;

        // Update collection metadata
        this._metadata.sizeKB += sizeKBChange;
        this._metadata.length += lengthChange;
        this._metadata.modifiedAt = Date.now();

        // Update database totals
        this._databaseMetadata.adjustTotals(sizeKBChange, lengthChange);
    }

    // Delete a document
    deleteDocument(docId) {
        if (!(docId in this._metadata.documentSizes)) {
            return false;
        }

        const docSizeKB = this._metadata.documentSizes[docId];
        const sizeKBChange = -docSizeKB;
        const lengthChange = -1;

        // Remove document metadata
        delete this._metadata.documentSizes[docId];
        delete this._metadata.documentModifiedAt[docId];
        delete this._metadata.documentPermanent[docId];

        // Update collection metadata
        this._metadata.sizeKB += sizeKBChange;
        this._metadata.length += lengthChange;
        this._metadata.modifiedAt = Date.now();

        // Update database totals
        this._databaseMetadata.adjustTotals(sizeKBChange, lengthChange);

        return true;
    }

    // Batch update documents
    updateDocuments(updates) {
        // updates is an array of { docId, docSizeKB, isPermanent }
        for (const { docId, docSizeKB, isPermanent } of updates) {
            this.updateDocument(docId, docSizeKB, isPermanent);
        }
    }

    // Batch delete documents
    deleteDocuments(docIds) {
        for (const docId of docIds) {
            this.deleteDocument(docId);
        }
    }

    // Get raw metadata (for saving)
    getRawMetadata() {
        return this._metadata;
    }

    // Set raw metadata (e.g., after loading)
    setRawMetadata(metadata) {
        this._metadata = metadata;
    }
}

class Database {
    constructor(dbName) {
        this._dbName = dbName;
        this._db = null; // IDBDatabase instance
        this._collections = new Map(); // collectionName -> Collection instance
        this._metadata = new DatabaseMetadata(dbName);
        this._settings = new Settings(dbName);
    }

    async init() {
        // Open the database
        this._db = await IndexedDBUtility.openDatabase(this._dbName, undefined, (db, oldVersion, newVersion) => {
            this._upgradeDatabase(db, oldVersion, newVersion);
        });

        // Initialize collections
        const collectionNames = this._metadata.getCollectionNames();
        for (const collectionName of collectionNames) {
            const collection = new Collection(this, collectionName);
            await collection.init();
            this._collections.set(collectionName, collection);
        }
    }

    _createDataStores(db) {
        for (const collectionName of this._collections.keys()) {
            this._createDataStore(db, collectionName);
        }
    }

    _createDataStore(db, collectionName) {
        if (!db.objectStoreNames.contains(collectionName)) {
            db.createObjectStore(collectionName, { keyPath: '_id' });
        }
    }

    _upgradeDatabase(db, oldVersion, newVersion) {
        console.log(`Upgrading database "${this._dbName}" from version ${oldVersion} to ${newVersion}`);
        // Create object stores for collections if they don't exist
        this._createDataStores(db);
    }

    async createCollection(collectionName, settings = {}) {
        if (this._collections.has(collectionName)) {
            console.log(`Collection "${collectionName}" already exists.`);
            return this._collections.get(collectionName);
        }
        // Create object store for the collection
        if (!this._db.objectStoreNames.contains(collectionName)) {
            const newVersion = this._db.version + 1;
            this._db.close();
            this._db = await IndexedDBUtility.openDatabase(this._dbName, newVersion, (db, oldVersion, newVersion) => {
                this._createDataStore(db, collectionName);
            });
        }
        // Create a new Collection instance
        const collection = new Collection(this, collectionName, settings);
        await collection.init();
        this._collections.set(collectionName, collection);

        // Ensure the CollectionMetadata exists
        this._metadata.getCollectionMetadata(collectionName);

        // Save metadata
        this._metadata.saveMetadata();

        return collection;
    }

    async deleteCollection(collectionName) {
        if (!this._collections.has(collectionName)) {
            throw new Error(`Collection "${collectionName}" does not exist.`);
        }
        // Delete all documents in the collection
        await IndexedDBUtility.performTransaction(this._db, collectionName, 'readwrite', (store) => {
            return IndexedDBUtility.clear(store);
        });
        // Remove the collection
        this._collections.delete(collectionName);

        // Remove collection metadata
        this._metadata.removeCollectionMetadata(collectionName);

        // Save metadata
        this._metadata.saveMetadata();
    }

    async getCollection(collectionName) {
        if (this._collections.has(collectionName)) {
            return this._collections.get(collectionName);
        } else {
            // Check if the collection exists in the database
            if (this._db.objectStoreNames.contains(collectionName)) {
                // Create a new Collection instance
                const collection = new Collection(this, collectionName);
                await collection.init();
                this._collections.set(collectionName, collection);
                return collection;
            } else {
                throw new Error(`Collection "${collectionName}" does not exist.`);
            }
        }
    }

    async close() {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }

    async deleteDatabase() {
        await this.close();
        await IndexedDBUtility.deleteDatabase(this._dbName);
        // Remove metadata and settings
        this._metadata = null;
        this._settings.clear();
        LocalStorageUtility.removeItem(this._metadata.metadataKey);
    }

    // Accessor methods for private properties
    get name() {
        return this._dbName;
    }

    get db() {
        return this._db;
    }

    get collections() {
        return Array.from(this._collections.values());
    }

    get metadata() {
        return this._metadata;
    }

    get totalSizeKB() {
        return this._metadata.totalSizeKB;
    }

    get totalLength() {
        return this._metadata.totalLength;
    }

    get modifiedAt() {
        return this._metadata.modifiedAt;
    }

    get settings() {
        return this._settings;
    }
}

class Document {
    constructor(data, encryptionKey = null) {
        this._id = data._id || this._generateId();
        this._created = data._created || Date.now();
        this._permanent = data._permanent || false;
        this._encrypted = data._encrypted || (encryptionKey ? true : false);
        this._compressed = data._compressed || false;

        if (data.packedData) {
            this._packedData = data.packedData;
            this._modified = data._modified || Date.now();
            this._data = null;
        } else {
            this._data = data.data || {};
            this._modified = Date.now();
            this._packedData = new Uint8Array(0);
        }

        this._encryptionKey = encryptionKey || "";
    }

    get data() {
        return this._data;
    }

    get packedData() {
        return this._packedData;
    }

    get encryptionKey() {
        return this._encryptionKey;
    }

    set data(d) {
        this._data = d;
    }

    set packedData(d) {
        this._packedData = d;
    }

    set encryptionKey(d) {
        this._encryptionKey = d;
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
    constructor(dbName, newSettings = {}) {
        this._dbName = dbName;
        this._settingsKey = `db_${this._dbName}_settings`;
        this._settings = this._loadSettings();
        this._mergeSettings(newSettings);
    }

    _loadSettings() {
        const settings = LocalStorageUtility.getItem(this._settingsKey);
        return settings ? settings : {};
    }

    _saveSettings() {
        LocalStorageUtility.setItem(this._settingsKey, this._settings);
    }

    _mergeSettings(newSettings) {
        this._settings = { ...this._settings, ...newSettings };
        this._saveSettings();
    }

    get(key) {
        return this._settings[key];
    }

    set(key, value) {
        this._settings[key] = value;
        this._saveSettings();
    }

    remove(key) {
        delete this._settings[key];
        this._saveSettings();
    }

    clear() {
        this._settings = {};
        this._saveSettings();
    }

    // Accessor methods for private properties (if needed)
    get dbName() {
        return this._dbName;
    }

    get settings() {
        return this._settings;
    }
}

class Collection {
    constructor(database, collectionName, settings = {}) {
        this._database = database; // Reference to the parent Database instance
        this._collectionName = collectionName;
        this._settings = settings;
        this._metadata = null;
    }

    async init() {
        // Set default settings if not provided
        this._settings.sizeLimitKB = this._settings.sizeLimitKB || Infinity;
        this._settings.bufferLimitKB = this._settings.bufferLimitKB || 4096;

        // Load collection metadata from database metadata
        this._metadata = this._database.metadata.getCollectionMetadata(this._collectionName);
    }

    // Accessor methods for private properties

    get name() {
        return this._collectionName;
    }

    get settings() {
        return this._settings;
    }

    get database() {
        return this._database;
    }

    get metadata() {
        return this._metadata;
    }

    get totalSizeKB() {
        return this._metadata.totalSizeKB;
    }

    get totalLength() {
        return this._metadata.totalLength;
    }

    get modifiedAt() {
        return this._metadata.modifiedAt;
    }


    async addDocument(documentData, encryptionKey = null) {
        const document = new Document(documentData, encryptionKey);
        const docData = await document.databaseOutput();
        const docId = docData._id;
        const isPermanent = docData._permanent || false;
        let isNewDocument = !(docId in this._metadata._metadata.documentSizes);

        try {
            if (isNewDocument) {
                // Use insert (add), will fail if record exists
                await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readwrite', (store) => {
                    return IndexedDBUtility.add(store, docData);
                });
            } else {
                // Use put (update) for existing documents
                await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readwrite', (store) => {
                    return IndexedDBUtility.put(store, docData);
                });
            }
        } catch (error) {
            if (isNewDocument && error.includes('Failed to insert record:')) {
                // Record already exists, so we update it
                await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readwrite', (store) => {
                    return IndexedDBUtility.put(store, docData);
                });
                isNewDocument = false;
            } else {
                throw error;
            }
        }

        const docSizeKB = docData.packedData.byteLength / 1024;

        // Update collection metadata
        this._metadata.updateDocument(docId, docSizeKB, isPermanent);

        // Save metadata
        this._database.metadata.saveMetadata();

        return isNewDocument;
    }

    async getDocument(docId, encryptionKey = null) {
        // Check if the document exists in metadata
        if (!(docId in this._metadata._metadata.documentSizes)) {
            return false;
        }

        const docData = await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readonly', (store) => {
            return IndexedDBUtility.get(store, docId);
        });

        if (docData) {
            let document;
            if (Document.isEncrypted(docData)) {
                if (encryptionKey) {
                    document = new Document(docData, encryptionKey);
                } else {
                    // Cannot decrypt without key
                    return false;
                }
            } else {
                document = new Document(docData);
            }
            return await document.objectOutput();
        } else {
            // Should not happen since metadata indicates the document exists
            return false;
        }
    }

    async getDocuments(ids, encryptionKey = null) {
        const results = [];
        // Filter IDs to those that exist in metadata
        const existingIds = ids.filter(id => id in this._metadata._metadata.documentSizes);

        if (existingIds.length === 0) {
            return results; // Return empty array if no documents exist
        }

        await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readonly', async (store) => {
            const getPromises = existingIds.map(id => {
                return IndexedDBUtility.get(store, id);
            });

            const docsData = await Promise.all(getPromises);

            for (const docData of docsData) {
                if (docData) {
                    let document;
                    if (Document.isEncrypted(docData)) {
                        if (encryptionKey) {
                            document = new Document(docData, encryptionKey);
                        } else {
                            // Skip encrypted documents if no key is provided
                            continue;
                        }
                    } else {
                        document = new Document(docData);
                    }
                    const object = await document.objectOutput();
                    results.push(object);
                }
            }
        });

        return results;
    }

    async deleteDocument(docId, force = false) {
        const isPermanent = this._metadata._metadata.documentPermanent[docId] || false;
        if (isPermanent && !force) {
            return false;
        }

        const docExists = docId in this._metadata._metadata.documentSizes;

        if (!docExists) {
            return false;
        }

        await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readwrite', (store) => {
            return IndexedDBUtility.delete(store, docId);
        });

        // Update metadata
        this._metadata.deleteDocument(docId);

        // Save metadata
        this._database.metadata.saveMetadata();

        return true;
    }

    async deleteDocuments(docIds, force = false) {
        // Filter out IDs that don't exist or are _permanent (if force is false)
        const existingDocIds = docIds.filter(docId => {
            const exists = docId in this._metadata._metadata.documentSizes;
            const isPermanent = this._metadata._metadata.documentPermanent[docId] || false;
            return exists && (force || !isPermanent);
        });

        if (existingDocIds.length === 0) {
            return 0; // No documents to delete
        }

        // Get total space to free
        const totalSpaceToFree = existingDocIds.reduce((acc, docId) => acc + this._metadata._metadata.documentSizes[docId], 0);

        // Perform deletion in a single transaction
        await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readwrite', async (store) => {
            for (const docId of existingDocIds) {
                store.delete(docId);
            }
        });

        // Update metadata
        this._metadata.deleteDocuments(existingDocIds);

        // Save metadata
        this._database.metadata.saveMetadata();

        return totalSpaceToFree;
    }

    async freeSpace(size) {
        let spaceToFree;
        if (size >= 0) {
            // Positive size indicates maximum total size to keep
            const currentSize = this._metadata.sizeKB;
            if (currentSize <= size) {
                // No need to free space
                return 0;
            } else {
                spaceToFree = currentSize - size;
            }
        } else {
            // Negative size indicates the amount of space in KB to free
            spaceToFree = -size;
        }

        // Sort documents by modified time (oldest first), excluding _permanent documents
        const docEntries = Object.entries(this._metadata._metadata.documentModifiedAt)
            .filter(([docId]) => !this._metadata._metadata.documentPermanent[docId])
            .sort((a, b) => a[1] - b[1]); // Ascending order of modified timestamp

        let totalFreed = 0;
        const docsToDelete = [];

        for (const [docId] of docEntries) {
            const docSize = this._metadata._metadata.documentSizes[docId];
            totalFreed += docSize;
            docsToDelete.push(docId);
            if (totalFreed >= spaceToFree) {
                break;
            }
        }

        // Delete the documents using batch deletion
        const freedSpace = await this.deleteDocuments(docsToDelete);

        return freedSpace;
    }

    async query(filter = {}, encryptionKey = null) {
        const results = [];
        await IndexedDBUtility.performTransaction(this._database.db, this._collectionName, 'readonly', async (store) => {
            await IndexedDBUtility.iterateCursor(store, async (docData) => {
                let document;
                if (Document.isEncrypted(docData)) {
                    if (encryptionKey) {
                        document = new Document(docData, encryptionKey);
                    } else {
                        // Skip encrypted documents if no key is provided
                        return;
                    }
                } else {
                    document = new Document(docData);
                }

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


