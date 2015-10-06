// Accept Client - code to access the cs-accept server
// var JSON = require('JSON') ;

window.onload = function () {
    getDBstatus() ;
}

function getDBstatus() {
    var url = "http://127.0.0.1:8080/json/dbstatus" ;
    var request = new XMLHttpRequest() ;
    request.onload = function () {
        if (200 == request.status) {
            q = JSON.parse(request.responseText) ;
            displayDBstatus(q.dbStatus) ;
        } else {
            displayDBstatus("Request Failed.") ;
        }
    } ;
    console.log("Calling: " + url) ;
    request.open("GET", url) ;
    request.send(null) ;
}

function displayDBstatus(text) {
    
    var p = document.getElementById("dbstatus") ;
    p.innerHTML = text ;
}
