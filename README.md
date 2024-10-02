# LacertaDB (Version: 0.4.0)

**LacertaDB** - Secure, compressed, client-side storage made simple. (Only works from the verion 0.4.0)

![LacertaDB Javascript Logo](https://raw.githubusercontent.com/pixa-pics/lacertadb/refs/heads/main/lacerta.png)

LacertaDB is a browser-based, high-performance database built on `IndexedDB` with a focus on flexibility, encryption, compression, and automatic metadata synchronization using the faster `LocalStorage`. It is designed to simplify client-side storage for web applications, offering robust features like built-in data security and performance optimizations.

## Key Features

- **Automatic Metadata Tracking**: Metadata, including database size, number of documents, and modification times, are updated automatically, keeping your data organized.
- **Compression & Encryption**: Compress data using Snappy and encrypt it with Triplesec for secure and efficient storage.
- **Flexible Document Handling**: Supports adding, updating, retrieving, and deleting documents seamlessly.
- **Built-in Collection Management**: Automatically manage and query collections, with automatic synchronization of metadata.
- **Dynamic Metadata Access**: Get metadata like total database size, collection length, or last modification time using simple getters like `db.totalSizeKB` and `collection.length`.
- **Advanced Data Support**: Store complex data types like `TypedArray`, `BigInt`, `Map`, `Set`, `Date`, `Error` and more. Thanks to the [JOYSON](https://www.npmjs.com/package/joyson) serialization module, LacertaDB supports data that JSON doesn't natively handle.

## Installation

Install LacertaDB using npm:

```bash
npm install lacertadb
```

## Usage Example

Below is a quick example demonstrating LacertaDB’s features:

```javascript
import { Database } from "lacertadb";

async function runExample() {
    // Initialize the database
    const db = new Database("MyDatabase");
    await db.init();

    // Create or get a collection
    const collection = await db.createCollection("MyCollection");

    // Add a new document (returns true if new, false if updated)
    const doc = { data: { name: "Alice", age: 30 }, _compressed: true, _encrypted: false };
    const isNewDocument = await collection.addDocument(doc);
    console.log("Document added (new):", isNewDocument);

    // Retrieve the document by its ID
    const retrieved = await collection.getDocument(doc._id);
    console.log("Retrieved Document:", retrieved);

    // Query documents based on a field
    const results = await collection.query({ age: 30 });
    console.log("Query Results:", results);

    // Access metadata through getters
    console.log("Total DB Size (KB):", db.totalSizeKB);
    console.log("Collection Document Count:", collection.length);

    // Delete a document (returns true if deleted, false otherwise)
    const isDeleted = await collection.deleteDocument(doc._id);
    console.log("Document deleted:", isDeleted);

    // Close the database when done
    await db.close();
}

runExample().catch(console.error);
```

## API Overview

LacertaDB provides a rich API to manage your data with ease:

- **Database**:
    - `init()`: Initialize the database.
    - `createCollection(collectionName)`: Creates or retrieves a collection.
    - `getCollection(collectionName)`: Retrieves a collection.
    - `deleteDatabase()`: Deletes the entire database.
    - **Getters**: `totalSizeKB`, `totalLength`, `modifiedAt`.

- **Collection**:
    - `addDocument(doc)`: Adds a new document or updates an existing one.
    - `getDocument(id)`: Retrieves a document by its ID.
    - `getDocuments(ids)`: Retrieves documents by their IDs.
    - `deleteDocument(id)`: Deletes a document by its ID.
    - `deleteDocuments(ids)`: Deletes documents by their IDs.
    - `query(filter)`: Queries documents by fields (slow).
    - **Getters**: `length`, `totalSizeKB`, `modifiedAt`.

- **Document**:
    - `objectOutput()`: Returns the document in a readable format.
    - `databaseOutput()`: Returns the document in a format ready for storage.

> You nearly never use `new Document()`, except for the static methods: `Document.isEncrypted()` and `Document.decryptDocument`. Collection are always returned from the Database (class) instanciated object, so you don't have to use `new Collection()` but when using a DB you need to create an instance so you need to call the class with the keyword `new`!

## Contributing

We welcome contributions to LacertaDB! Whether it’s a bug report, feature suggestion, or pull request, your input helps improve the library. Open an issue or submit a pull request on the [GitHub repository](https://github.com/pixa-pics/lacertadb).

## Issues and Feature Requests

For any issues, questions, or suggestions, please visit our [GitHub Issues page](https://github.com/pixa-pics/lacertadb/issues) and let us know how we can improve LacertaDB.

---

LacertaDB is designed to make client-side storage secure, efficient, and easy to use. With dynamic metadata management, flexible document handling, and built-in support for encryption and compression, it’s the ideal solution for modern web applications.

## License

This project is licensed under the MIT License.

---

