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

class OPFSUtility {
    /**
     * Save attachments to the file system.
     * @param {string} dbName - The database name.
     * @param {string} collectionName - The collection name.
     * @param {string} documentId - The ID of the document.
     * @param {Array} attachments - Array of attachment objects with `data` property (Blob or File).
     * @returns {Promise<Array>} - Array of file paths where attachments are stored.
     */
    static async saveAttachments(dbName, collectionName, documentId, attachments) {
        const attachmentPaths = [];

        // Ensure OPFS is available
        const rootHandle = await navigator.storage.getDirectory();

        // Build the directory path
        const pathParts = [dbName, collectionName, documentId];

        // Navigate to the document directory
        let dirHandle = rootHandle;
        for (const part of pathParts) {
            dirHandle = await dirHandle.getDirectoryHandle(part, { create: true });
        }

        // Save each attachment
        for (let i = 0; i < attachments.length; i++) {
            const fileId = i.toString(); // Use index as file ID
            const fileHandle = await dirHandle.getFileHandle(fileId, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(attachments[i].data);
            await writable.close();

            // Store the path
            const filePath = `${dbName}/${collectionName}/${documentId}/${fileId}`;
            attachmentPaths.push(filePath);
        }

        return attachmentPaths;
    }

    /**
     * Retrieve attachments from the file system.
     * @param {Array} attachmentPaths - Array of file paths to retrieve attachments from.
     * @returns {Promise<Array>} - Array of attachment objects with `data` property (Blob).
     */
    static async getAttachments(attachmentPaths) {
        const attachments = [];

        // Ensure OPFS is available
        const rootHandle = await navigator.storage.getDirectory();

        for (const path of attachmentPaths) {
            try {
                // Split the path to navigate
                const pathParts = path.split('/');
                let dirHandle = rootHandle;
                for (let i = 0; i < pathParts.length - 1; i++) {
                    dirHandle = await dirHandle.getDirectoryHandle(pathParts[i]);
                }
                const fileHandle = await dirHandle.getFileHandle(pathParts[pathParts.length - 1]);
                const file = await fileHandle.getFile();

                attachments.push({
                    path: path,
                    data: file,
                });
            } catch (error) {
                console.error(`Error retrieving attachment at "${path}": ${error.message}`);
            }
        }

        return attachments;
    }

    /**
     * Delete attachments from the file system.
     * @param {string} dbName - The database name.
     * @param {string} collectionName - The collection name.
     * @param {string} documentId - The ID of the document.
     * @returns {Promise<void>}
     */
    static async deleteAttachments(dbName, collectionName, documentId) {
        // Ensure OPFS is available
        const rootHandle = await navigator.storage.getDirectory();

        // Build the directory path
        const pathParts = [dbName, collectionName, documentId];

        // Navigate to the parent directory
        let dirHandle = rootHandle;
        for (let i = 0; i < pathParts.length - 1; i++) {
            dirHandle = await dirHandle.getDirectoryHandle(pathParts[i]);
        }

        try {
            await dirHandle.removeEntry(pathParts[pathParts.length - 1], { recursive: true });
        } catch (error) {
            console.error(`Error deleting attachments for document "${documentId}": ${error.message}`);
        }
    }
}

class BrowserCompressionUtility {
    /**
     * Compress a string or Uint8Array using Gzip.
     * @param {Uint8Array|string} input - The input data to compress.
     * @returns {Promise<Uint8Array>} - A promise that resolves to the compressed data as a Uint8Array.
     */
    static async compress(input) {
        const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
        const stream = new CompressionStream('deflate');
        const writer = stream.writable.getWriter();

        writer.write(data);
        writer.close();

        return await this._streamToUint8Array(stream.readable);
    }

    /**
     * Decompress a Gzip-compressed Uint8Array.
     * @param {Uint8Array} compressedData - The compressed data to decompress.
     * @returns {Promise<Uint8Array>} - A promise that resolves to the decompressed data as a Uint8Array.
     */
    static async decompress(compressedData) {
        const stream = new DecompressionStream('deflate');
        const writer = stream.writable.getWriter();

        writer.write(compressedData);
        writer.close();

        return await this._streamToUint8Array(stream.readable);
    }

    /**
     * Helper function to convert a ReadableStream to a Uint8Array.
     * @param {ReadableStream} readableStream - The readable stream to convert.
     * @returns {Promise<Uint8Array>} - A promise that resolves to a Uint8Array.
     */
    static async _streamToUint8Array(readableStream) {
        const reader = readableStream.getReader();
        const chunks = [];
        let totalLength = 0;

        // Read all chunks from the stream
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
        }

        // Merge all chunks into a single Uint8Array
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }
}

class BrowserEncryptionUtility {
    /**
     * Encrypt data using multiple layers of encryption, returning everything as a single Uint8Array.
     * @param {Uint8Array} data - The data to be encrypted.
     * @param {string} password - The password to derive the encryption key.
     * @returns {Promise<Uint8Array>} - A Uint8Array containing IV, salt, and encrypted data.
     */
    static async encrypt(data, password) {
        // Generate salt and derive key from the password
        const salt = crypto.getRandomValues(new Uint8Array(16)); // Random salt
        const key = await this._deriveKey(password, salt);

        // Generate IV for AES-GCM
        const iv = crypto.getRandomValues(new Uint8Array(12)); // Random IV

        // Add a checksum to the data for integrity
        const checksum = await this._generateChecksum(data);
        const combinedData = this._combineDataAndChecksum(data, checksum);

        // First layer of AES-GCM encryption
        const encryptedData = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            combinedData // Data + checksum
        );

