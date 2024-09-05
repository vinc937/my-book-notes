# My Book Notes

A web application for storing and managing reviews and notes about the books I read. Built using Express.js for server-side logic, Axios for fetching book data, and PostgreSQL for persistent storage.

## Requirements

Before setting up the project, ensure you have the following installed on your computer:

- **PostgreSQL**: For the database.
- **pgAdmin**: To manage your PostgreSQL database.
- **Node.js**: To run the app.
- **nodemon** (recommended globally): To auto-restart the server during development.

### Install Nodemon globally:

```bash
npm install -g nodemon
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/vinc937/my-book-notes.git
```

### 2. Navigate into the Project Directory

```bash
cd my-book-notes
```

### 3. Install Project Dependencies

```bash
npm install
```

### 4. Set Up the Database

- Open **pgAdmin** and create a new PostgreSQL database.
- Name the database according to your preference.
- Create a new table using the following SQL code (you can also find it in the `queries.sql` file in the project):

```sql
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    isbn TEXT NOT NULL UNIQUE,
    cover_data BYTEA NOT NULL,
    title VARCHAR(150) NOT NULL,
    author VARCHAR(100) NOT NULL,
    read_date DATE NOT NULL,
    rating INTEGER NOT NULL,
    review TEXT NOT NULL,
    notes TEXT NOT NULL
);

CREATE UNIQUE INDEX unique_title_author ON books (LOWER(title), LOWER(author));
```

### 5. Update the Database connection

- In the project files, open `index.js`.
- Locate the database connection section and update your database name and password.

```js
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "<your_database_name>",
  password: "<your_password>",
  port: 5432,
});
```

## Running the Application

Once everything is set up, start the application using:

```bash
nodemon index.js
```

Then open your web browser and go to:

http://localhost:3000
