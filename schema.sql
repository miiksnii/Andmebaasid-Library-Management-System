-- create database library;
use library;

-- Tabel teoste jaoks
CREATE TABLE IF NOT EXISTS works (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_date DATE,
    language VARCHAR(50) NOT NULL,
    publisher VARCHAR(100),
    file_path VARCHAR(4096) UNIQUE NOT NULL, -- linux-i maksimaalne file_path pikkus     
    pages BIGINT,           
    UNIQUE(title, release_date, publisher)
);

-- Tabel autorite jaoks
CREATE TABLE IF NOT EXISTS authors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL
);

-- mitu autorit (mant-to-many)
CREATE TABLE IF NOT EXISTS authors_works (
    author_id INT NOT NULL, 
    work_id INT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES authors(id) 
        ON UPDATE CASCADE
        ON DELETE CASCADE,-- kustutatakse seos kui autorit ei ole
    FOREIGN KEY (work_id) REFERENCES works(id) 
        ON UPDATE CASCADE
        ON DELETE CASCADE, -- kustutatakse seos kui teost ei ole
    UNIQUE(author_id, work_id)
);

-- Raamatud, mis viitavad teosele
-- 'work_id' kasutatakse unikaalse raamatu kontrollimiseks.
-- autori leiab teose ja autori vahetabelist
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,    
    work_id INT UNIQUE NOT NULL,
    ISBN VARCHAR(32) UNIQUE NOT NULL,
    format ENUM ('Füüsiline', 'Digitaalne') NOT NULL,
    status ENUM ('Vaba', 'Laenutatud', 'Ostetud') DEFAULT 'Vaba',
    FOREIGN KEY (work_id) REFERENCES works(id) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT
);

-- Liikmed
CREATE TABLE IF NOT EXISTS members (
    personal_code VARCHAR(50) PRIMARY KEY, -- läbi selle kontrollitakse, et liiget ei saaks mitu teha    
    status ENUM ('Tavaline', 'Kuldliige', 'VIP') NOT NULL
);

-- Töötajad
CREATE TABLE IF NOT EXISTS employees (    
    personal_code VARCHAR(50) PRIMARY KEY, -- läbi selle kontrollitakse, et töötajat ei saaks mitu teha
    last_name VARCHAR(50) NOT NULL,
    department VARCHAR(50),
    age INT,
    salary DECIMAL(10, 2),
    bonus DECIMAL(10, 2),
    phone_number VARCHAR(20)
);

-- Laenutused
CREATE TABLE IF NOT EXISTS loans (
    id INT AUTO_INCREMENT PRIMARY KEY, -- triggeris on muutuja tüüp sama mis siin, trigger: member_prevent_delete_on_loaned_books
    member_id VARCHAR(50) NOT NULL,
    book_id INT NOT NULL UNIQUE,
    loan_start DATE NOT NULL,
    loan_end DATE NOT NULL,    
    FOREIGN KEY (member_id) REFERENCES members(personal_code) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT, -- saab kustutada ainult siis kui liikmel ei ole laenutatud raamatuid - trigger: member_prevent_delete_on_loaned_books
    FOREIGN KEY (book_id) REFERENCES books(id) 
        ON UPDATE CASCADE 
        ON DELETE RESTRICT, -- Saab kustutada ainult siis kui raamat on vaba - trigger: books_prevent_delete_on_loan
    CONSTRAINT chk_loan_period CHECK (loan_end > loan_start)    
);

CREATE TABLE IF NOT EXISTS loans_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loan_id INT,
    member_id VARCHAR(50),
    book_id INT,
    loan_start DATE NOT NULL,
    loan_end DATE NOT NULL,    
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- when book is returned, then date is set to today
    FOREIGN KEY (member_id) REFERENCES members(personal_code)
        ON UPDATE CASCADE
        ON DELETE SET NULL, 
    FOREIGN KEY (book_id) REFERENCES books(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,  
    CHECK (loan_end > loan_start)
);

CREATE TABLE IF NOT EXISTS orders ( -- trigger: orders_set_book_status
    id INT AUTO_INCREMENT PRIMARY KEY,    
    book_id INT,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Active', 'Completed', 'Cancelled') DEFAULT 'Active',
    FOREIGN KEY (book_id) REFERENCES books(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL -- keep order record even if the book is deleted
);