        // Wrap everything into a Uint8Array: [salt, iv, encryptedData]
        return this._wrapIntoUint8Array(salt, iv, new Uint8Array(encryptedData));
    }

    /**
     * Decrypt data, verifying integrity with a checksum, and return the original Uint8Array.
     * @param {Uint8Array} wrappedData - The Uint8Array that contains the salt, IV, and encrypted data.
     * @param {string} password - The password to derive the decryption key.
     * @returns {Promise<Uint8Array>} - The original decrypted data.
     */
    static async decrypt(wrappedData, password) {
        // Extract the salt, IV, and encrypted data from the Uint8Array
        const { salt, iv, encryptedData } = this._unwrapUint8Array(wrappedData);

        // Derive the key using the same salt
        const key = await this._deriveKey(password, salt);

        // Decrypt the data
        const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encryptedData
        );

        // Separate the checksum and the original data
        const decryptedUint8Array = new Uint8Array(decryptedData);
        const { data, checksum } = this._separateDataAndChecksum(decryptedUint8Array);

        // Verify the checksum to ensure data integrity
        const validChecksum = await this._generateChecksum(data);
        if (!this._verifyChecksum(validChecksum, checksum)) {
            throw new Error("Data integrity check failed. The data has been tampered with.");
        }

        // Return the original data
        return data;
    }

    // Private method to derive a cryptographic key from the password and salt
    static async _deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password), // Password converted to Uint8Array
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        // Derive a key using PBKDF2
        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt, // Salt
                iterations: 150000, // Increased iterations for stronger security
                hash: "SHA-512" // Using SHA-512 for key derivation
            },
            keyMaterial,
            {
                name: "AES-GCM",
                length: 256 // AES-GCM with a 256-bit key
            },
            false,
            ["encrypt", "decrypt"]
        );
    }

    // Private method to generate a checksum using SHA-256
    static async _generateChecksum(data) {
        return new Uint8Array(
            await crypto.subtle.digest("SHA-256", data) // Generate SHA-256 hash
        );
    }

    // Verify the checksum
    static _verifyChecksum(generatedChecksum, originalChecksum) {
        if (generatedChecksum.length !== originalChecksum.length) return false;
        for (let i = 0; i < generatedChecksum.length; i++) {
            if (generatedChecksum[i] !== originalChecksum[i]) {
                return false;
            }
        }
        return true;
    }

    // Combine the checksum and data
    static _combineDataAndChecksum(data, checksum) {
        const combined = new Uint8Array(data.length + checksum.length);
        combined.set(data); // Set original data first
        combined.set(checksum, data.length); // Append checksum
        return combined;
    }

    // Separate the checksum and data after decryption
    static _separateDataAndChecksum(combinedData) {
        const dataLength = combinedData.length - 32; // SHA-256 checksum is 32 bytes
        const data = combinedData.slice(0, dataLength);
        const checksum = combinedData.slice(dataLength);
        return { data, checksum };
    }

    // Wrap salt, IV, and encrypted data into a single Uint8Array
    static _wrapIntoUint8Array(salt, iv, encryptedData) {
        const result = new Uint8Array(salt.length + iv.length + encryptedData.length);
        result.set(salt, 0); // Add salt at the beginning
        result.set(iv, salt.length); // Add IV after salt
        result.set(encryptedData, salt.length + iv.length); // Add encrypted data
        return result;
    }

    // Unwrap salt, IV, and encrypted data from a Uint8Array
    static _unwrapUint8Array(wrappedData) {
        const salt = wrappedData.slice(0, 16); // First 16 bytes are salt
        const iv = wrappedData.slice(16, 28); // Next 12 bytes are IV (16+12=28)
        const encryptedData = wrappedData.slice(28); // Remaining bytes are the encrypted data
        return { salt, iv, encryptedData };
    }
}

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
        this._metadataKey = `lacertadb_${this._dbName}_metadata`;
        this._collections = new Map();
        this._metadata = this._loadMetadata();
    }

    _loadMetadata() {
        const metadata = LocalStorageUtility.getItem(this.metadataKey);
        if (metadata) {
            // Recreate CollectionMetadata instances
            for (const collectionName in metadata.collections) {
                const collectionData = metadata.collections[collectionName];
                const collectionMetadata = new CollectionMetadata(collectionName, this, collectionData);
                this.collections.set(collectionName, collectionMetadata);
            }
            this.data = metadata;
        } else {
            this.data = {
                name: this._dbName,
                collections: {}, // collectionName -> collection metadata data
                totalSizeKB: 0,
                totalLength: 0,
                modifiedAt: Date.now(),
            };
        }
        return this._metadata;
    }

    // Getter and Setter for data
    get data() {
        return this._metadata;
    }

    set data(d) {
        this._metadata = d;
    }

    // Getter for name
    get name() {
        return this.data.name;
    }

    // Getter for key
    get metadataKey() {
        return this._metadataKey;
    }

    // Getter and Setter for collections
    get collections() {
        return this._collections;
    }

    set collections(c) {
        this._collections = c;
    }

    // Getter for totalSizeKB
    get totalSizeKB() {
        return this.data.totalSizeKB;
    }

    // Getter for totalLength
    get totalLength() {
        return this.data.totalLength;
    }

    // Getter for modifiedAt
    get modifiedAt() {
        return this.data.modifiedAt;
    }

    // Get or create CollectionMetadata
    getCollectionMetadata(collectionName) {
        if (!this.collections.has(collectionName)) {
            // Create new CollectionMetadata
            const collectionMetadata = new CollectionMetadata(collectionName, this);
            this.collections.set(collectionName, collectionMetadata);
            this.data.collections[collectionName] = collectionMetadata.getRawMetadata();
            this.data.modifiedAt = Date.now();
        }
        return this.collections.get(collectionName);
    }

    getCollectionMetadataData(collectionName) {
        const metadata = this.getCollectionMetadata(collectionName);
        return metadata ? metadata.getRawMetadata(): {}
    }

    // Remove a collection's metadata
    removeCollectionMetadata(collectionName) {
        const collectionMetadata = this.collections.get(collectionName);
        if (collectionMetadata) {
            // Subtract collection's size and length from totals
            this.data.totalSizeKB -= collectionMetadata.sizeKB;
            this.data.totalLength -= collectionMetadata.length;
            // Remove the collection's metadata
            this.collections.delete(collectionName);
            delete this.data.collections[collectionName];
            // Update modifiedAt internally
            this.data.modifiedAt = Date.now();
        }
    }

    // Adjust totalSizeKB and totalLength (used by CollectionMetadata)
    adjustTotals(sizeKBChange, lengthChange) {
        this.data.totalSizeKB += sizeKBChange;
        this.data.totalLength += lengthChange;
        this.data.modifiedAt = Date.now();
    }

    // Get all collection names
    getCollectionNames() {
        return Array.from(this.collections.keys());
    }

    // Get raw metadata (for saving)
    getRawMetadata() {
        // Before returning, ensure that collections in _metadata are updated
        for (const [collectionName, collectionMetadata] of this._collections.entries()) {
            this.data.collections[collectionName] = collectionMetadata.getRawMetadata();
        }
        return this.data;
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

    get key() {
        return this._metadataKey;
    }

    // Method to save metadata
    saveMetadata() {
        LocalStorageUtility.setItem(this.key, this.getRawMetadata());
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
                documentAttachments: {}, // Stores document attachments
            };
            // Update databaseMetadata
            this._databaseMetadata.data.collections[collectionName] = this._metadata;
            this._databaseMetadata.data.modifiedAt = Date.now();
        }
    }

    // Getter for name
    get name() {
        return this._collectionName;
    }

    get keys() {
        return Object.keys(this.documentSizes);
    }

    // Getter for collection name
    get collectionName() {
        return this.name;
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

    get metadata() {
        return this._metadata;
    }

    set metadata(m) {
        return this._metadata = m;
    }

    get data() {
        return this.metadata;
    }

    set data(m) {
        this.metadata = m;
    }

    get databaseMetadata() {
        return this._databaseMetadata;
    }

    set databaseMetadata(m) {
        this._databaseMetadata = m;
    }

    // Methods to add, update, delete documents
    get documentSizes(){return this.metadata.documentSizes;}
    get documentModifiedAt(){return this.metadata.documentModifiedAt;}
    get documentPermanent(){return this.metadata.documentPermanent;}
    get documentAttachments(){return this.metadata.documentAttachments;}

    set documentSizes(v){ this.metadata.documentSizes = v;}
    set documentModifiedAt(v){ this.metadata.documentModifiedAt = v;}
    set documentPermanent(v){ this.metadata.documentPermanent = v;}
    set documentAttachments(v){ this.metadata.documentAttachments = v;}

    // Add or update a document
    updateDocument(docId, docSizeKB, isPermanent = false, attachmentCount = 0) {
        const isNewDocument = !this.keys.includes(docId);
        const previousDocSizeKB = this.documentSizes[docId] || 0;
        const sizeKBChange = docSizeKB - previousDocSizeKB;
        const lengthChange = isNewDocument ? 1 : 0;

        // Update document metadata
        this.documentSizes[docId] = docSizeKB;
        this.documentModifiedAt[docId] = Date.now();
        this.documentPermanent[docId] = isPermanent ? 1 : 0;
        this.documentAttachments[docId] = attachmentCount; // Number of attachments

        // Update collection metadata
        this.metadata.sizeKB += sizeKBChange;
        this.metadata.length += lengthChange;
        this.metadata.modifiedAt = Date.now();

        // Update database totals
        this.databaseMetadata.adjustTotals(sizeKBChange, lengthChange);
    }

    // Delete a document
    deleteDocument(docId) {
        if (!this.keys.includes(docId)) {
            return false;
        }

        const docSizeKB = this.documentSizes[docId];
        const sizeKBChange = -docSizeKB;
        const lengthChange = -1;

        // Remove document metadata
        delete this.documentSizes[docId];
        delete this.documentModifiedAt[docId];
        delete this.documentPermanent[docId];
        delete this.documentAttachments[docId];

        // Update collection metadata
        this.metadata.sizeKB += sizeKBChange;
        this.metadata.length += lengthChange;
        this.metadata.modifiedAt = Date.now();

        // Update database totals
        this.databaseMetadata.adjustTotals(sizeKBChange, lengthChange);

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
        return this.metadata;
    }

    // Set raw metadata (e.g., after loading)
    setRawMetadata(metadata) {
        this.metadata = metadata;
    }
}

