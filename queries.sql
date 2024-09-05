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
