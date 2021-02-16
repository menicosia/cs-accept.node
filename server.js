// core-services acceptance
// A Web app which will allow writing data to p-mysql and/or p-riakcs
//   - test that the services have been installed and configured correctly
//   - a visual way to validate that data is durable across upgrades, etc.
//
// NOTE: To run in local mode, provide a VCAP_SERVICES env variable like this:
// VCAP_SERVICES={"p-mysql":[{"credentials":{"uri":"mysql://user:password@127.0.0.1/latticeDB"}}]}

var finalhandler = require('finalhandler') ;
var http = require('http') ;
var serveStatic = require('serve-static') ;
var strftime = require('strftime') ;
var url = require('url') ;
var util = require('util') ;
var mysql = require('mysql') ;
var fs = require('fs') ;
var bindMySQL = require('./bind-mysql.js') ;

// Variables
var data = "" ;
var activateState = Boolean(false) ;
mysql_data_service = undefined ;
var mysql_creds = {} ;
var vcap_services = undefined ;
var dbClient = undefined ;
var dbConnectState = Boolean(false) ;
var dbConnectTimer = undefined ;
var riakcs_credentials = undefined ;
var riakcsClient = undefined ;
var riakcsConnectionState = Boolean(false) ;

// Setup based on Environment Variables
mysql_creds = bindMySQL.getMySQLCreds() ;
if (mysql_creds) { console.log("Got binding credentials, activating MySQL") ; activateState = Boolean(true) ; }

if (process.env.VCAP_APP_PORT) { var port = process.env.VCAP_APP_PORT ;}
else { var port = 8080 ; }
if (process.env.CF_INSTANCE_INDEX) { var myIndex = JSON.parse(process.env.CF_INSTANCE_INDEX) ; }
else {
    myIndex = 0 ;
    console.log("CF not detected, checking ENV for MYSQL_URL") ;
    if (process.env.MYSQL_URI) {
        mysql_creds["uri"] = process.env.MYSQL_URI ;
        activateState = Boolean(true) ;
    } else {
        console.log("No MYSQL_URI, will run in passive mode till configured,; see /config endpoint.") ;
        activateState = Boolean(false) ;
    }
}
var myInstance = "Instance_" + myIndex + "_Hash" ;

function setupSchema() {
    dbClient.query("show tables LIKE 'SampleData'", function(err, results, fields) {
        if (err) {
            console.error(err) ;
            process.exit(1) ;
        } else {
            if (0 == results.length) {
                util.log("Setting up schema.") ;
                dbClient.query("create table SampleData (K VARCHAR(20) PRIMARY KEY, V VARCHAR(20))",
                               function (err, results, fields) {})
            } else {
                util.log("SampleData table already exists.") ;
            }
        }
    }) ;
}
    
// Callback functions

function handleDBerror(err) {
    if (err) {
        console.warn("Issue with database, " + err.code + ". Attempting to reconnect every 1 second.")
        setTimeout(MySQLConnect, 1000) ;
    }
}

function handleDBConnect(err) {
    if (err) {
        dbConnectState = false ;
        console.error("ERROR: problem connecting to DB: " + err.code +
                      ", will try again every 1 second.") ;
        dbConnectTimer = setTimeout(MySQLConnect, 1000) ;
    } else {
        util.log("Connected to database.") ;
        dbClient.on('error', handleDBerror) ;
        dbConnectState = true ;
        if (dbConnectTimer) {
            clearTimeout(dbConnectTimer) ;
            dbConnectTimer = undefined ;
        }
        setupSchema() ;
    }
}

function handleDBping(request, response, err) {
    if (err) {
        util.log("MySQL Connection error: " + err) ;
        response.end("MySQL connection error: " + err) ;
        dbClient.destroy() ;
        MySQLConnect() ;
    } else {
        response.end("MySQL ping successful.") ;
    }
}

function handleRiakcsConnect(message, err) {
    util.log("handleRiakcsConnect called with message: " + message) ;
    switch (message) {
    case "error":
        riakcsConnectionState = false ;
        util.log("Riakcs connection failed: " + err + "\nWill try again in 3s." ) ;
        setTimeout(RiakcsConnect, 3000) ;
        break ;
    case "ready":
        riakcsConnectionState = true ;
        riakcsClient.hget(myInstance, "lastKeyUpdated", handleLastKey) ;
        riakcsClient.hget(myInstance, "lastUpdate", handleLastTime) ;
        util.log("Riakcs READY.") ;
        break ;
    }
}

        

// Helper functions

function doPing(request, response) {
    dbClient.ping(function (err) {
        handleDBping(request, response, err) ;
    }) ;
}

function doStatus(request, response) {
    dbClient.query("SHOW STATUS LIKE 'Ssl_version'", function (err, results, fields) {
        // FIXME: what happens when the request fails, and request[] is empty?
        response.end(JSON.stringify({"dbStatus": dbConnectState,
                                     "tls-cipher": results[0]["Value"]})) ;
    }) ;
}

function MySQLConnect() {
    if (activateState) {
        console.log("Attempting to connect to MySQL:") ;
        console.log(mysql_creds) ;
        clientConfig = {
            host : mysql_creds["host"],
            user : mysql_creds["user"],
            password : mysql_creds["password"],
            port : mysql_creds["port"],
            database : mysql_creds["database"]
        } ;
        if (mysql_creds["ca_certificate"]) {
            console.log("CA Cert detected; using TLS");
            clientConfig["ssl"] = { ca : mysql_creds["ca_certificate"] } ;
        }
        dbClient = mysql.createConnection( clientConfig ) ;
        dbClient.connect(handleDBConnect) ;
    } else {
        dbClient = undefined ;
    }
}

