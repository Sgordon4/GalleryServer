const express = require('express')
const app = express()
const Joi = require('joi')

const port = process.env.port || 3306

/*
https://www.youtube.com/watch?v=pKd0Rpw7O48
*/


const files = [
    { uid: 1, name: "image"},
    { uid: 2, name: "text"},
    { uid: 3, name: "ribbit"}
]




app.get('/', (req, res) => {
    res.send("Hello World");
});


app.get('/api/files', (req, res) => {
    res.send(files);
});
app.get('/api/files/:id', (req, res) => {
    res.send("Hello World");
});



appendFile.listen(port, () => console.log(`Listening on port ${port}...`))