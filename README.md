<h1 align="center" style="margin-top:50px">Welcome to NodeQB </h1>
<p align="center" >
  <a href="https://www.npmjs.com/package/nodeqb" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/nodeqb.svg">
  </a>
  <a href="#" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  </a>
</p>

> Query builder for node mysql. Inspired concept from laravel

<br/>

## Install

```sh
yarn add nodeqb
#or
npm install nodeqb
```


## Usage

```javascript
const NodeQB = require("nodeqb");
//ES6
//import NodeQB from "nodeqb";

const db = new NodeQB({
    type: "mysql", //database type "mysql|mongo" 
    method: "pool", // preferred use pool method
    defaults: {   //optional
        orderColumn: "createdAt" //for default ordering column -> optional
    },
    config: {
        host: 'your-host',
        port: 'your-port',
        database: "your-database",
        user: 'your-username',
        password: 'your-password',
        connectionLimit: 10, //increase connection as per your application
    }
})

```

## Documentation

Maximum all support function from [laravel query builder](https://laravel.com/docs/8.x/queries). 

## How to use 

Replace the `->` and `::` with `.`

**In php laravel** 
```phpt
 DB::table('tableName')->get()
```

**In NodeQB** 

prefer use `table()` call on first. It will reset the previous query value

```javascript
 db.table('tableName').get()
```

## Await / callback

we are supporting both await and callback method

```javascript
//await -> sync method
const result =await db.table('tableName').get();
console.log(result) //you will get result 

//or

//callback async method
db.table('tableName').get((err,results,fields)=>{
   if (err){
      return
   }
   console.log(results) //you will get result
})
```

## Error Handling
You could handle the all error via catch function as well callback

checkout the [Error response object](https://www.npmjs.com/package/mysql#error-handling)

In error object. we have one custom key for detecting error type
```javascript
 err.errorType // "connection"|"query" 
```
* connection -> `connection failure error`
* query      -> `query related errors`

```javascript
//Callback error
db.table('tableName').get((err,results,fields)=>{
   if (err){  
      console.log(err.errorType) //you got the error type
      return
   }
   console.log(results) //you will get result
})

//Catch error for using await
const result =await db.table('tableName').get().catch(err=>{
   if (err){
      console.log(err.errorType) //you got the error type
   }
})
console.log(result) //while got error this undefined

if (result){
   //do stuff here
}
```

## Escape 

>**Note:*** 
All these type of `where`,`having` inputs escaped with mysql escape string method. So no need escape `string/object/callback` inside this method. 
> If you are using escape again in this method maybe you have query error

If you need escape method
```javascript
 db.escapeAll(passYourInput) //supported inputs []|{}|string|number
```



# Methods

**`.getQuery()`**

Get the compiled final query output sql string
```javascript
const query = db.table('tableName').select('colA','colB').getQuery()
console.log(query) 
// SELECT colA,colB FROM tableName
```
---

### GetRows methods


**MultiRow**

`.get()`  `-> await/callback` `=>[]`

returning multiple row array response

**SingleRow**

`.first()` `-> await/callback` `=>{}`

returning single row object response
 ```javascript
 db.table('tableName').first()
//SELECT * FROM tableName LIMIT 1
```
**ForceMethod**

`.getForce` `-> await/callback` `=>[]`
`.getForceSingle` `-> await/callback` `=>{}`


Quick way get the result. This will ignore the unnecessary columns from select. That means filter the table columns names with select columns

>_Purpose of creation `GraphQL`_, we could use this method instead of `select *` on graphql resolver

On below method assume the `mail` column not available on table.While running force method invalid column removed on execution
```javascript
 await db.table('tableName').select('user_email',"mail","user_mobile").getForceSingle()
//SELECT user_email,user_mobile FROM tableName
```
---
>
>Available: _**v3.1.0**-Beta and above_ 

`.forceInsert` `-> await/callback` `=>[]`

`.forceUpdate` `-> await/callback` `=>{}`

same like above method it will ignore unnecessary columns . For below example it will remove the `invalid_col`
```javascript
 await db.table('tableName').forceInsert({ 'user_email':'test@mail' ,"invalid_col":'test val'})
```

## WHERE


**`.where()`,` .orWhere()`,` .having()`,` .orHaving()`**


All below usages are supported above method

Params Methods
* **Single Condition**  `(column,condition,value) or (column,value)`
* **Array** `[Single condition]`
* **Object**        `{column:value} or {"columnWithCondition":value}`
* **Callback**  `(query)=>  query.methods`

**condition**  supported `['>', '<', '>=', '<=', '!=', '=', 'like']`

#### _Single Condition_

```javascript
//Syntax
db.table('tableName').where('columName','condition','value').get()
```

```javascript
//usage
db.table('tableName').where('someColum','>','someValue').get()
//#or
//array method
db.table('tableName').where(['someColum','>','someValue']).get()

//SELECT * FROM tableName WHERE `someColumn` > 'someValue'
```

condition is `=`.No need to add condition just two params if enough

```javascript
db.table('tableName').where('columName','value').get()
//SELECT * FROM tableName WHERE `columName` = 'value'
```

#### _Multi Condition_
You could add the condition on key. All are `AND`
```javascript
db.table('tableName').where({
   columName:"value",
   "columnId>":10,
   "columnName>=":"test"
}).get()

//SELECT * FROM tableName WHERE `columName` = 'value' AND `columnId` > 10 AND `columnName` >= 'test' 
```

#### Callback

```javascript
 db.table("tableName").where("columName","value").where((q)=>{
    return q.where("name","value").orWhere("name",100)
 })
//SELECT * FROM tableName WHERE `columName` = 'value' AND ( `name` = 'value' OR `name` = 100 )
```

 #### AND | OR

```javascript
 db.table("tableName").where('columnName',"value").orWhere("columName",'!=',"value").get()
//SELECT * FROM tableName WHERE `columnName` = 'value' OR `columName` != 'value'
```
**`.whereAnd()`, `.whereOR`**

it just concatenates the string on the chain. very rar case you could use this instead writing raw query

---


## SELECT 


**`.select()`**

```javascript
db.table('tableName').select("colA","colB","colC","colD").get()
//SELECT colA, colB, colC, colD FROM tableName
```

**`.addSelect()`**

```javascript
db.table('tableName').select("colA","colB","colC").addSelect("colD").get()
//SELECT colA, colB, colC, colD FROM tableName
```

**`.distinct()`**

```javascript
db.table('tableName').distinct("colD").get()
//SELECT DISTINCT colD FROM tableName
```

**`.min()`, ` .max()`,` .sum()`,` .avg()`** `-> await`

```javascript
const res =  await db.table('tableName').max("colA");
console.log(res) //received single value response string|number|undefined
```



## Raw Queries

**`.raw()`**
>Better avoid direct raw

Support both formatter and plain string
```javascript
db.raw('select * from tableName').get()
//#or
db.raw('select * from ??',['tableName']).get()

//SELECT * FROM tableName
```

**`.selectRaw(), .whereRaw(), .havingRaw(), .orderByRaw(), .groupByRaw()`**


All below function same for all above methods

```javascript
db.table('tableName').selectRaw("colA as a,ColB as b").get()
//SELECT colA as a,ColB as b FROM tableName
```
**For Better** we recommended to use query formatter instead of raw string. Escape string already included with this method.

You could match the `string|number|{key:value}` 
>Object not support multiple iteration only single key value pair is enough like below example
```javascript
db.table('tableName').whereRaw(" `colA`=? AND ? ",["colValue",{"name":"value"}]).get()

// SELECT * FROM tableName WHERE `colA`='colValue' AND `name` = 'value'
```
>Note * :formatter method in `selectRaw`. Column wrapped with `'`single quote. you have query error. At the time use  `??` instead of the `?`
>>//Error: You have an error in your SQL syntax; check

**Solution**
```javascript
db.table('tableName').selectRaw("?? as name, ?? as email",['user_name','user_email']).get();
//SELECT `user_name` as name, `user_email` as email FROM tableName
```
_if you have any query error you could check and do same like this `??`_

---
## JOINS

**`.join()`,`.letfJoin()`,`.rightJoin()`**

Below snippet functions are same for above methods

```javascript
  //syntax 
  .join("joinTable","joinTable.columnName | function","condition","tableName.columnName")

//usage
 db.table("tableName").join('secTable',"secTable._id","=","tableName.primaryId")
// SELECT * FROM tableName INNER JOIN secTable ON secTable._id = tableName.primaryId 
```

 **Callback** method like where
```javascript
db.table("tableName").join('secTb',(q)=>{
   return q.onJoin('secTb.id','>',"user_id").andJoin("secTb.name","tableName.primaryId")
}).get()
// SELECT * FROM tableName INNER JOIN secTb ON `secTb.id` > 'user_id' AND `secTb.name` = 'tableName.primaryId'
```

`.onJoin()`,` .orJoin()`,`.andJoin()`

Purpose of the method used inside the callback of join methods
```javascript
db.table("tableName").join('secTb',(q)=>{
   return q.onJoin('secTb.id','>',"user_id").andJoin("secTb.name","tableName.primaryId")
}).get()
// SELECT * FROM tableName INNER JOIN secTb ON `secTb.id` > 'user_id' AND `secTb.name` = 'tableName.primaryId'

//#or
db.table("tableName").join('secTb',"tableName.id",'=','secTb.id').orJoin('tableName.name','secTb.name').get()
// SELECT * FROM tableName INNER JOIN secTb ON tableName.id = secTb.id OR `tableName.name` = 'secTb.name'
```

---
## INSERT | UPDATE | DELETE


Result value explanation [click here](https://www.npmjs.com/package/mysql#getting-the-id-of-an-inserted-row)

```typescript
 results = {
   fieldCount: number;
   /**
    * The number of affected rows from an insert, update, or delete statement.
    */
   affectedRows: number;
   /**
    * The insert id after inserting a row into a table with an auto increment primary key.
    */
   insertId: number;
   serverStatus?: number;
   warningCount?: number;
   /**
    * The server result message from an insert, update, or delete statement.
    */
   message: string;
   /**
    * The number of changed rows from an update statement. "changedRows" differs from "affectedRows" in that it does not count updated rows whose values were not changed.
    */
   changedRows: number;
   protocol41: boolean;
}
```

**`.insert()`**  `-> await/callback`

```javascript
//Syntax
.insert(object,callback) 

//async
db.table('tableName').insert({colA:"ColB"},(err, results, fields)=>{
   console.log(results.insertId)
})

//sync
const res =await db.table('tableName').insert({colA:"ColB"})
console.log(res.insertId)
```


**`.insertGetId()`**  `-> await`

you directly get last insert id

```javascript
const res = await db.table('tableName').insertGetId({colA:"ColB"})
console.log(res.insertId)
```

>
> **Warning :*** without `.where` it will affect the entire table


**`.update()`**  `-> await/callback`

Same like insert 

```javascript
//Syntax
.update(object,callback) 

//async
db.table('tableName').where('colB','>',10).update({colA:"ColB"},(err, results, fields)=>{
   console.log(results.affectedRows)
})

//sync
const res =await db.table('tableName').where('colB','>',10).update({colA:"ColB"})
console.log(res.affectedRows)
```

**`.delete()`**  `-> await/callback`

```javascript
//Syntax
.delete(callback) 

//async
db.table('tableName').where("colA",100).delete((err, results, fields)=>{
   console.log(results.affectedRows)
})

//sync
const res =await db.table('tableName').where("colA",100).delete()
console.log(res.affectedRows)
```

---
#### Careful Methods

**`.drop(), .truncate()`**  `-> await/callback`

* drop -> `remove the table/database`
* truncate -> `empty the table/database`

Below snippet functions are same for above methods

```javascript
//Syntax
.drop(callback) 

//async
db.table('tableName').drop((err, results, fields)=>{
   console.log(results)
})

//sync
const res =await db.table('tableName').drop()
console.log(res)
```

### Other getMethods

`.getColumns` -> `await/Callback`=>`[]`
```javascript
const res = db.table('tableName').getColumns()
//res = [{Field:ColumnName},...]
```

***We will update the other documentation soon...***

## Author

 **prasanth**

* Github: [@prasanthreact](https://github.com/prasanthreact)

## Contribute
Got a missing feature you'd like to use? Found a bug? Go ahead and fork this repo, build the feature and issue a pull request.

Feel free [raise a issue](https://github.com/prasanthreact/nodeqb/issues)

## Show your support

Give a ⭐️ if this project helped you!

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
