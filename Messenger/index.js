var express = require('express');
var app = express();
var serv = require('http').Server(app);
var mysql = require('mysql');
var session = require('express-session');
var bodyParser = require('body-parser');
const EventEmitter = require('events');
// var socket = require('socket.io')
const emitter = new EventEmitter()
emitter.setMaxListeners(0)


const conn = mysql.createConnection({
    host: "localhost",
    user: "<USERNAME GOES HERE>",
    password: "<DATABASE PASSWORD GOES HERE>",
    database: "<DATABASE NAME GOES HERE>"
})
conn.connect(function (err) {
    if (err) { console.log("err"); }
    else { console.log("connection to database started") }
})


const PORT = process.env.PORT || 2000;
serv.listen(PORT);
console.log('server started');

app.use('/client', express.static(__dirname + '/client'));
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.set('views', __dirname + '/views');
app.use(session({ secret: 'XASDASDA', resave: true, saveUninitialized: true, name: 'JSESSION' }));
app.use(bodyParser.urlencoded({ extended: true }));


app.get('/', function (req, res) {
    console.log(req.session.cnames)
    res.render('index')
});


app.get('/login', function (req, res) {
    if (req.session.uid) { res.redirect('profile') }
    else { res.render('login') }
});

app.post('/login', function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    //console.log(req.body);
    conn.query("SELECT * FROM `USERS` WHERE `Username` = " + `'${req.body.username}' AND ` + "`Password` = " + `'${req.body.password}'`, function (err, result, fields) {
        if (err) {
            console.log("error, sign in failed");
            res.render('login')
        }
        if (result === undefined || result.length < 1) { res.render('login') }
        else if (result.length > 0) {
            //console.log(result);
            req.session.username = username;
            req.session.loggedin = true;
            req.session.uid = result[0].Id
            res.redirect('profile')
        }
    })
});

app.get('/profile', function (req, res) {
    if (!req.session.loggedin) { res.redirect('login') }
    else {
        conn.query("SELECT `CONN_USER` FROM `CONTACTS` WHERE `MAIN_USER` = " + `${req.session.uid}`, function (err, result) {
            //console.log(result)
            req.session.contacts = [];
            result.forEach(element => {
                req.session.contacts.push(element)
            });
            // console.log("HELLO    "+req.session.contacts) 
            res.render('profile', { sess: req.session, result: result })
        })
        //res.render('profile',{sess: req.session})
    }
})

app.get('/logout', function (req, res) {
    req.session.destroy(function (err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect('/');
        }
    })
})

app.get('/messages', function (req, res) {
    if (!req.session.loggedin) { res.redirect('login') }
    else {

        req.session.cnames = []

        conn.query("SELECT USERS.Id, Username FROM USERS INNER JOIN CONTACTS ON USERS.Id = CONTACTS.MAIN_USER WHERE CONTACTS.CONN_USER = " + `${req.session.uid}`, function (err, result) {
            console.log(result)

            result.forEach(element => {
                req.session.cnames.push(element)
            });

            var io = require('socket.io')(serv, {});
            io.sockets.on('connection', function (socket) {

                // setInterval(function(){
                //     socket.emit('hello', {msg:'message'})
                // },2000)

                socket.on('getMsg', function (data) {

                    
                    // setInterval(()=> {
                    //     conn.query(`SELECT FromUser,ToUser,Content FROM MESSAGES WHERE FromUser = ${req.session.uid} AND ToUser = ${data.id} OR (FromUser = ${data.id} AND ToUser = ${req.session.uid})`, function (err, result) {    
                    //         // result.forEach(element => {
                    //         //     req.session.messages.push(element.Content)
                    //         // });
                    //         // console.log("HELLO    "+req.session.contacts)
                    //         socket.emit('showMsg', { data: data, result: result })
                    //     })
                    // }, 1000)

                    

                    conn.query(`SELECT Id,FromUser,ToUser,Content,Time FROM MESSAGES WHERE FromUser = ${req.session.uid} AND ToUser = ${data.id} OR (FromUser = ${data.id} AND ToUser = ${req.session.uid})`, function (err, result) {
                        // console.log(result)

                        // result.forEach(element => {
                        //     req.session.messages.push(element.Content)
                        // });
                        // console.log("HELLO    "+req.session.contacts)
                        socket.emit('showMsg', { data: data, result: result })
                    })
                })


                socket.on('newChat', function(name){
                    console.log(name)
                    conn.query(`SELECT Id,Username FROM USERS WHERE Username = '${name.name}'`,function(err, result){
                        if (err) {
                            console.log("err");
                        }
                        if(result.length > 0) {
                            console.log(result)
                            var rid = result[0].Id
                            req.session.cnames.push(result[0])
                            console.log(req.session.cnames)
                            conn.query(`INSERT INTO CONTACTS (MAIN_USER, CONN_USER) VALUES (${req.session.uid}, ${result[0].Id}),(${result[0].Id}, ${req.session.uid});`, function(err, result){
                                // console.log(result)
                                // socket.emit('newChatAdded',{name: name.name, id: rid})
                            })
                            socket.emit('newChatAdded',{name: name.name, id: rid})
                        }
                        else {
                            console.log("no user exists")
                        }
                    })
                })


                socket.on('getNames', function(){
                    socket.emit('listContacts', {data: req.session.cnames})
                })




                socket.on('messageData', function ({data, toId}) {
                    // console.log("put " + data + "into "+ toId)
                    conn.query(`INSERT INTO MESSAGES (Content, Time, FromUser, ToUser) VALUES ('${data}', NOW(), ${req.session.uid}, ${toId});`,function(err, result) {

                    })
                })


            })


            res.render('messages', { sess: req.session })
        })

        // res.render('messages',{sess: req.session})
    }
})



app.get('/signup', function (req, res) {
    res.render('signup')
});


app.post('/signup', function (req, res) {
    var username = req.body.username;
    var email = req.body.email
    var password = req.body.password;

    conn.query(`SELECT * FROM USERS WHERE Username = '${username}' OR Email = '${email}'`, function(err, result){
        if (err) {
            console.log("error, signup failed");
            res.render('signup')
        }
        if(result.length > 0) {
            console.log(result)
            res.render('signup')
        }
        else {
            conn.query(`INSERT INTO USERS (Username, Email, Password) VALUES ('${username}', '${email}', '${password}');`, function(err, result){
                res.redirect('login')

            })
        }
    })
    // console.log(username, password)
    // res.redirect('login')
});







app.get('/about', function (req, res) {
    res.render('about')
});