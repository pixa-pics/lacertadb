# LacertaDB (Version: 0.7.0)

**LacertaDB** - Secure, compressed, client-side storage made simple. (Works better above 0.5.0)

![LacertaDB Javascript Logo](https://raw.githubusercontent.com/pixa-pics/lacertadb/refs/heads/main/lacerta.png)

LacertaDB is a browser-based, high-performance database built on `IndexedDB` with a focus on flexibility, encryption, compression, and automatic metadata synchronization using the faster `LocalStorage`. It is designed to simplify client-side storage for web applications, offering robust features like built-in data security and performance optimizations.

## Key Features

- **Observer**: Observe or listen to collection's operation with handlers.
- **Quick Store Functionality**: When you open a progressive web application, you don't want to rely on indexedDB to load settings such as theme and locales, because it is slow. Instead you access those kind of data from localstorage which has no initialization needed.
- **Automatic Metadata Tracking**: Metadata, including database size, number of documents, and modification times, are updated automatically, keeping your data organized.
- **Compression & Encryption**: Compress data using the browser and encrypt it with it too for secure and efficient storage.
- **Flexible Document Handling**: Supports adding, updating, retrieving, and deleting documents seamlessly.
- **Built-in Collection Management**: Automatically manage and query collections, with automatic synchronization of metadata.
- **Dynamic Metadata Access**: Get metadata like total database size, collection length, or last modification time using simple getters like `db.totalSizeKB` and `collection.length`.
- **Advanced Data Support**: Store complex data types like `TypedArray`, `BigInt`, `Map`, `Set`, `Date`, `Error` and more. Thanks to the [JOYSON](https://www.npmjs.com/package/joyson) serialization module, LacertaDB supports data that JSON doesn't natively handle.

## Installation

Install LacertaDB using npm:

```bash
npm install lacertadb
```

# 📚 Documentation

Welcome to the comprehensive documentation for our Database System\! This guide will help you understand how to create a database, use the quick store, initialize the system, access observers, manage documents, and more.

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
   - [Creating a Database](#creating-a-database)
   - [Initializing the System](#initializing-the-system)
   - [Closing the Database](#closing-the-database)
3. [Quick Store](#quick-store)
   - [What is the Quick Store?](#what-is-the-quick-store)
   - [Using the Quick Store](#using-the-quick-store)
4. [Observer Pattern](#observer-pattern)
   - [Accessing the Observer](#accessing-the-observer)
   - [Using the Observer](#using-the-observer)
5. [Document Structure](#document-structure)
   - [Fields Explanation](#fields-explanation)
   - [Attachments Handling](#attachments-handling)
6. [Document Management](#document-management)
   - [Adding Documents](#adding-documents)
   - [Modifying Documents](#modifying-documents)
   - [Deleting Documents](#deleting-documents)
7. [Collection Management](#collection-management)
   - [Creating a Collection](#creating-a-collection)
   - [Deleting a Collection](#deleting-a-collection)
   - [Accessing Collection Metadata](#accessing-collection-metadata)
8. [Document Class Static Methods](#document-class-static-methods)
   - [Verifying Encrypted Data](#verifying-encrypted-data)
   - [Checking Attachments Retrieval](#checking-attachments-retrieval)
9. [Conclusion](#conclusion)

---

## Introduction

✨ Welcome to the LacertaDB System\! LacertaDB provides a robust and efficient way to manage your data with features like encryption, compression, and attachment handling. It supports asynchronous initialization, observers for event handling, and offers both quick storage and full database capabilities.

---

## Getting Started

### Creating a Database

To create a new database, instantiate the `Database` class:

```javascript
const dbName = 'myDatabase';
const db = new Database(dbName);
```

### Initializing the System

Before using the database, initialize it asynchronously:

```javascript
await db.init();
```

### Closing the Database

When you're done with the database, ensure you close it to release resources:

```javascript
await db.close();
```

---

## Quick Store

### What is the Quick Store?

⚡ **Quick Store** is a special store that can be accessed before asynchronous initialization. It allows you to store and retrieve documents quickly without waiting for the full database to initialize.

### Using the Quick Store

Access the quick store through the `quickStore` property of the `Database` instance:

```javascript
const quickStore = db.quickStore;
```

#### Adding a Document to Quick Store

```javascript
const documentData = { data: { /* your data */ } };
await quickStore.setDocument(documentData);
```

#### Retrieving a Document from Quick Store

```javascript
const docId = 'yourDocumentId';
const document = await quickStore.getDocument(docId);
```

---

## Observer Pattern

### Accessing the Observer

👀 Each `Collection` instance has an `observer` that you can use to listen for events:

```javascript
const collection = await db.getCollection('myCollection');
const observer = collection.observer;
```

### Using the Observer

Subscribe to various events such as `beforeAdd`, `afterAdd`, `beforeDelete`, `afterDelete`, `beforeGet`, and `afterGet`:

```javascript
observer.on('beforeAdd', (documentData) => {
    console.log('About to add:', documentData);
});

observer.on('afterAdd', (documentData) => {
    console.log('Added:', documentData);
});
```

---

## Document Structure

### Fields Explanation

A `Document` in the database system has several fields:

- **`_id`**: *(String)* Unique identifier for the document. If not provided, it is auto-generated.
- **`_created`**: *(Number)* Timestamp of when the document was created.
- **`_modified`**: *(Number)* Timestamp of when the document was last modified.
- **`_permanent`**: *(Boolean)* Indicates if the document is permanent and should not be deleted during free space operations.
- **`_encrypted`**: *(Boolean)* Set to `true` to encrypt the document data.
- **`_compressed`**: *(Boolean)* Set to `true` to compress the document data.
- **`data`**: *(Object)* The actual data content of the document.
- **`attachments`**: *(Array)* An array of attachment file paths associated with the document.

#### Example Document Data

```javascript
const documentData = {
    _id: 'uniqueDocId',
    _permanent: false,
    _encrypted: true,
    _compressed: true,
    data: {
        name: 'Sample Document',
        content: 'This is a sample.'
    },
    attachments: [/* array of file paths or Blob objects */]
};
```

### Attachments Handling

📎 **Attachments** can be added to documents. They are stored separately in the file system and linked via file paths in the `attachments` field.

#### Adding Attachments

When adding attachments, include them in the `attachments` array:

```javascript
const documentData = {
    data: { /* your data */ },
    attachments: [fileBlob1, fileBlob2]
};
await collection.addDocument(documentData);
```

#### Retrieving Attachments

To retrieve attachments along with the document:

```javascript
const document = await collection.getDocument(docId, encryptionKey, true);
const attachments = document.attachments; // Contains Blob objects
```

---

## Document Management

### Adding Documents

To add a document to a collection:

```javascript
const documentData = {
    _encrypted: true, // Set to true to encrypt
    _compressed: true, // Set to true to compress
    data: { /* your data */ },
    attachments: [/* optional attachments */]
};
await collection.addDocument(documentData, 'yourEncryptionKey');
```

### Modifying Documents

To modify a document, add a document with the same `_id`. It will update the existing document:

```javascript
const updatedDocumentData = {
    _id: 'existingDocId',
    data: { /* updated data */ },
    _modified: Date.now()
};
await collection.addDocument(updatedDocumentData);
```

### Deleting Documents

To delete a document:

```javascript
const docId = 'documentId';
const forceDelete = false; // Set to true to delete permanent documents
await collection.deleteDocument(docId, forceDelete);
```

#### Deleting Multiple Documents

```javascript
const docIds = ['docId1', 'docId2'];
await collection.deleteDocuments(docIds);
```

---

## Collection Management

### Creating a Collection

To create a new collection:

```javascript
const collectionName = 'myNewCollection';
const collection = await db.createCollection(collectionName);
```

### Deleting a Collection

To delete an existing collection:

```javascript
const collectionName = 'collectionToDelete';
await db.deleteCollection(collectionName);
```

### Accessing Collection Metadata

You can access metadata about a collection, such as its size, document count, and modification time:

```javascript
const collection = await db.getCollection('myCollection');
const metadata = collection.metadataData;

console.log('Collection Size (KB):', metadata.sizeKB);
console.log('Number of Documents:', metadata.length);
console.log('Last Modified At:', new Date(metadata.modifiedAt));
```

#### Document Metadata

To get metadata about individual documents:

```javascript
const documentsMetadata = collection.documentsMetadata;

documentsMetadata.forEach((docMeta) => {
    console.log('Document ID:', docMeta.id);
    console.log('Size (KB):', docMeta.size);
    console.log('Modified At:', new Date(docMeta.modified));
    console.log('Is Permanent:', docMeta.permanent);
    console.log('Attachment Count:', docMeta.attachment);
});
```

---

## Document Class Static Methods

### Verifying Encrypted Data

🔐 To verify if a document is still encrypted, use the `isEncrypted` static method of the `Document` class:

```javascript
const isEncrypted = Document.isEncrypted(documentData);
```

### Checking Attachments Retrieval

📎 To check if a document has attachments that haven't been retrieved yet, use the `hasAttachments` method:

```javascript
const hasAttachments = Document.hasAttachments(documentData);
```

---

## Conclusion

🎉 You are now ready to use the Database System\! Remember to handle encryption keys securely and manage your documents efficiently. Utilize the observer pattern to react to database events, and leverage the quick store for immediate storage needs.

---

**Note:** All special characters in this documentation are properly escaped using `\\` to ensure correct markdown parsing.

---

# Additional Notes

- **Encryption and Compression**: Setting `_encrypted` to `true` encrypts the document data using the provided encryption key. Similarly, setting `_compressed` to `true` compresses the document data.
- **Attachments**: Attachments are handled using the File System Access API. Ensure you have appropriate permissions to read and write files.
- **Deleting the Database**: To delete the entire database:

  ```javascript
  await db.deleteDatabase();
  ```

- **Observer Events**: Supported events include:

  - `beforeAdd`
  - `afterAdd`
  - `beforeDelete`
  - `afterDelete`
  - `beforeGet`
  - `afterGet`

- **Querying Documents**:

  ```javascript
  const filter = { 'data.name': 'Sample Document' };
  const results = await collection.query(filter, 'yourEncryptionKey');
  ```

- **Handling Permanent Documents**: Documents marked as `_permanent: true` will not be deleted during free space operations unless `force` is set to `true` when deleting.

---

**Happy Coding!**

---

## Usage Example

Below is a quick example demonstrating LacertaDB’s features:

```javascript
import { Database, Document } from "lacertadb";


(async function runExample() {
    // Initialize the database
    const db = new Database("interview");

    // Database instance has a quick store
    // You can use it before initiating the db
    const quickDoc = {
        _id: "settings",
        data: { theme: "light", locales: "fr-CH" },
        _compressed: false,
        _permanent: true,
    };
    await db.quickStore.setDocument(quickDoc);
    const docBack = await db.quickStore.getDocument("settings");
    // You can list the documents inside your quickstore
    // 5MB is the limit for localStorage IN TOTAL
    const docIds = db.quickStore.getAllKeys();
    console.log("QuickStore Document:", docBack);
    console.log("QuickStore Document IDs:", docIds);

    await db.init();

    // Create or get a collection
    const collection = await db.createCollection("humanoids");

    // Create two blobs to add as attachments
    const blob1 = new Blob(["Hello, this is the first blob"], { type: "text/plain" });
    const blob2 = new Blob(["Hello, this is the second blob"], { type: "text/plain" });

    // Add a new document with attachments (returns true if new, false if updated)
    const documentWithAttachments = {
        _id: "doc_with_attachments",
        data: { message: "Document with attachments" },
        _attachments: [
            { id: "attachment1", data: blob1 },
            { id: "attachment2", data: blob2 },
        ],
        _compressed: false,
        _permanent: false,
    };
    const isNewDocument = await collection.addDocument(documentWithAttachments);
    console.log("Document with attachments added (new):", isNewDocument);

    // Retrieve the document by its ID, with attachments
    const retrieved = await collection.getDocument("doc_with_attachments", null, true);
    console.log("Retrieved Document with Attachments:", retrieved);

    // Add another simple document
    await collection.addDocument({ data: "hello" });

    // Retrieve the document by its ID
    const retrievedSimple = await collection.getDocument(quickDoc._id, "password");
    console.log("Retrieved Simple Document:", retrievedSimple);

    // Add multiple documents
    const docs = [];
    for (let i = 0; i < 500; i++) {
        const newDoc = {
            _id: i.toString(16),
            data: { index: i },
            _compressed: true,
            _permanent: false,
        };
        await collection.addDocument(newDoc);
        docs.push(newDoc);
    }

    // Retrieve multiple documents by their IDs
    const retrievedBatch = await collection.getDocuments(["a", "b", "9", "11", "c"]);
    console.log("Retrieved Documents:", retrievedBatch);

    // Query documents based on a field
    const results = await collection.query({ index: 10 });
    console.log("Query Results:", results);

    // Access metadata through getters
    console.log("Total DB Size (KB):", db.totalSizeKB);
    console.log("All IDs in collection:", collection.keys);
    console.log("Collection Document Count:", collection.totalLength);

    // Delete a document (returns true if deleted, false otherwise)
    const isDeleted = await collection.deleteDocument(quickDoc._id);
    console.log("Document deleted:", isDeleted);

    // Close the database when done
    await db.close();
})();
```

## Contributing

We welcome contributions to LacertaDB! Whether it’s a bug report, feature suggestion, or pull request, your input helps improve the library. Open an issue or submit a pull request on the [GitHub repository](https://github.com/pixa-pics/lacertadb).

## Issues and Feature Requests

For any issues, questions, or suggestions, please visit our [GitHub Issues page](https://github.com/pixa-pics/lacertadb/issues) and let us know how we can improve LacertaDB.

---

LacertaDB is designed to make client-side storage secure, efficient, and easy to use. With dynamic metadata management, flexible document handling, and built-in support for encryption and compression, it’s the ideal solution for modern web applications.

## License

This project is licensed under the MIT License.

---

