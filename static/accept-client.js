// Accept Client - code to access the cs-accept server

window.onload = function () {
    getDBstatus() ;
}

function getDBstatus() {
    var url = document.baseURI + "json/dbstatus" ;
    console.log("URL: " + url) ;
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
