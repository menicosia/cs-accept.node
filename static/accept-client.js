// Accept Client - code to access the cs-accept server

window.onload = function () {
    getDBstatus() ;
    updateReadURL() ;
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
    var span = document.getElementById("dbstatus") ;
    span.innerHTML = text ;
}

function updateReadURL() {
    var span = document.getElementById("readURL") ;
    var newA = document.createElement("A") ;
    newA.appendChild(document.createTextNode("read")) ;
    newA.text = "/read" ;
    newA.href = document.baseURI = "read" ;
    span.appendChild(newA) ;
}
