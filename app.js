const path = require("path");
const express = require("express");
const { MongoClient} = require("mongodb");
const axios = require("axios");
require("dotenv").config({ path: path.resolve(__dirname, "credentialsDontPost/.env") });

const app = express();
const port = 3000;

const SCOREBAT_API_TOKEN = process.env.SCOREBAT_API_TOKEN;
const uri = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const databaseAndCollection = { db: "CMSC335DB", collection: "soccer_highlights" };

app.set("views", path.resolve(__dirname, "Templates"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get("/", (req, res) => {
    res.render("index"); 
});

app.post('/search', async (req, res) => {
    const date = req.body.date;
    
    const apiUrl = `https://www.scorebat.com/video-api/v3/feed/?token=${SCOREBAT_API_TOKEN}`;

    try {
        const response = await axios.get(apiUrl);
        returned_games = response.data.response;

        const filteredData = returned_games.filter(game =>
            //game.title.includes(teamName)
            game.date.includes(date)
        );

        if (filteredData.length && date.length != "") {
            const video = filteredData[0].videos[0]; 
            await client.connect();
            const db = client.db(databaseAndCollection.db);
            const collection = db.collection(databaseAndCollection.collection);
            console.log(video)

            const regex = /<iframe.*?src=['"](.*?)['"]/;
            const match = video.embed.match(regex);

            const src = match ? match[1] : null; 
            console.log(src); 

            // Save to the database
            await collection.insertOne({date, src: src});
            res.render('vid_with_vid', {date, src});
        } else {
            res.render('vid_no_exist', {date});
        }

    } catch (error) {
        console.error("Error fetching data from ScoreBat API or MongoDB:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/random-video", async (req, res) => {
    try {
        await client.connect();
        const db = client.db(databaseAndCollection.db);
        const collection = db.collection(databaseAndCollection.collection);

        // Number of Docs
        const count = await collection.countDocuments();
        
        // Generate a random num
        const randomIndex = Math.floor(Math.random() * count);
        
        // Retrieve the random video
        const randomElement = await collection.find().limit(1).skip(randomIndex).toArray();
        
        const date = randomElement[0].date;
        const src = randomElement[0].src;

        res.render("random_video", { date, src });
    } catch (error) {
        console.error("Error fetching random video:", error);
        res.status(500).send("Internal Server Error");
    } finally {
        await client.close();
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

