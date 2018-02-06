/* global process */
const express = require('express');
const bodyParser = require('body-parser');
const googleMapsClient = require('@google/maps').createClient({
    key: 'AIzaSyBYY389rwNPlT5PXyCSNeQdS62-QuEGDig'
});
const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

/*
 * Middleware asking google to solve the TSP and checking errors
 */
function googleDir(req, res, next) {
    let input = req.body;
    let err = detectErrors(input);
    if(err)
        return res.json({status:"KO", message:err});
    let points = [];
    let origin = input.home.lat + "," + input.home.lng;

    for(let task of input.tasks) {
        let coords = task.lat + "," + task.lng;
        points.push(coords);
    }
    googleMapsClient.directions({
        origin: origin,
        destination: origin,
        waypoints: "optimize:true|" + points.join("|")
    }, (err, response) => {
        if(err)
            return res.json({status:"KO", message:err});
        req.routes = response.json.routes[0];
        return next();
    });
}

/*
 * This route schedule tasks
 */
app.post('/routeOptimizer', googleDir, (req, res) => {
    var planning = {totalTime:0, schedule:[]};
    let input = req.body;
    let routes = req.routes;

    input.routes = [];
    for(let id of routes.waypoint_order)
        input.routes.push(input.tasks[id]);
    input.tasks = input.routes;
    delete input.routes;
    for(let id = 0; id < routes.legs.length - 1; id++)
        input.tasks[id].travelTime = routes.legs[id].duration.value;
    let depart = parseInt(input.departureTime);
    for(let task of input.tasks){
        planning.totalTime += task.travelTime + (task.duration * 60);
        planning.schedule.push({
            id:task.id,
            lat:task.lat,
            lng:task.lng,
            startsAt: depart + planning.totalTime - (task.duration * 60),
            endsAt: depart + planning.totalTime
        });
    }
    planning.totalTime = Math.ceil(planning.totalTime / 60);
    res.json(planning);
});

/*
 * Detect errors in the input
 */
function detectErrors(input) {
    let listData = ["departureTime", "home", "tasks"];
    if(!input)
        return "Nothing input. Please send us some data to work with.";
    for(let id of listData)
        if(!input[id])
            return "Input data is missing " + id;
    if(!input.tasks.length)
        return "No tasks given, you can stay home.";
    return false;
}

app.listen(process.env.PORT || 80, () => {
    console.log('Server started...');
});