class QuickStore {
    constructor(dbName) {
        this._dbName = dbName;
        this._metadataKey = `lacertadb_${this._dbName}_quickstore_`;
        this._documentKeyPrefix = 'lacertadb_quickstore_';
        this._metadata = this._loadMetadata();
    }

    _loadMetadata() {
        const metadata = LocalStorageUtility.getItem(this._metadataKey);
        if (metadata) {
            return metadata;
        } else {
            // Initialize metadata
            return {
                totalSizeKB: 0,
                totalLength: 0,
                documentSizesKB: {}, // docId -> sizeKB
                documentModificationTime: {}, // docId -> timestamp
                documentPermanent: {}, // docId -> boolean
            };
        }
    }

    _saveMetadata() {
        LocalStorageUtility.setItem(this._metadataKey, this._metadata);
    }

    async setDocument(documentData, encryptionKey = null) {
        const document = new Document(documentData, encryptionKey);
        await document.pack(); // Packs the data

        const docId = document._id;
        const isPermanent = document._permanent || false;
        const dataToStore = JOYSON.stringify({
            _id: document._id,
            _created: document._created,
            _modified: document._modified,
            _permanent: document._permanent,
            _encrypted: document._encrypted,
            _compressed: document._compressed,
            packedData: document.packedData, // Convert Uint8Array to Array for JSON
        });

        const key = this._documentKeyPrefix + docId;
        localStorage.setItem(key, dataToStore);

        const dataSizeKB = dataToStore.length / 1024;

        const isNewDocument = !(docId in this._metadata.documentSizesKB);

        if (isNewDocument) {
            this._metadata.totalLength += 1;
        } else {
            // Adjust totalSizeKB
            this._metadata.totalSizeKB -= this._metadata.documentSizesKB[docId];
        }

        this._metadata.documentSizesKB[docId] = dataSizeKB;
        this._metadata.documentModificationTime[docId] = document._modified;
        this._metadata.documentPermanent[docId] = isPermanent;

        this._metadata.totalSizeKB += dataSizeKB;

        this._saveMetadata();

        return isNewDocument;
    }