function sql2json(request, response, error, results, fields) {
    if (error) {
        dbError(response, error) ;
    } else {
        var dataSet = [] ;
        for (var kv in results) {
            dataSet.push( [ results[kv]['K'], results[kv]['V'] ] ) ;
        }
        response.end(JSON.stringify(dataSet)) ;
    }
}

function handleWriteRequest(request, response, error, results, fields) {
    if (error) { dbError(response, error) }
    else {
        response.writeHead(302, {'Location': '/'}) ;
        response.end()
    }
    return(true) ;
}

function dbError(response, error) {
    console.error("ERROR getting values: " + error) ;
    response.end("ERROR getting values: " + error) ;
}
    
function errorDbNotReady(response) {
    errHTML = "<title>Error</title><H1>Error</H1>\n"
    errHTML += "<p>Database info is not set or DB is not ready<br>\n" ;
    errHTML += "<hr><A HREF=\"/dbstatus\">/dbstatus</A>\n" ;
    response.end(errHTML) ;
}

function readTable(request, response, table, callBack) {
    if (activateState && dbConnectState) {
        dbClient.query('SELECT K, V from ' + table + ' ORDER BY V ASC',
                       function (error, results, fields) {
                           callBack(request, response, error, results, fields) ;
                       }) ;
    } else {
        errorDbNotReady(response) ;
    }
}

function writeSomething(request, response, key) {
    if (activateState && dbConnectState) {
        var timeStamp = strftime("%Y-%m-%d %H:%M") ;
        var sql = "insert into SampleData VALUES ('" + key + "','" + timeStamp + "')" ;
        console.log("SQL: " + sql ) ;
        dbClient.query(sql, function (error, results, fields) {
            handleWriteRequest(request, response, error, results, fields) ;
        }) ;
    } else {
        errorDbNotReady(response) ;
    }
}

function dispatchApi(request, response, method, query) {
    switch (method) {
    case "dbstatus":
        if (dbConnectState) {
            doStatus(request, response) ;
        } else {
            data += "I'm sorry, Dave, I can't do that. No connection to database." ;
            response.end(data) ;
        }
        break ;
    case "read":
        if (query["table"]) {
            util.log("Received request to read table: " + query["table"]) ;
            readTable(request, response, query["table"], sql2json) ;
        } else {
            response.end("ERROR: Usage: /json/read?table=name"
                         + " (request: " + request.url + ")") ;
        }
        break ;
    default:
        response.writeHead(404) ;
        response.end(false) ;
    }
    
}

function requestHandler(request, response) {
    var data = "" ;
    requestParts = url.parse(request.url, true) ;
    rootCall = requestParts["pathname"].split('/')[1] ;
    util.log("Recieved request for: " + rootCall) ;
    switch (rootCall) {
    case "env":
	      if (process.env) {
	          data += "<p>" ;
		        for (v in process.env) {
		            data += v + "=" + process.env[v] + "<br>\n" ;
		        }
		        data += "<br>\n" ;
	      } else {
		        data += "<p> No process env? <br>\n" ;
	      }
        response.end(data) ;
        break ;
    case "json":
        var method = requestParts["pathname"].split('/')[2] ;
        dispatchApi(request, response, method, requestParts["query"]) ;
        return(true) ;
        break ;
    case "dbstatus":
        if (dbConnectState) {
            doStatus(request, response) ;
        } else {
            data += "I'm sorry, Dave, I can't do that. No connection to database." ;
            response.end(data) ;
        }
        break ;
    case "ping":
        if (dbConnectState) {
            doPing(request, response) ;
        } else {
            data += "I'm sorry, Dave, I can't do that. No connection to database." ;
            response.end(data) ;
        }
        break ;
    case "write":
        if (requestParts["query"]["key"]) {
            util.log("Received request to write key: " + requestParts["query"]["key"]) ;
            writeSomething(request, response, requestParts["query"]["key"]) ;
        } else {
            response.end("ERROR: Usage: /write?key=foo"
                         + "(request: " + request.url  + ")") ;
        }
        return(true) ;
        break ;
    case "config":
        rp = requestParts["query"] ;
        if ("query" in requestParts
            && "db_host" in rp && "db_DB" in rp
            && "db_user" in rp && "db_pw" in rp) {
                console.log("Received DB connection info: " + rp["db_host"]) ;
            mysql_creds["host"] = rp["db_host"] ;
            mysql_creds["database"] = rp["db_DB"] ;
            mysql_creds["user"] = rp["db_user"] ;
            mysql_creds["password"] = rp["db_pw"] ;
            mysql_creds["port"] = "3306" ;
            if ("ca" in rp && "" != rp["ca"]) {
                console.log("Defining CA...") ;
                mysql_creds["ca_certificate"] = rp["ca"];
            }

            activateState = Boolean(true) ;
            MySQLConnect() ;
            response.writeHead(302, {'Location': '/'});
            response.end();
        } else {
            response.end("ERROR: Usage: /config?db_host=127.0.0.1&db_DB=myDB&db_user=mysql&db_pw=REDACTED"
                         + "(request: " + request.url + ")\n") ;
        }
        return(true) ;
    default:
        response.writeHead(404) ;
        response.end("404 - not found") ;
    }
}

// MAIN

if (activateState) {
    MySQLConnect() ;
}
    
var staticServer = serveStatic("static") ;
monitorServer = http.createServer(function(req, res) {
    var done = finalhandler(req, res) ;
    staticServer(req, res, function() {requestHandler(req, res, done)}) ;
}) ;

monitorServer.listen(port) ;

util.log("Server up and listening on port: " + port) ;
