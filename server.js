const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const fs = require("fs");
require('dotenv').config();
const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

app.use(express.static('public'));
app.use(express.json());

/* -------------------------------
   MongoDB Models
--------------------------------*/

const busSchema = new mongoose.Schema({
    busName: String,
    lat: Number,
    lng: Number,
    lastUpdated: { type: Date, default: Date.now }
});

const Bus = mongoose.model('Bus', busSchema);

const stopSchema = new mongoose.Schema({
    name: String,
    lat: Number,
    lng: Number
});

const Stop = mongoose.model("Stop", stopSchema);

/* -------------------------------
   MongoDB Connection
--------------------------------*/

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Successfully connected to MongoDB Database!'))
.catch((err) => console.log('Database connection error:', err));

/* -------------------------------
   Driver GPS API (Flutter)
--------------------------------*/

app.post('/update-location', async (req, res) => {

try {

console.log("Request body:", req.body);

const { busName, lat, lng } = req.body;

console.log("Location received:", busName, lat, lng);

const latNum = Number(lat);
const lngNum = Number(lng);

await Bus.findOneAndUpdate(
{ busName: busName },
{ lat: latNum, lng: lngNum, lastUpdated: new Date() },
{ upsert: true }
);

/* Broadcast location to all maps */

io.emit("bus-moved", {
busName: busName,
lat: latNum,
lng: lngNum
});

res.sendStatus(200);

} catch (err) {

console.log("Update location error:", err);
res.sendStatus(500);

}

});

/* -------------------------------
   Add Bus Stop
--------------------------------*/

app.post("/add-stop", async (req, res) => {

const { name, lat, lng } = req.body;

const stop = new Stop({
name,
lat,
lng
});

await stop.save();

res.send({ message: "Stop added successfully" });

});

/* -------------------------------
   Clear Stops
--------------------------------*/


app.post("/clear-stops", async (req,res)=>{

try{

await Stop.deleteMany({});

res.json({
message:"All stops deleted"
});

}catch(err){

res.status(500).json({error:err});

}

});
/* -------------------------------
   Send Stops to Map
--------------------------------*/

app.get("/stops", async (req, res) => {

const stops = await Stop.find();

res.json(stops);

});
app.delete("/delete-stop/:id", async (req, res) => {

  try {
    await Stop.findByIdAndDelete(req.params.id);
    res.send("Stop deleted");
  } catch (err) {
    res.status(500).send(err);
  }

});


app.get("/buses", async (req,res)=>{

const buses = await Bus.find();

res.json(buses);

});
app.delete("/delete-bus/:id", async (req, res) => {

  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.send("Bus deleted");
  } catch (err) {
    res.status(500).send(err);
  }

});
/* -------------------------------
   Socket.IO Connection
--------------------------------*/

io.on('connection', async (socket) => {

console.log('A user opened the map dashboard!');

/* Send last known bus positions */

try {

const buses = await Bus.find();

buses.forEach(bus => {

socket.emit("bus-moved", {
busName: bus.busName,
lat: bus.lat,
lng: bus.lng
});

});

} catch(err){

console.log("Error sending last bus location:", err);

}

socket.on('disconnect', () => {
console.log('A user closed the map');
});

});

/* -------------------------------
   Start Server
--------------------------------*/

http.listen(3000, () => {
console.log('Server running! Open http://localhost:3000 in your browser');
});