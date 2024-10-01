# LacertaDB

![LacertaDB Javascript Logo](https://raw.githubusercontent.com/pixa-pics/lacertadb/refs/heads/main/lacerta.png)

LacertaDB is a lightweight, privacy-focused database system built on top of IndexedDB for fast, encrypted, and compressed storage of structured data. Designed for client-side applications, LacertaDB optimizes metadata management, providing developers with efficient mechanisms for working with encrypted, compressed, and persistent data.

LacertaDB is perfect for use cases where sensitive data needs to be stored securely on the client side, such as login information, private user data, or application-specific metadata.

## Key Features

- **Private Metadata Management**: LacertaDB ensures metadata is securely stored and cached using the `PrivateDatabaseManager`, keeping your data safe.
- **Encryption & Compression**: Integrated with encryption (using Triplesec) and compression (via Snappy), LacertaDB ensures your data is both secure and optimized for storage efficiency.
- **Flexible Document Storage**: Store structured data using collections, with support for querying, updating, and deleting documents.
- **Auto-Syncing**: Automatic syncing of metadata ensures consistency across your application without manual intervention.
- **Granular Control**: Control document encryption, compression, persistence, and metadata updates for fine-tuned data management.

## Installation

You can install LacertaDB through npm:

```bash
npm install lacertadb
```

## Basic Usage

```javascript
const { LacertaDB } = require('lacertadb'); // window.LacertaDB
const { PrivateDatabaseManager, Database, Document } = LacertaDB;

(async () => {
    // Initialize the private database manager
    const privateDbManager = new PrivateDatabaseManager();
    await privateDbManager.init();

    // Create or open a new database
    const db = new Database('my-database', privateDbManager);
    await db.init();

    // Create a collection
    await db.createCollection('users');

    // Get the collection instance
    const usersCollection = await db.getCollection('users');

    // Add a document
    await usersCollection.addDocument({ _id: "login", _permanent: true, data: { name: new Uint8Array(9) } }, "hello");
    await usersCollection.addDocument({ _id: "him", _compressed: true, data: { name: 'John Doe', email: 'john@example.com' } });

    // Query the collection
    const queryResult = await usersCollection.getDocument("him");
    console.log(queryResult);

    // Delete a document
    await usersCollection.deleteDocument("him");

    // Query the collection again
    const queryResult2 = await usersCollection.query();
    console.log(queryResult2);

    // Retrieve and decrypt an encrypted document
    const ciphered = await usersCollection.getDocument("login");
    const deciphered = await Document.decryptDocument(ciphered, "hello");
    console.log(ciphered, deciphered);

    // Delete the collection
    await db.deleteCollection('users');

    // Delete the entire database
    await db.deleteDatabase();
})();
```

## Why LacertaDB?

LacertaDB stands out as an optimal solution for storing and managing sensitive client-side data. Here’s why:

### 1. **Client-Side Privacy & Security**
   - **Encryption**: All sensitive documents can be encrypted using strong encryption algorithms to ensure that even if unauthorized access is gained, the data remains unreadable.
   - **Compression**: LacertaDB reduces the storage footprint with integrated compression using Snappy, ensuring faster data retrieval while saving space.

### 2. **Efficient Data Management**
   - **IndexedDB Power**: LacertaDB leverages the native IndexedDB API to provide persistent, asynchronous storage for large amounts of structured data.
   - **Optimized Transactions**: All database operations are done through efficient, retry-enabled transactions, ensuring data integrity and robustness even in challenging environments.

### 3. **Fine-Grained Control**
   - Control how your data is stored with options to encrypt, compress, and set documents as permanent (non-deletable).
   - Metadata caching ensures that frequent operations are faster and that your data is in sync across operations.

### 4. **Advanced Query Capabilities**
   - **Search & Retrieval**: Query documents within a collection with ease. Retrieve documents by `_id` or search through all documents with filters.
   - **Sorting and Versioning**: Ensure you're working with the latest version of your documents, and sort them by modification date or any other property.

### 5. **Flexible Use Cases**
   - **User Data Management**: Perfect for storing encrypted user credentials or session data.
   - **Local Data Caching**: Cache large amounts of compressed data locally, reducing server-side load while maintaining privacy.
   - **Offline First Applications**: Ideal for offline-first web apps that require robust, persistent data storage.

## API Reference

### `PrivateDatabaseManager`
Manages the secure storage and retrieval of metadata related to the database.

#### Methods:
- **`init()`**: Initializes the private database manager.
- **`updateDatabaseMetadata(dbName, metadata)`**: Updates metadata for a given database.
- **`getDatabaseMetadata(dbName)`**: Retrieves metadata for a specific database.
- **`destroy()`**: Deletes the private metadata database.

### `Database`
Represents an IndexedDB instance. Manages collections and documents.

#### Methods:
- **`init()`**: Initializes the database.
- **`createCollection(collectionName)`**: Creates a new collection in the database.
- **`getCollection(collectionName)`**: Retrieves a collection instance.
- **`deleteCollection(collectionName)`**: Deletes a collection from the database.
- **`deleteDatabase()`**: Deletes the entire database.

### `Collection`
Represents a collection of documents within a database.

#### Methods:
- **`addDocument(document, encryptionKey)`**: Adds a document to the collection. Supports encryption with an optional key.
- **`deleteDocument(docId)`**: Deletes a document by its `_id`.
- **`getDocument(docId)`**: Retrieves a document by its `_id`.
- **`query(filter)`**: Queries the collection using an optional filter.

### `Document`
Represents a document stored in a collection.

#### Methods:
- **`decryptDocument(document, encryptionKey)`**: Decrypts a document using the provided key.
- **`pack()`**: Compresses and encrypts document data for storage.
- **`unpack()`**: Decrypts and decompresses document data for use.

## Testing and Extending

LacertaDB provides extensive flexibility for customization and testing. You can create additional collections, run batch document updates, and test encryption features for different use cases.

- **Batch Operations**: Easily handle bulk document uploads or deletions.
- **Compression Efficiency**: Test compression and retrieval times for large datasets.
- **Offline Functionality**: Simulate offline scenarios to ensure seamless operation with cached data.

## Contributing

Contributions are welcome! Please submit issues or pull requests to help improve LacertaDB. 

## License

This project is licensed under the MIT License.

---

**LacertaDB** - Secure, compressed, client-side storage made simple.