    async deleteDocument(docId, force = false) {
        const isPermanent = this._metadata.documentPermanent[docId] || false;
        if (isPermanent && !force) {
            return false;
        }

        const key = this._documentKeyPrefix + docId;
        const docSizeKB = this._metadata.documentSizesKB[docId] || 0;

        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);

            delete this._metadata.documentSizesKB[docId];
            delete this._metadata.documentModificationTime[docId];
            delete this._metadata.documentPermanent[docId];

            this._metadata.totalSizeKB -= docSizeKB;
            this._metadata.totalLength -= 1;

            this._saveMetadata();

            return true;
        } else {
            return false;
        }
    }

    getAllKeys() {
        return Object.keys(this._metadata.documentSizesKB);
    }

    async getDocument(docId, encryptionKey = null) {
        const key = this._documentKeyPrefix + docId;
        const dataString = localStorage.getItem(key);

        if (dataString) {
            const docData = JOYSON.parse(dataString);
            if (docData._encrypted) {
                if (!encryptionKey) {
                    throw new Error("Encryption key required to decrypt document");
                }
                const document = new Document(docData, encryptionKey);
                return await document.objectOutput();
            } else {
                const document = new Document(docData);
                return await document.objectOutput();
            }
        } else {
            return null;
        }
    }
}

class Database {
    constructor(dbName, settings = {}) {
        this._dbName = dbName;
        this._db = null;
        this._collections = new Map();
        this._metadata = new DatabaseMetadata(dbName);
        this._settings = new Settings(dbName, settings);
        this._quickStore = new QuickStore(this._dbName);
        this._settings.init();
    }

    get quickStore() {
        return this._quickStore;
    }

    async init() {
        // Open the database
        this.db = await IndexedDBUtility.openDatabase(this.name, undefined, (db, oldVersion, newVersion) => {
            this._upgradeDatabase(db, oldVersion, newVersion);
        });

        // Initialize collections
        const collectionNames = this.data.getCollectionNames();
        for (const collectionName of collectionNames) {
            const collection = new Collection(this, collectionName, this.settings);
            await collection.init();
            this.collections.set(collectionName, collection);
        }
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
        console.log(`Upgrading database "${this.name}" from version ${oldVersion} to ${newVersion}`);
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
            this.db = await IndexedDBUtility.openDatabase(this.name, newVersion, (db, oldVersion, newVersion) => {
                this._createDataStore(db, collectionName);
            });
        }
        // Create a new Collection instance
        const collection = new Collection(this, collectionName, this.settings);
        await collection.init();
        this.collections.set(collectionName, collection);

        // Ensure the CollectionMetadata exists
        this.data.getCollectionMetadata(collectionName);

