const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
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
   FIXED DATABASE SPAM BUG
--------------------------------*/

app.post('/update-location', async (req, res) => {

try {

const { busName, lat, lng } = req.body;

if(!busName || lat === undefined || lng === undefined){
return res.status(400).send("Invalid data");
}

const latNum = Number(lat);
const lngNum = Number(lng);

const existingBus = await Bus.findOne({ busName });

/* Prevent duplicate updates if movement is tiny */

if(existingBus){

const distance =
Math.abs(existingBus.lat - latNum) +
Math.abs(existingBus.lng - lngNum);

if(distance < 0.00005){
return res.sendStatus(200);
}

existingBus.lat = latNum;
existingBus.lng = lngNum;
existingBus.lastUpdated = new Date();

await existingBus.save();

}else{

const newBus = new Bus({
busName,
lat: latNum,
lng: lngNum
});

await newBus.save();

}

/* Broadcast location to dashboard */

io.emit("bus-moved",{
busName,
lat: latNum,
lng: lngNum
});

res.sendStatus(200);

}catch(err){

console.log("Update error:",err);
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
   Get Stops
--------------------------------*/

app.get("/stops", async (req, res) => {

const stops = await Stop.find();

res.json(stops);

});

/* -------------------------------
   Delete Stop
--------------------------------*/

app.delete("/delete-stop/:id", async (req, res) => {

try {
await Stop.findByIdAndDelete(req.params.id);
res.send("Stop deleted");
} catch (err) {
res.status(500).send(err);
}

});

/* -------------------------------
   Get Buses
--------------------------------*/

app.get("/buses", async (req,res)=>{

const buses = await Bus.find();

res.json(buses);

});

/* -------------------------------
   Delete Bus
--------------------------------*/

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

console.log('Map dashboard connected');

/* Send last known bus locations */

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
console.log('Dashboard disconnected');
});

});

/* -------------------------------
   Start Server
--------------------------------*/

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});