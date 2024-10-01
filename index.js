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
import JOYSON from "joyson/dist/index.min.js";
import snappy from "snappyjs";
import * as triplesec from "triplesec/browser/triplesec.js";

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
            const request = indexedDB.open(dbName);  // Open without specifying a version initially

            request.onupgradeneeded = event => {
                const db = event.target.result;
                console.log(`Upgrading or initializing database: ${dbName}, version: ${event.newVersion}`);

                // Call the upgrade callback to create object stores if needed
                if (upgradeCallback) {
                    upgradeCallback(db, event.oldVersion, event.newVersion);
                }
            };

            request.onsuccess = event => {
                const db = event.target.result;
                if (version && version > db.version) {
                    // Close the current connection and reopen with the correct version
                    db.close();
                    const versionedRequest = indexedDB.open(dbName, version);  // Reopen with the specified version

                    versionedRequest.onupgradeneeded = event => {
                        const db = event.target.result;
                        console.log(`Upgrading database to version ${version}`);
                        if (upgradeCallback) {
                            upgradeCallback(db, event.oldVersion, event.newVersion);
                        }
                    };

                    versionedRequest.onsuccess = event => resolve(event.target.result);
                    versionedRequest.onerror = event => reject(`Failed to open database: ${event.target.error.message}`);
                } else {
                    // If no version update is needed, resolve the database
                    resolve(db);
                }
            };

            request.onerror = event => {
                reject(`Failed to open database: ${event.target.error.message}`);
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
            const tx = db.transaction(Array.isArray(storeNames) ? storeNames : [storeNames], mode);
            const stores = Array.isArray(storeNames) ? storeNames.map(name => tx.objectStore(name)) : [tx.objectStore(storeNames)];
            const result = await callback(...stores);

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(new Error(`Transaction failed: ${tx.error ? tx.error.message : 'unknown error'}`));
            });
        } catch (error) {
            if (retries > 0) {
                console.warn(`Transaction failed, retrying... (${retries} attempts left)`);
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

class PrivateDatabaseManager {
    constructor(syncInterval = 10000) {
        this._db = null;
        this._dbName = 'lacertadb-private';
        this._storeName = 'database-list';
        this._metadataCache = new Map();
        this._syncInterval = syncInterval;
        this._syncTimer = null;
        this._isDirty = false;
    }

    async init() {
        if(this._db === null) {
            try {
                this._db = await IndexedDBUtility.openDatabase(this._dbName, 1, (db) => {
                    if (!db.objectStoreNames.contains(this._storeName)) {
                        db.createObjectStore(this._storeName, { keyPath: 'name' });
                    }
                });

                console.log(`Database "${this._dbName}" initialized with version: ${this._db.version}`);
            } catch (error) {
                console.error(`Failed to initialize database: ${error}`);
                throw new Error("Database initialization failed.");
            }

            this._syncTimer = setInterval(() => this._syncCacheToDatabase(), this._syncInterval);
            return true;
        }

        return false;
    }

    /**
     * Delete the metadata of a specific database from the cache and IndexedDB store.
     * @param {string} dbName - The name of the database whose metadata needs to be deleted.
     * @returns {Promise<void>}
     */
    async deleteDatabaseMetadata(dbName) {
        try {
            if (this._metadataCache.has(dbName)) {
                this._metadataCache.delete(dbName);
            }

            await IndexedDBUtility.performTransaction(this._db, this._storeName, 'readwrite', (store) => {
                return IndexedDBUtility.delete(store, dbName);
            });

            console.log(`Metadata for database "${dbName}" deleted successfully.`);
        } catch (error) {
            console.error(`Failed to delete metadata for ${dbName}: ${error}`);
            throw new Error(`Metadata deletion failed: ${error.message}`);
        }
    }

    /**
     * Validate metadata to ensure it meets the required structure.
     * @param {Object} metadata - The metadata object to validate.
     * @returns {boolean} - True if valid, false otherwise.
     */
    _validateMetadata(metadata) {
        return (
            metadata &&
            typeof metadata.name === 'string' &&
            Array.isArray(metadata.collections) &&
            metadata.collections.every(collection =>
                typeof collection.name === 'string' &&
                typeof collection.sizeKB === 'number' &&
                typeof collection.length === 'number'
            )
        );
    }

    /**
     * Updates or adds metadata for a collection, ensuring no duplicates.
     * Collections are now stored in an object indexed by collection name.
     * @param {string} dbName - The database name.
     * @param {Object} newCollectionMetadata - The new metadata to update or add.
     */
    async updateDatabaseMetadata(dbName, newCollectionMetadata) {
        let dbMetadata = await this.getDatabaseMetadata(dbName);

        if (!this._validateMetadata(dbMetadata)) {
            dbMetadata = {
                name: dbName,
                collections: {}, // Use an object for collections instead of an array
                totalSizeKB: 0,
                modified: 0, // Timestamp of the last modification
            };
        }

        const collectionName = newCollectionMetadata.name;

        // Prevent adding the database name itself as a collection
        if (collectionName === dbName) {
            console.warn(`Attempted to add the database itself "${dbName}" as a collection. Ignored.`);
            return;
        }

        // If the collection exists, update it. Otherwise, add it.
        if (!dbMetadata.collections[collectionName]) {
            dbMetadata.collections[collectionName] = {
                ...newCollectionMetadata,
                modified: Date.now(), // Set modified timestamp
            };
        } else {
            dbMetadata.collections[collectionName] = {
                ...dbMetadata.collections[collectionName],
                ...newCollectionMetadata, // Merge with existing data
                modified: newCollectionMetadata.modified || dbMetadata.collections[collectionName].modified,
            };
        }

        // Recalculate totalSizeKB at the root level
        dbMetadata.totalSizeKB = Object.values(dbMetadata.collections)
            .reduce((acc, collection) => acc + collection.sizeKB, 0);

        // Update metadata in cache and mark as dirty
        this._metadataCache.set(dbName, dbMetadata);
        this._isDirty = true;
    }

    /**
     * Retrieve metadata for a given database.
     * @param {string} dbName - The name of the database to retrieve metadata for.
     * @returns {Promise<Object>} - Returns the metadata object.
     */
    async getDatabaseMetadata(dbName) {
        if (this._metadataCache.has(dbName)) {
            return this._metadataCache.get(dbName);
        }

        try {
            const metadata = await IndexedDBUtility.performTransaction(
                this._db,
                this._storeName,
                'readonly',
                (store) => IndexedDBUtility.get(store, dbName)
            );

            if (metadata) {
                this._metadataCache.set(dbName, metadata);
            }

            return metadata || { name: dbName, collections: {}, totalSizeKB: 0 }; // Return object instead of array for collections
        } catch (error) {
            console.error(`Error while retrieving metadata for ${dbName}:`, error);
            throw new Error(`Failed to retrieve metadata: ${error.message}`);
        }
    }

    /**
     * Sync the metadata cache to the database (if marked as dirty).
     * @private
     */
    async _syncCacheToDatabase() {
        if (!this._isDirty) return;

        try {
            for (let [dbName, metadata] of this._metadataCache.entries()) {
                await IndexedDBUtility.performTransaction(this._db, this._storeName, 'readwrite', (store) => {
                    return IndexedDBUtility.add(store, metadata);
                });
            }
            this._isDirty = false;
        } catch (error) {
            console.error('Failed to sync metadata cache to the database:', error);
        }
    }

    async close() {
        if (this._syncTimer) {
            clearInterval(this._syncTimer);
            this._syncTimer = null;
        }

        await this._syncCacheToDatabase();

        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }

    async destroy() {
        await this.close();
        this._metadataCache.clear();
        await IndexedDBUtility.deleteDatabase(this._dbName);
        console.log('Metadata database deleted successfully.');
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
        console.log(decryptedData)
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

class Collection {
    constructor(db, name, privateDbManager) {
        this._db = db;  // Instance of the database this collection belongs to
        this._name = name;
        this._privateDbManager = privateDbManager;
        this._metadata = {
            name: name,
            sizeKB: 0,
            length: 0,
            created: Date.now(),
            modified: Date.now()
        };
    }

    /**
     * Initialize the collection and fetch metadata from the private database.
     * Ensure that the collection (object store) exists.
     * @returns {Promise<void>}
     */
    async init() {
        const dbMetadata = await this._privateDbManager.getDatabaseMetadata(this._db.name);

        // Ensure collections array exists in metadata
        if (!dbMetadata || !dbMetadata.collections) {
            dbMetadata.collections = {};
        }

        if (this._name in dbMetadata.collections) {
            this._metadata = dbMetadata.collections[this._name];
        } else {
            // If the collection doesn't exist, create it
            if (!this._db.objectStoreNames.contains(this._name)) {
                console.log(`Collection "${this._name}" does not exist. Creating it.`);
                await this._createObjectStore();
            }

            this._metadata = { name: this._name, sizeKB: 0, length: 0, modified: Date.now() };
            dbMetadata.collections[this._name] = this._metadata;
            await this._privateDbManager.updateDatabaseMetadata(this._db.name, this._metadata);
        }
    }

    /**
     * Create the object store (collection) dynamically.
     * @private
     */
    async _createObjectStore() {
        const newVersion = this._db.version + 1;
        this._db.close();  // Close the current connection

        this._db = await IndexedDBUtility.openDatabase(this._db.name, newVersion, (db) => {
            if (!db.objectStoreNames.contains(this._name)) {
                db.createObjectStore(this._name, { keyPath: '_id' });
                console.log(`Collection "${this._name}" created.`);
            }
        });

        this._db = await IndexedDBUtility.openDatabase(this._db.name, newVersion);
    }

    /**
     * Add a document to the collection.
     * @param {Document} document - The document to add.
     * @returns {Promise<void>}
     */
    async addDocument(data, encryptionKey = null) {
        const documentData = await new Document(data, encryptionKey).databaseOutput();

        if (!this._db.objectStoreNames.contains(this._name)) {
            console.log(`Object store "${this._name}" does not exist. Reinitializing.`);
            await this._createObjectStore();
        }

        await IndexedDBUtility.performTransaction(this._db, this._name, 'readwrite', (store) => {
            // Update metadata using the document's packedData size
            this._metadata.length += 1;
            this._metadata.sizeKB += documentData.packedData.byteLength / 1024; // Convert bytes to KB
            this._metadata.modified = Date.now();
            return IndexedDBUtility.add(store, documentData);
        });

        await this._updateMetadata();
    }

    /**
     * Delete a document from the collection by its ID.
     * @param {string} docId - The ID of the document to delete.
     * @returns {Promise<void>}
     */
    async deleteDocument(docId = 0, strict = false) {
        // Get the document first to retrieve its size
        const docData = await IndexedDBUtility.performTransaction(this._db, this._name, 'readonly', (store) => {
            return IndexedDBUtility.get(store, docId);
        });

        if (!docData) {
            if(strict) {
                throw new Error(`Document with ID ${docId} not found.`);
            }else {
                return;
            }
        }

        // Proceed with deletion
        await IndexedDBUtility.performTransaction(this._db, this._name, 'readwrite', (store) => {
            // Update metadata using the document's packedData size
            this._metadata.length -= 1;
            this._metadata.sizeKB -= docData.packedData.byteLength / 1024; // Directly using byte length to calculate size in KB
            this._metadata.modified = Date.now();

            return IndexedDBUtility.delete(store, docId);
        });

        await this._updateMetadata();
    }
    
    async addMultipleDocuments(documents) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(this._name, 'readwrite');
            const store = tx.objectStore(this._name);

            documents.forEach(async (doc) => {
                const docData = new Document(doc);
                store.put(await docData.databaseOutput());
                
                // Update metadata using the document's packedData size
                this._metadata.length -= 1;
                this._metadata.sizeKB -= docData.packedData.byteLength / 1024; // Directly using byte length to calculate size in KB
                this._metadata.modified = Date.now();
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(`Failed to insert documents: ${tx.error ? tx.error.message : 'unknown error'}`);
        });
    }

    /**
     * Get a document by its ID from the collection.
     * @param {string} docId - The ID of the document to retrieve.
     * @returns {Promise<Document|null>} - The document or null if not found.
     */
    async getDocument(docId, encryptionKey = null) {
        // Ensure the collection (object store) exists before performing a transaction
        if (!this._db.objectStoreNames.contains(this._name)) {
            console.log(`Object store "${this._name}" does not exist. Reinitializing.`);
            await this._createObjectStore(); // Create the store if missing
        }

        const docData = await IndexedDBUtility.performTransaction(this._db, this._name, 'readonly', (store) => {
            return IndexedDBUtility.get(store, docId);
        });

        if (docData) {
            if (Document.isEncrypted(docData)) {
                // Return encrypted data if no key is provided
                return new Document(docData).databaseOutput();
            } else {
                return new Document(docData).objectOutput();
            }
        }

        return null;
    }


    async deleteOlderDocuments(quotaInMB) {
        const bytesLimit = quotaInMB * 1024 * 1024;  // Convert MB to bytes
        let currentSize = await this._calculateTotalSize();  // Calculate current size
        const store = this._db.transaction(this._name, 'readwrite').objectStore(this._name);

        return new Promise((resolve, reject) => {
            const request = store.openCursor(null, 'next');  // Open cursor to iterate in ascending order of key (_modified)
            request.onsuccess = async (event) => {
                const cursor = event.target.result;
                if (cursor && currentSize > bytesLimit) {
                    await store.delete(cursor.key);  // Delete the document
                    currentSize -= cursor.value.packedData.byteLength;  // Reduce the size
                    cursor.continue();  // Continue to the next record
                } else {
                    resolve();
                }
            };
            request.onerror = event => reject(`Cursor failed: ${event.target.error.message}`);
        });
    }

    /**
     * Query the collection with optional filters.
     * @param {object} filter - Optional filter to apply to the documents.
     * @returns {Promise<Object[]>} - Resolves with an array of objects matching the filter.
     */
    async query(filter = {}) {
        const results = [];
        await IndexedDBUtility.performTransaction(this._db, this._name, 'readonly', async (store) => {
            await IndexedDBUtility.iterateCursor(store, async (docData) => {
                // Check if the document is encrypted
                if (Document.isEncrypted(docData)) {
                    // Return encrypted data if no key is provided
                    const data = new Document(docData).databaseOutput();
                    results.push(data);
                } else {
                    console.log(docData)
                    const doc = new Document(docData);
                    const object = await doc.objectOutput();
                    let match = true;
                    for (const key in filter) {
                        if (object.data[key] !== filter[key]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        // Return plain document if not encrypted
                        results.push(object);
                    }
                }
            });
        });
        
        return Promise.all(results);
    }


    onupgradeneeded(event) {
        const db = event.target.result;
        const store = db.createObjectStore(this._name, { keyPath: '_id' });
        store.createIndex('modifiedIndex', '_modified', { unique: false });
    }

    async getDocumentsSortedByModified() {
        const tx = this._db.transaction(this._name, 'readonly');
        const store = tx.objectStore(this._name);
        const index = store.index('modifiedIndex');

        return new Promise((resolve, reject) => {
            const results = [];
            const request = index.openCursor(null, 'prev');  // Open cursor to get latest modified documents first

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = (event) => reject(`Cursor failed: ${event.target.error.message}`);
        });
    }

    async _calculateTotalSize() {
        const tx = this._db.transaction(this._name, 'readonly');
        const store = tx.objectStore(this._name);

        return new Promise((resolve, reject) => {
            let totalSize = 0;
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    totalSize += cursor.value.packedData.byteLength;  // Accumulate the size of each document
                    cursor.continue();
                } else {
                    resolve(totalSize);
                }
            };

            request.onerror = (event) => reject(`Failed to calculate total size: ${event.target.error.message}`);
        });
    }


    /**
     * Update the metadata in the private database.
     * @private
     */
    async _updateMetadata() {
        const dbMetadata = await this._privateDbManager.getDatabaseMetadata(this._db.name);

        // Ensure collections array exists in metadata
        if (!dbMetadata || !dbMetadata.collections) {
            dbMetadata.collections = {};
        }

        if(this._name in dbMetadata.collections) {
            dbMetadata.collections[this._name].sizeKB = this._metadata.sizeKB;
            dbMetadata.collections[this._name].length = this._metadata.length;
            dbMetadata.collections[this._name].modified = this._metadata.modified;
        }

        // Update total size and last modification for the entire database
        dbMetadata.totalSizeKB = Object.values(dbMetadata.collections).reduce((total, coll) => total + coll.sizeKB, 0);
        dbMetadata.modified = Date.now();

        await this._privateDbManager.updateDatabaseMetadata(this._db.name, dbMetadata);
    }
}

class Database {
    constructor(name, privateDbManager) {
        this._name = name;
        this._privateDbManager = privateDbManager;
        this._collections = new Map();  // Map of collection instances
        this._db = null;  // IndexedDB instance
    }

    get collectionNames() {
        return Array.from(this._collections.keys());
    }

    /**
     * Initialize the database by opening the IndexedDB instance and loading metadata.
     * @returns {Promise<void>}
     */
    async init() {
        if(this._db === null) {
            this._db = await IndexedDBUtility.openDatabase(this._name, 1, this._upgradeDatabase.bind(this));
            // Load collections metadata from the private database
            const metadata = await this._privateDbManager.getDatabaseMetadata(this._name);
            if (!metadata) {
                await this._privateDbManager.updateDatabaseMetadata(this._name, { collections: [] });
            }
            return true;
        }
        return false;
    }

    /**
     * Upgrade the database (called when a new version is needed).
     * @param {IDBDatabase} db - The IndexedDB instance.
     * @private
     */
    _upgradeDatabase(db) {
        // In future, you can upgrade by adding object stores (collections) dynamically
        console.log('Database upgrade triggered for', this._name);
    }

    /**
     * Create a new collection in the database.
     * @param {string} collectionName - The name of the new collection.
     * @returns {Promise<void>}
     */
    async createCollection(collectionName) {

        await this.init();
        if (this._collections.has(collectionName)) {
            throw new Error(`Collection ${collectionName} already exists`);
        }

        // Increment the version to trigger the onupgradeneeded event
        const newVersion = this._db.version + 1;
        this._db.close(); // Close the current database connection

        // Reopen the database with the new version to trigger an upgrade
        await IndexedDBUtility.openDatabase(this._name, newVersion, (db) => {
            if (!db.objectStoreNames.contains(collectionName)) {
                db.createObjectStore(collectionName, { keyPath: '_id' });
                console.log(`Collection "${collectionName}" created.`);
            }
        });

        // Reopen the database with the new version
        this._db = await IndexedDBUtility.openDatabase(this._name, newVersion);

        // Create collection instance and store it
        const collection = new Collection(this._db, collectionName, this._privateDbManager);
        await collection.init();
        this._collections.set(collectionName, collection);

        // Update the database metadata
        const metadata = await this._privateDbManager.getDatabaseMetadata(this._name);
        metadata.collections[collectionName] = { name: collectionName, sizeKB: 0, length: 0 };
        await this._privateDbManager.updateDatabaseMetadata(this._name, metadata);
        return this.getCollection(collectionName);
    }

    /**
     * Delete a collection from the database.
     * @param {string} collectionName - The name of the collection to delete.
     * @returns {Promise<void>}
     */
    async deleteCollection(collectionName) {
        await this.init();
        if (!this._collections.has(collectionName)) {
            throw new Error(`Collection ${collectionName} does not exist`);
        }

        // Delete the collection from IndexedDB
        const tx = this._db.transaction([collectionName], 'readwrite');
        const store = tx.objectStore(collectionName);
        store.clear();

        this._collections.delete(collectionName);

        // Update metadata
        const metadata = await this._privateDbManager.getDatabaseMetadata(this._name);
        metadata.collections = metadata.collections.filter(c => c.name !== collectionName);
        await this._privateDbManager.updateDatabaseMetadata(this._name, metadata);
    }

    /**
     * Get an instance of a collection by name.
     * @param {string} collectionName - The name of the collection.
     * @returns {Promise<Collection>} - Resolves with the Collection instance.
     */
    async getCollection(collectionName) {
        if (!this._collections.has(collectionName)) {
            const collection = new Collection(this._db, collectionName, this._privateDbManager);
            await collection.init();
            this._collections.set(collectionName, collection);
        }

        return this._collections.get(collectionName);
    }

    /**
     * Delete the entire database and its metadata.
     * @returns {Promise<void>}
     */
    async deleteDatabase() {
        await IndexedDBUtility.deleteDatabase(this._name);
        await this._privateDbManager.deleteDatabaseMetadata(this._name);
    }
}

var LacertaDB = {
    PrivateDatabaseManager,
    Collection,
    Database,
    Document
};

module.exports = {LacertaDB: LacertaDB}