        // Save metadata
        this.data.saveMetadata();

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

        // Remove collection metadata
        this.data.removeCollectionMetadata(collectionName);

        // Save metadata
        this.data.saveMetadata();
    }

    async getCollection(collectionName) {
        if (this.collections.has(collectionName)) {
            return this.collections.get(collectionName);
        } else {
            // Check if the collection exists in the database
            if (this.db.objectStoreNames.contains(collectionName)) {
                // Create a new Collection instance
                const collection = new Collection(this, collectionName, this.settings);
                await collection.init();
                this.collections.set(collectionName, collection);
                return collection;
            } else {
                throw new Error(`Collection "${collectionName}" does not exist.`);
            }
        }
    }

    async close() {

        // Close collections
        const collections = this.collectionsArray;

        for (const collection of collections) {
            collection.close();
        }

        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async deleteDatabase() {
        await this.close();
        await IndexedDBUtility.deleteDatabase(this.name);
        // Remove metadata and settings
        this.data = null;
        this.settings.clear();
        LocalStorageUtility.removeItem(this.data.metadataKey);
    }

    // Accessor methods for private properties
    get name() {
        return this._dbName;
    }

    get db() {
        return this._db;
    }

    set db(db) {
        this._db = db;
    }

    get data() {
        return this.metadata;
    }
    set data(d) {
        this.metadata = d;
    }

    get collectionsArray() {
        return Array.from(this.collections.values());
    }

    get collections() {
        return this._collections;
    }

    get metadata() {
        return this._metadata;
    }

    set metadata(d) {
        this._metadata = d;
    }

    get totalSizeKB() {
        return this.data.totalSizeKB;
    }

    get totalLength() {
        return this.data.totalLength;
    }

    get modifiedAt() {
        return this.data.modifiedAt;
    }

    get settings() {
        return this._settings;
    }
    get settingsData() {
        return this.settings.data;
    }
}

