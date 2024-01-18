const http = require('http')
const port = 3306


const server = http.createServer(function(req, res) {
    res.write("Hello node")
    res.end();
})

server.listen(port, function(error) {
    if(error) 
        console.log("Something went wrong", error)
    else 
        console.log("server is listening on port "+port)
    
})