// importing modules
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import env from "dotenv";


// initializing the express application and setting the port, external API URL and env
const app = express();
const port = 3000;
const apiUrl = "https://covers.openlibrary.org/b/isbn/";
env.config();

// setting the middleware: bodyParser to handle form submissions, and express.static to server static files
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// establishing connection to PostgreSQL database
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: {
        rejectUnauthorized: false
    }
});

// connecting to database
db.connect( err => {
    if (err) {
        console.error("Connection error", err.stack);
    } else {
        console.log("Connected to PostgreSQL");
    }
});

// defining reusable functions
async function fetchBookCover(isbn) {
    try {
        try {
            const metadataResponse = await axios.get(apiUrl + isbn + ".json");
            const metadata = metadataResponse.data;

            if (metadata.width < 180 || metadata.height < 271){
                throw new Error("Image dimensions too small");
            }
        } catch (err) {
            console.log(err);
            throw new Error("Cover error");
        }
        
        const response = await axios.get(apiUrl + isbn + "-M.jpg", {responseType: "arraybuffer"});
        const imageBuffer = Buffer.from(response.data, "binary");
        return imageBuffer;
    } catch (err) {
        if (err.message == "Cover error"){
            throw new Error("Unable to load the cover for the provided ISBN. Please check the ISBN and try again or use a different ISBN.");
        } else {
            throw new Error("Failed to retrieve the book cover. Try again.");
        }
    }
};

async function orderBy(option) {
    if (option == "rating"){
        const result = await db.query(`SELECT *, to_char(read_date, 'DD/MM/YYYY') as formated_date FROM books ORDER BY ${option} DESC `);
        return result.rows;
    }
    const result = await db.query(`SELECT *, to_char(read_date, 'DD/MM/YYYY') as formated_date FROM books ORDER BY ${option} ASC `);
    return result.rows;
}

async function getById(id) {
    const result = await db.query(`SELECT *, to_char(read_date, 'DD/MM/YYYY') as formated_date, read_date::text FROM books WHERE id = $1`, [id]);
    let data = result.rows[0];
    data.cover_data = `data:image/jpeg;base64,${data.cover_data.toString('base64')}`;
    return data;
};

function toTitleCase(string){
    string = string.toLowerCase().split(" ");
    string = string.map( word => {
        word = word[0].toUpperCase() + word.slice(1);
        return word;
    })
    return string.join(" ");
}

// handling HTTP requests and routes
app.get("/", async (req,res) => {
    const result = await db.query("SELECT *, to_char(read_date, 'DD/MM/YYYY') as formated_date FROM books ORDER BY id ASC ");
    let data = result.rows;
    if (data.length == 0) {
        data = null;
    } else {
        data = data.map( book => {
            book.cover_data = `data:image/jpeg;base64,${book.cover_data.toString('base64')}`;
            return book;
        });
    };
    res.render("index.ejs", {
        books: data,
        selectedOption: null,
    });
});

app.get("/order-by/:option", async (req,res) => {
    const option = req.params.option;
    const validOptions = ['title', 'read_date', 'rating'];
    if (!validOptions.includes(option)) {
        return res.status(400).send("<h1>Invalid sorting option</h1>");
    }
    let data = await orderBy(option);
    if (data.length == 0) {
        data = null;
    } else {
        data = data.map( book => {
            book.cover_data = `data:image/jpeg;base64,${book.cover_data.toString('base64')}`;
            return book;
        });
    };
    res.render("index.ejs", {
        books: data,
        selectedOption: option,
    });
});

app.get("/notes/:id",async (req,res) => {
    const id = parseInt(req.params.id);
    const data = await getById(id);
    res.render("read-notes.ejs",{book: data});
});

app.get("/add", (req,res) =>{
    res.render("add.ejs");
});

app.get("/edit/:id", async (req,res) => {
    const id = parseInt(req.params.id);
    const data = await getById(id);
    res.render("edit.ejs", {book: data});
});

app.post("/update/:id", async (req,res) => {
    const id = parseInt(req.params.id);
    const title = toTitleCase(req.body.title);
    const author = toTitleCase(req.body.author);

    try {
        const coverImage = await fetchBookCover(req.body.isbn);
        
        await db.query(
            "UPDATE books SET isbn=$1, cover_data=$2, title=$3, author=$4, read_date=$5::date, rating=$6, review=$7, notes=$8 WHERE id=$9",
            [req.body.isbn, coverImage, title, author, req.body.read_date, req.body.rating, req.body.review, req.body.notes, id]
        );
        res.redirect("/");
    } catch (err) {
        console.log(err.message);
        res.status(500).send("<h1>An error occurred while trying to update the book. Please try again.</h1>");
    }
});

app.post("/add-book", async (req,res) => {
    const title = toTitleCase(req.body.title);
    const author = toTitleCase(req.body.author);

    try{
        const coverImage = await fetchBookCover(req.body.isbn);
        
        await db.query(
            "INSERT INTO books (isbn, cover_data, title, author, read_date, rating, review, notes) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8)",
            [req.body.isbn, coverImage, title, author, req.body.read_date, req.body.rating, req.body.review, req.body.notes]
        )
        res.redirect("/");
    } catch(err){
        console.log(err.message);
        res.status(500).send("<h1>There was an error adding the book, please try again.</h1>");
    } 
});

app.get("/delete/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await db.query("DELETE FROM books WHERE id = $1", [id]);
    res.redirect("/");
});

// setting up the server to listen on the specified port
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