class Document {
    constructor(data, encryptionKey = null) {
        this._id = data._id || this._generateId();
        this._created = data._created || Date.now();
        this._permanent = data._permanent ? true : false;
        this._encrypted = data._encrypted || (encryptionKey ? true : false);
        this._compressed = data._compressed || false;

        // _attachments is an array of file paths
        this._attachments = data.attachments || []; // Array of file paths

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


    get attachments() {
        return this._attachments;
    }

    set attachments(value) {
        this._attachments = value;
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
     * Check if a document contains attachments.
     * @param {object} documentData - The document data to check.
     * @returns {boolean} - True if the document contains attachments, false otherwise.
     */
    static hasAttachments(documentData) {
        return documentData.attachments && documentData.attachments.length > 0;
    }

    /**
     * Retrieve attachments for a given document.
     * @param {object} documentData - The document data.
     * @param {string} dbName - The database name.
     * @param {string} collectionName - The collection name.
     * @returns {Promise<Array>} - Array of attachment objects with `data` property (Blob).
     */
    static async getAttachments(documentData, dbName, collectionName) {
        if (!Document.hasAttachments(documentData)) {
            return [];
        }

        const attachmentPaths = documentData.attachments;
        documentData.attachments = await OPFSUtility.getAttachments(attachmentPaths);
        return Promise.resolve(documentData);
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
        const decryptedData = await BrowserEncryptionUtility.decrypt(documentData.packedData, encryptionKey);
        // Unpack the decrypted data
        const unpackedData = JOYSON.unpack(decryptedData);

        return {
            _id: documentData._id,
            _created: documentData._created,
            _modified: documentData._modified,
            _encrypted: true,
            _compressed: documentData._compressed,
            _permanent: documentData._permanent ? true: false,
            attachments: documentData.attachments,
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
        return await BrowserEncryptionUtility.encrypt(data, encryptionKey);
    }

    async _decryptData(data) {
        const encryptionKey = this.encryptionKey;
        return await BrowserEncryptionUtility.decrypt(data, encryptionKey);
    }

    async _compressData(data) {
        return await BrowserCompressionUtility.compress(data);
    }

    async _decompressData(data) {
        return await BrowserCompressionUtility.decompress(data);
    }

    _generateId() {
        return 'xxxx-xxxx-xxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16));
    }

    /**
     * Return the document in a format for general object use (readable format).
     * @param {boolean} includeAttachments - Whether to include attachment data.
     * @param {AttachmentManager} attachmentManager - The attachment manager instance.
     * @returns {Promise<object>} - Unpacked document data.
     */
    /**
     * Return the document in a format for general object use (readable format).
     * @param {boolean} includeAttachments - Whether to include attachment data.
     * @returns {Promise<object>} - Unpacked document data.
     */
    async objectOutput(includeAttachments = false) {
        if (!this.data) {
            await this.unpack(); // Ensure data is unpacked before returning
        }

        const output = {
            _id: this._id,
            _created: this._created,
            _modified: this._modified,
            _permanent: this._permanent,
            _encrypted: this._encrypted,
            _compressed: this._compressed,
            attachments: this.attachments,
            data: this.data,
        };

        if (includeAttachments && this.attachments.length > 0) {
            const attachments = await OPFSUtility.getAttachments(this.attachments);
            output.attachments = attachments;
        }

        return output;
    }

    /**
     * Return the document in a format for storage in the database (packed format).
     * @returns {Promise<object>} - Packed document data.
     */
    async databaseOutput() {
        if (!this.packedData || this.packedData.length === 0) {
            await this.pack(); // Ensure the data is packed before returning
        }

        return {
            _id: this._id,
            _created: this._created,
            _modified: this._modified,
            _permanent: this._permanent ? true : false,
            _compressed: this._compressed,
            _encrypted: this._encrypted,
            attachments: this.attachments,
            packedData: this.packedData, // Packed and ready for storage
        };
    }
}

class Settings {
    constructor(dbName, newSettings = {}) {
        this._dbName = dbName;
        this._settingsKey = `lacertadb_${this._dbName}_settings`;
        this._data = this._loadSettings();
        this._mergeSettings(newSettings);
    }

    init() {

        // Set defaults for size and buffer limits
        this.set('sizeLimitKB', this.get('sizeLimitKB') || Infinity);
        this.set('bufferLimitKB', this.get('bufferLimitKB') || -(this.get('sizeLimitKB') * 0.2));

        // Validate bufferLimitKB
        if (this.get('bufferLimitKB') < -0.8 * this.get('sizeLimitKB')) {
            throw new Error("Buffer limit cannot be below -80% of the size limit.");
        }

        // Set up free space settings with default validation
        this.set('freeSpaceEvery', this._validateFreeSpaceSetting(this.get('freeSpaceEvery')));
    }

    _validateFreeSpaceSetting(value = 10000) {
        if (value === undefined || value === false || value === 0) {
            return Infinity;
        }
        if (value < 1000 && value !== 0) {
            throw new Error("Invalid freeSpaceEvery value. It must be 0, Infinity, or above 1000.");
        }
        if (value >= 1000 && value < 10000) {
            console.warn("Warning: freeSpaceEvery value is between 1000 and 10000, which may lead to frequent freeing.");
        }
        return value;
    }


    _loadSettings() {
        const settings = LocalStorageUtility.getItem(this.settingsKey);
        return settings ? settings : {};
    }

    _saveSettings() {
        LocalStorageUtility.setItem(this.settingsKey, this.data);
    }

    _mergeSettings(newSettings) {
        this.data = Object.assign(this.data, newSettings);
        this._saveSettings();
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        this.data[key] = value;
        this._saveSettings();
    }

    remove(key) {
        delete this.data[key];
        this._saveSettings();
    }

    clear() {
        this.data = {};
        this._saveSettings();
    }

    // Accessor methods for private properties (if needed)
    get dbName() {
        return this._dbName;
    }

    get data() {
        return this._data;
    }

    set data(s) {
        this._data = s;
    }

    get settingsKey() {
        return this._settingsKey;
    }
}

class Collection {
    constructor(database, collectionName, settings) {
        this._database = database;
        this._collectionName = collectionName;
        this._settings = settings;
        this._metadata = null;
        this._lastFreeSpaceTime = 0;
        this._observer = new Observer();
    }

    get observer() {
        return this._observer;
    }

    async init() {

        // Load collection metadata from database metadata
        this.metadata = this.database.metadata.getCollectionMetadata(this.name);

        // Run free space every period
        this._freeSpaceInterval = setInterval(() => this._maybeFreeSpace.bind(this), this.settingsData.freeSpaceEvery);
    }

    async close() {
        clearInterval(this._freeSpaceInterval);
    }

    // Accessor methods for private properties
    get name() {
        return this._collectionName;
    }

    get sizes() {
        return this.metadataData.documentSizes || {};
    }

    get modifications() {
        return this.metadataData.documentModifiedAt || {};
    }

    get attachments() {
        return this.metadataData.attachments || {};
    }

    get permanents() {
        return this.metadataData.documentPermanent || {};
    }

    get keys() {
        return Object.keys(this.sizes);
    }

    get documentsMetadata() {
        var keys = this.keys;
        var sizes = this.sizes;
        var modifications = this.modifications;
        var permanents = this.permanents;
        var attachments = this.attachments;
        var metadata = new Array(keys.length);
        var i = 0;
        for(const key of keys){
            metadata[i++] = {
                id: key,
                size: sizes[key],
                modified: modifications[key],
                permanent: permanents[key],
                attachment: attachments[key]
            };
        }

        return metadata;
    }

    get settings() {
        return this._settings;
    }

    get settingsData() {
        return this.settings.data;
    }

    set settings(d) {
        this._settings = d;
    }

    get lastFreeSpaceTime() {
        return this._lastFreeSpaceTime;
    }

    set lastFreeSpaceTime(t) {
        this._lastFreeSpaceTime = t;
    }

    get database() {
        return this._database;
    }

    get metadata() {
        return this._metadata;
    }

    get metadataData() {
        return this._metadata.getRawMetadata();
    }

    set metadata(m) {
        this._metadata = m;
    }

    get sizeKB() {
        return this.metadataData.sizeKB;
    }

    get length() {
        return this.metadataData.length;
    }

    get totalSizeKB() {
        return this.sizeKB;
    }

    get totalLength() {
        return this.length;
    }

    get modifiedAt() {
        return this.metadataData.modifiedAt;
    }

    get isFreeSpaceEnabled() {
        return this.settings.freeSpaceEvery !== Infinity;
    }

    get shouldRunFreeSpaceSize() {
        return (this.totalSizeKB > this.settingsData.sizeLimitKB + this.settings.bufferLimitKB);
    }

    get shouldRunFreeSpaceTime() {
        return (this.isFreeSpaceEnabled && (Date.now() - this.lastFreeSpaceTime >= this.settings.freeSpaceEvery))
    }

    async _maybeFreeSpace() {
        if(this.shouldRunFreeSpaceSize || this.shouldRunFreeSpaceTime){
            return this.freeSpace(this.settings.sizeLimitKB);
        }
    }

    /**
     * Add a single document to the collection.
     * @param {object} documentData - The document data to add.
     * @param {string|null} encryptionKey - Encryption key if needed.
     * @returns {Promise<boolean>} - True if the document was newly added, false if updated.
     */
    async addDocument(documentData, encryptionKey = null) {
        // Emit beforeAdd event
        this.observer._emit('beforeAdd', documentData);

        const document = new Document(documentData, encryptionKey);

        // Save attachments if any
        if (documentData._attachments && documentData._attachments.length > 0) {
            const attachmentPaths = await OPFSUtility.saveAttachments(
                this.database.name,
                this.name,
                document._id,
                documentData._attachments
            );
            document._attachments = attachmentPaths;
        }

        const docData = await document.databaseOutput();

        const docId = docData._id;
        const isPermanent = docData._permanent || false;
        let isNewDocument = !(docId in this.metadataData.documentSizes);

        try {
            if (isNewDocument) {
                // Use insert (add), will fail if record exists
                await IndexedDBUtility.performTransaction(
                    this.database.db,
                    this.name,
                    'readwrite',
                    (store) => {
                        return IndexedDBUtility.add(store, docData);
                    }
                );
            } else {
                // Use put (update) for existing documents
                await IndexedDBUtility.performTransaction(
                    this.database.db,
                    this.name,
                    'readwrite',
                    (store) => {
                        return IndexedDBUtility.put(store, docData);
                    }
                );
            }
        } catch (error) {
            if (isNewDocument) {
                // Record already exists, so we update it
                await IndexedDBUtility.performTransaction(
                    this.database.db,
                    this.name,
                    'readwrite',
                    (store) => {
                        return IndexedDBUtility.put(store, docData);
                    }
                );
                isNewDocument = false;
            } else {
                throw error;
            }
        }

        const docSizeKB = docData.packedData.byteLength / 1024;

        // Update collection metadata
        this.metadata.updateDocument(
            docId,
            docSizeKB,
            isPermanent,
            documentData._attachments ? documentData._attachments.length : 0
        );

        // Save metadata
        this.database.metadata.saveMetadata();
        await this._maybeFreeSpace();

        // Emit afterAdd event
        this.observer._emit('afterAdd', documentData);

        return isNewDocument;
    }

    /**
     * Add multiple documents to the collection.
     * @param {object[]} documentsData - Array of document data to add.
     * @param {string|null} encryptionKey - Encryption key if needed.
     * @returns {Promise<number>} - Number of documents newly added.
     */
    async addDocuments(documentsData, encryptionKey = null) {
        let newDocumentsCount = 0;

        for (const documentData of documentsData) {
            const isNewDocument = await this.addDocument(documentData, encryptionKey);
            if (isNewDocument) {
                newDocumentsCount += 1;
            }
        }

        return newDocumentsCount;
    }

    /**
     * Retrieve a single document from the collection.
     * @param {string} docId - The ID of the document to retrieve.
     * @param {string|null} encryptionKey - Encryption key if needed.
     * @returns {Promise<object|false>} - The document object or false if not found.
     */
    async getDocument(docId, encryptionKey = null, includeAttachments = false) {
        // Emit beforeGet event
        this.observer._emit('beforeGet', docId);

        // Check if the document exists in metadata
        if (!(docId in this.metadataData.documentSizes)) {
            return false;
        }

        const docData = await IndexedDBUtility.performTransaction(
            this.database.db,
            this.name,
            'readonly',
            (store) => {
                return IndexedDBUtility.get(store, docId);
            }
        );

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

            const output = await document.objectOutput(includeAttachments);

            // Emit afterGet event
            this.observer._emit('afterGet', output);

            return output;
        } else {
            // Should not happen since metadata indicates the document exists
            return false;
        }
    }

    /**
     * Retrieve multiple documents from the collection.
     * @param {string[]} ids - Array of document IDs to retrieve.
     * @param {string|null} encryptionKey - Encryption key if needed.
     * @param {boolean} withAttachments - Whether to include attachment data.
     * @returns {Promise<object[]>} - Array of document objects.
     */
    async getDocuments(ids, encryptionKey = null, withAttachments = false) {
        const results = [];
        // Filter IDs to those that exist in metadata
        const existingIds = ids.filter(id => id in this.metadataData.documentSizes);

        if (existingIds.length === 0) {
            return results; // Return empty array if no documents exist
        }

        // Retrieve documents
        await IndexedDBUtility.performTransaction(
            this.database.db,
            this.name,
            'readonly',
            async (store) => {
                const getPromises = existingIds.map(id => IndexedDBUtility.get(store, id));
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

                        const output = await document.objectOutput(withAttachments);
                        results.push(output);
                    }
                }
            }
        );

        return results;
    }

