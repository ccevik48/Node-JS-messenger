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
    database: "ITXTU"
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

        conn.query("SELECT USERS.Id, Username FROM USERS INNER JOIN CONTACTS ON USERS.Id = CONTACTS.Id WHERE USERS.Id <> " + `${req.session.uid}`, function (err, result) {
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

                    

                    conn.query(`SELECT Id,FromUser,ToUser,Content FROM MESSAGES WHERE FromUser = ${req.session.uid} AND ToUser = ${data.id} OR (FromUser = ${data.id} AND ToUser = ${req.session.uid})`, function (err, result) {
                        // console.log(result)

                        // result.forEach(element => {
                        //     req.session.messages.push(element.Content)
                        // });
                        // console.log("HELLO    "+req.session.contacts)
                        socket.emit('showMsg', { data: data, result: result })
                    })
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






app.get('/about', function (req, res) {
    res.render('about')
});