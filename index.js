const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');

const bodyParser  = require('body-parser')
const cors = require('cors')
const http = require('http')
const socketIo = require("socket.io");

const auth = require('./authentication.js')

const getClient = require('./getClient.js')

const port = process.env.port;


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    // origin: allowedDomains, -- To only allow same as Express seems to work need to check later
    // methods: ["GET", "POST"]
  },
  transports: ['websocket']
  });




  require("./socketAuth.js")(io); //Adds tokenkey to socket
  io.on("connection", (socket) => {
    console.log("New client connected "  + socket.id);
    socket.data.authorized = false;
    require('./socket.js')(socket, io);
  });




app.use(cors())
app.use(express.json());
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())





// app.post('/register', async (req, res) => {
//   let client;
//     try {
//         client = await getClient();
//         const result = await client.db(process.env.DATABASE_NAME).collection("users").findOne({username: req.body.username})
//         if (result) {
//             const err = new Error('Email Taken!')
//             err.status = 400;
//             throw err;
//         }
//         const user = {
//             username: req.body.username,
//             password: await bcrypt.hash(req.body.password, 12),
//         }

//         await client.db(process.env.DATABASE_NAME).collection("users").insertOne(user)

//         res.status(201).json({
//           status: 'success',
//           message: 'User Registered!',
//           data: {
//             user: {
//                 email: user.username,
//             },
//           },
//         });

//     } catch (err) {
//         res.status(err.status).json({
//             status: 'fail',
//             message: err.message,
//           });
//     }
//     finally {
//         await client.close();
//     }
// });

app.post('/login', async (req, res) => {
  let client;
    try {
        client = await getClient();
        const user = await client.db(process.env.DATABASE_NAME).collection("users").findOne({username: req.body.username})
        if (!user) {
            const err = new Error('User Not Found!')
            err.status = 400;
            throw err;
        } else if (await bcrypt.compare(req.body.password, user.password)) {
            const tokenPayload = {
              username: user.username,
            };
            const accessToken = jwt.sign(tokenPayload, process.env.TOKENKEY);
            res.status(201).json({
                status: 'success',
                message: 'User Logged In!',
                data: {
                  accessToken,
                },
              });
        } else {
            const err = new Error('Wrong Password!');
            err.status = 400;
            throw err;
          }
      } catch (err) {
        res.status(err.status).json({
            status: 'fail',
            message: err.message,
          });
      }    
      finally {
        await client.close();
    }
});

app.use(auth);

app.get("/hi", (req, res) => {
    res.send({text: "Hello"})
})


server.listen(port, () => console.log(`Listening on port ${port}`))