    /**
     * Delete a single document from the collection.
     * @param {string} docId - The ID of the document to delete.
     * @param {boolean} force - If true, will delete even if the document is marked as permanent.
     * @returns {Promise<boolean>} - True if the document was deleted, false otherwise.
     */
    async deleteDocument(docId, force = false) {
        const isPermanent = this.permanents[docId] || false;
        if (isPermanent && !force) {
            return false;
        }

        const docExists = docId in this.sizes;

        if (!docExists) {
            return false;
        }

        // Delete attachments if they exist
        const attachmentCount = this.metadata.documentAttachments[docId] || 0;
        if (attachmentCount > 0) {
            await OPFSUtility.deleteAttachments(docId);
        }

        await IndexedDBUtility.performTransaction(
            this.database.db,
            this.name,
            'readwrite',
            (store) => {
                return IndexedDBUtility.delete(store, docId);
            }
        );

        // Update metadata
        this.metadata.deleteDocument(docId);

        // Save metadata
        this.database.metadata.saveMetadata();

        return true;
    }

    /**
     * Delete multiple documents from the collection.
     * @param {string[]} docIds - Array of document IDs to delete.
     * @param {boolean} force - If true, will delete even if documents are marked as permanent.
     * @returns {Promise<number>} - Total space freed in KB.
     */
    async deleteDocuments(docIds, force = false) {
        // Filter out IDs that don't exist or are permanent (if force is false)
        const existingDocIds = docIds.filter(docId => {
            const exists = docId in this.metadataData.documentSizes;
            const isPermanent = this.metadataData.documentPermanent[docId] || false;
            return exists && (force || !isPermanent);
        });

        if (existingDocIds.length === 0) {
            return 0; // No documents to delete
        }

        // Delete attachments for each document
        for (const docId of existingDocIds) {
            const attachmentCount = this.metadata.documentAttachments[docId] || 0;
            if (attachmentCount > 0) {
                await OPFSUtility.deleteAttachments(docId);
            }
        }

        // Get total space to free
        const totalSpaceToFree = existingDocIds.reduce(
            (acc, docId) => acc + this.metadataData.documentSizes[docId],
            0
        );

        // Perform deletion in a single transaction
        await IndexedDBUtility.performTransaction(
            this.database.db,
            this.name,
            'readwrite',
            async (store) => {
                for (const docId of existingDocIds) {
                    store.delete(docId);
                }
            }
        );

        // Update metadata
        this.metadata.deleteDocuments(existingDocIds);

        // Save metadata
        this.database.metadata.saveMetadata();

        return totalSpaceToFree;
    }

