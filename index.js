// importing modules
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

// initializing the express application and setting the port and external API URL
const app = express();
const port = 3000;
const apiUrl = "https://covers.openlibrary.org/b/isbn/";

// setting the middleware: bodyParser to handle form submissions, and express.static to server static files
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// establishing connection to PostgreSQL database
const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "your_database",
    password: "your_password",
    port: 5432
});

// connecting to database
db.connect();

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
        return res.status(400).json({error: 'Invalid sorting option'});
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
        res.status(500).json({error: "An error occurred while trying to update the book. Please try again."});
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
        res.status(500).json({error: "There was an error adding the book, please try again."});
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
