# LacertaDB (Version: 0.5.0)

**LacertaDB** - Secure, compressed, client-side storage made simple. (Works better above 0.5.0)

![LacertaDB Javascript Logo](https://raw.githubusercontent.com/pixa-pics/lacertadb/refs/heads/main/lacerta.png)

LacertaDB is a browser-based, high-performance database built on `IndexedDB` with a focus on flexibility, encryption, compression, and automatic metadata synchronization using the faster `LocalStorage`. It is designed to simplify client-side storage for web applications, offering robust features like built-in data security and performance optimizations.

## Key Features

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

## Usage Example

Below is a quick example demonstrating LacertaDB’s features:

```javascript
import { Database, Document } from "lacertadb";


(async function runExample() {
    // Initialize the database
    const db = new Database("interview");
    
    // Database instance have a quick store
    // You can use it before initiating the db
    const docSetting = { _id: "settings", data: {theme: "light", locales: "fr-CH"}, _compressed: false, _permanent: true };
    await db.quickStore.setDocument(docSetting);
    const docBack = await db.quickStore.getDocument("settings");
    // You can list the documents inside your quickstore
    // 5MB is the limit for localstorage IN TOTAL
    const docIds = db.quickStore.getAllKeys();
    console.log(docBack, docIds)
    
    await db.init();

    // Create or get a collection
    const collection = await db.createCollection("humanoids", {limitSizeKB: 100 * 1024});

    // Add a new document (returns true if new, false if updated)
    const doc = {_id:"myAccount",data:{id:28,name:"steemit",owner:{weight_threshold:1,account_auths:[],key_auths:[["STM6Ezkzey8FWoEnnHHP4rxbrysJqoMmzwR2EdoD5p7FDsF64qxbQ",1],["STM7TCZKisQnvR69CK9BaL6W4SJn2cXYwkfWYRicoVGGzhtFswxMH",1]]},active:{weight_threshold:1,account_auths:[],key_auths:[["STM5VkLha96X5EQu3HSkJdD8SEuwazWtZrzLjUT6Sc5sopgghBYrz",1],["STM7u1BsoqLaoCu9XHi1wjWctLWSFCuvyagFjYMfga4QNWEjP7d3U",1]]},posting:{weight_threshold:1,account_auths:[],key_auths:[["STM6kXdRbWgoH9E4hvtTZeaiSbY8FmGXQavfJZ2jzkKjT5cWYgMBS",1],["STM6tDMSSKa8Bd9ss7EjqhXPEHTWissGXJJosAU94LLpC5tsCdo61",1]]},memo_key:"STM5jZtLoV8YbxCxr4imnbWn61zMB24wwonpnVhfXRmv7j6fk3dTH",json_metadata:"",proxy:"",last_owner_update:"2018-05-31T23:32:06",last_account_update:"2018-05-31T23:32:06",created:"2016-03-24T17:00:21",mined:!0,recovery_account:"steem",last_account_recovery:"1970-01-01T00:00:00",reset_account:"null",comment_count:0,lifetime_vote_count:0,post_count:1,can_vote:!0,voting_manabar:{current_mana:"69835912701503862",last_update_time:1538171805},balance:{amount:"2806644634",precision:3,nai:"@@000000021"},savings_balance:{amount:"0",precision:3,nai:"@@000000021"},sbd_balance:{amount:"8716535",precision:3,nai:"@@000000013"},sbd_seconds:"0",sbd_seconds_last_update:"2018-11-12T02:39:39",sbd_last_interest_payment:"2018-11-12T02:39:39",savings_sbd_balance:{amount:"0",precision:3,nai:"@@000000013"},savings_sbd_seconds:"0",savings_sbd_seconds_last_update:"1970-01-01T00:00:00",savings_sbd_last_interest_payment:"1970-01-01T00:00:00",savings_withdraw_requests:0,reward_sbd_balance:{amount:"0",precision:3,nai:"@@000000013"},reward_steem_balance:{amount:"0",precision:3,nai:"@@000000021"},reward_vesting_balance:{amount:"0",precision:6,nai:"@@000000037"},reward_vesting_steem:{amount:"0",precision:3,nai:"@@000000021"},vesting_shares:{amount:"90039851836689703",precision:6,nai:"@@000000037"},delegated_vesting_shares:{amount:"20203939135185841",precision:6,nai:"@@000000037"},received_vesting_shares:{amount:"0",precision:6,nai:"@@000000037"},vesting_withdraw_rate:{amount:"0",precision:6,nai:"@@000000037"},next_vesting_withdrawal:"1969-12-31T23:59:59",withdrawn:0,to_withdraw:0,withdraw_routes:0,curation_rewards:0,posting_rewards:3548,proxied_vsf_votes:["14953279511",0,0,0],witnesses_voted_for:0,last_post:"2016-03-30T18:30:18",last_root_post:"2016-03-30T18:30:18",last_vote_time:"2016-12-04T23:10:57",post_bandwidth:0,pending_claimed_accounts:0,is_smt:!1},_compressed:!0,_permanent:!0};
    
    const isNewDocument = await collection.addDocument(doc, "password");
    console.log("Document added (new):", isNewDocument);
    await collection.addDocument({data: "hello"});

    // Retrieve the document by its ID
    const retrieved = await collection.getDocument(doc._id, "password");
    console.log("Retrieved Document:", retrieved);

    const docs = new Array(50);
    for(let i = 0; i < 50; i++){
        docs[i] = Object.assign(doc, {_id: ""+i.toString(16), _compressed: true, _permanent: true});
        await collection.addDocument(docs[i]);
    }

    // Retrieve the document by its ID
    const retrievedBatch = await collection.getDocuments(["a", "b", "9", "11", "c"]);
    console.log("Retrieved Documents:", retrievedBatch);

    // Query documents based on a field
    const results = await collection.query();
    console.log("Query Results:", results);

    // Access metadata through getters
    console.log("Total DB Size (KB):", db.totalSizeKB);
    console.log("All id in collection", collection.keys);
    console.log("Collection Document Count:", collection.totalLength);

    // Delete a document (returns true if deleted, false otherwise)
    const isDeleted = await collection.deleteDocument(doc._id);
    console.log("Document deleted:", isDeleted);

    // Close the database when done
    await db.close();
})()
```

## API Overview

LacertaDB provides a rich API to manage your data with ease:

- **Database**:
    - `quickStore`: Access DB root document before init.
    - `init()`: Initialize the database.
    - `createCollection(collectionName)`: Creates or retrieves a collection.
    - `getCollection(collectionName)`: Retrieves a collection.
    - `deleteDatabase()`: Deletes the entire database.
    - **Getters**: `totalSizeKB`, `totalLength`, `modifiedAt`.

- **Collection**:
    - `addDocument(doc, password)`: Adds a new document or updates an existing one and eventually encrypt it.
    - `getDocument(id, password)`: Retrieves a document by its ID and optionaly decrypt it.
    - `deleteDocument(id)`: Deletes a document by its ID.
    - `deleteDocuments(ids)`: Deletes documents by their IDs.
    - `query(filter)`: Queries documents by fields (slow).
    - **Getters**: `length`, `sizeKB`, `modifiedAt`.

- **Document**:
    - `objectOutput()`: Returns the document in a readable format.
    - `databaseOutput()`: Returns the document in a format ready for storage.
    
- **QuickStore**:
    - `getDocument()`: Returns the document in a readable format.
    - `deleteDocument()`: Deletes a document by its ID.
    - `getAllKeys()`: Return a list of document's IDs.

> You nearly never use `new Document()`, except for the static methods: `Document.isEncrypted()` and `Document.decryptDocument` which you can call after getDocument if you didn't yet provided the password. Collection are always returned from the Database (class) instanciated object, so you don't have to use `new Collection()` but when using a DB you need to create an instance so you need to call the class with the keyword `new`!

## Contributing

We welcome contributions to LacertaDB! Whether it’s a bug report, feature suggestion, or pull request, your input helps improve the library. Open an issue or submit a pull request on the [GitHub repository](https://github.com/pixa-pics/lacertadb).

## Issues and Feature Requests

For any issues, questions, or suggestions, please visit our [GitHub Issues page](https://github.com/pixa-pics/lacertadb/issues) and let us know how we can improve LacertaDB.

---

LacertaDB is designed to make client-side storage secure, efficient, and easy to use. With dynamic metadata management, flexible document handling, and built-in support for encryption and compression, it’s the ideal solution for modern web applications.

## License

This project is licensed under the MIT License.

---