    async freeSpace(size) {
        let spaceToFree;
        this.lastFreeSpaceTime = Date.now(); $
        const currentSize = this.sizeKB;

        if (size >= 0) {
            // Positive size indicates maximum total size to keep
            if (currentSize <= size) {
                // No need to free space
                return 0;
            } else {
                spaceToFree = currentSize - size;
            }
        } else {
            // Negative size indicates the amount of space in KB to free
            spaceToFree = -size;
            size = currentSize - spaceToFree;
        }

        // Sort documents by modified time (oldest first), excluding _permanent documents
        const docEntries = Object.entries(this.metadataData.documentModifiedAt)
            .filter(([docId]) => !this.metadataData.documentPermanent[docId])
            .sort((a, b) => a[1] - b[1]); // Ascending order of modified timestamp

        let totalFreed = 0;

        for (const [docId] of docEntries) {
            if(this.sizeKB > size){
                const docSize = this.metadataData.documentSizes[docId];
                totalFreed += docSize;
                await this.deleteDocument(docId, true);
                if (totalFreed >= spaceToFree) {
                    break;
                }
            }
        }

        return totalFreed;
    }

    async query(filter = {}, encryptionKey = null) {
        const results = [];
        await IndexedDBUtility.performTransaction(this.database.db, this.name, 'readonly', async (store) => {
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

                let match = true;
                const object = Object.keys(filter).length ? await document.objectOutput(): null;
                for (const key in filter) {
                    if (object.data[key] !== filter[key]) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    results.push(object ? object: await document.objectOutput());
                }
            });
        });
        return results;
    }
}

class Observer {
    constructor() {
        this._listeners = {
            'beforeAdd': [],
            'afterAdd': [],
            'beforeDelete': [],
            'afterDelete': [],
            'beforeGet': [],
            'afterGet': [],
            // Add more events as needed
        };
    }

    on(event, callback) {
        if (this._listeners[event]) {
            this._listeners[event].push(callback);
        } else {
            throw new Error(`Event "${event}" is not supported.`);
        }
    }

    off(event, callback) {
        if (this._listeners[event]) {
            const index = this._listeners[event].indexOf(callback);
            if (index > -1) {
                this._listeners[event].splice(index, 1);
            }
        }
    }

    _emit(event, ...args) {
        if (this._listeners[event]) {
            for (const callback of this._listeners[event]) {
                callback(...args);
            }
        }
    }
}

var LacertaDB = {
    Database,
    Document
};

module.exports = {LacertaDB: LacertaDB}


