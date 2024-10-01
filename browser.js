var LacertaDB = require("./index.js").LacertaDB;
if(typeof window !== "undefined"){
    window.LacertaDB = LacertaDB;
}else {
    self.LacertaDB = LacertaDB;
}
