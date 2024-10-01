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
const { Database, Document, Collection } = LacertaDB;

(async () => {
(async () => {
    // Initialize the database
    const db = new Database('lacerta');
    await db.init();

    // Create a collection
    const usersCollection = await db.createCollection('users');
    const postsCollection = await db.createCollection('posts');

    // Add a document
    await usersCollection.addDocument({ _id: "primerz", _compressed: true, data: { name: 'Alice', age: 30 } }, "password");

    await postsCollection.addDocument({ _id: "post1", _compressed: true, data: { body: "ioafhnouisf" } });
    await postsCollection.addDocument({ _id: "post1", _compressed: true, data: { body: "ioafhnouisf" } });
    await postsCollection.addDocument({ _id: "post2", _compressed: true, data: { body: "ioafhnouisf" } });
    await postsCollection.addDocument({ _id: "post3", _compressed: true, data: { body: "ioafhnouisf" } });
    await postsCollection.deleteDocument("post2");
    await postsCollection.addDocument({data: "lol"});

    // Query documents
    const user = await usersCollection.getDocument("primerz", "password")
    console.log(user);

    const res = await postsCollection.query()
    console.log(res);

    // Close the database when done
    await db.close();
})();
```

## Why LacertaDB?

LacertaDB stands out as an optimal solution for storing and managing sensitive client-side data.

## Contributing

Contributions are welcome! Please submit issues or pull requests to help improve LacertaDB. 

## License

This project is licensed under the MIT License.

---

**LacertaDB** - Secure, compressed, client-side storage made simple.
