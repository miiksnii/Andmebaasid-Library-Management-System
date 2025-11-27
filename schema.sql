-- create database library;
use library;

-- Tabel teoste (works) jaoks (normaliseeritud)
CREATE TABLE IF NOT EXISTS works (
    work_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_date DATE,
    language VARCHAR(50),
    publisher VARCHAR(100),
    pages INT
);

-- Tabel autorite jaoks (üks töö võib olla mitme autoriga)
CREATE TABLE IF NOT EXISTS authors (
    author_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL
);

-- Seostabel teoste ja autorite vahel (many-to-many)
CREATE TABLE IF NOT EXISTS work_authors (
    work_id INT NOT NULL,
    author_id INT NOT NULL,
    PRIMARY KEY (work_id, author_id),
    FOREIGN KEY (work_id) REFERENCES works(work_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(author_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- Raamatud, mis viitavad teosele
CREATE TABLE IF NOT EXISTS books (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    format ENUM('Füüsiline', 'Digitaalne') NOT NULL,
    status ENUM('Vaba', 'Laenutatud') DEFAULT 'Vaba',
    FOREIGN KEY (work_id) REFERENCES works(work_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Liikmed
CREATE TABLE IF NOT EXISTS members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    status ENUM('Tavaline', 'Kuldliige', 'VIP') NOT NULL,
    personal_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL
);

-- Töötajad
CREATE TABLE IF NOT EXISTS employees (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    department VARCHAR(50),
    age INT,
    salary DECIMAL(10,2),
    bonus DECIMAL(10,2),
    phone_number VARCHAR(20)
);

-- Laenutused
CREATE TABLE IF NOT EXISTS loans (
    loan_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    book_id INT NOT NULL,
    loan_start DATE NOT NULL,
    loan_end DATE NOT NULL,
    return_date DATE,
    FOREIGN KEY (member_id) REFERENCES members(member_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT chk_loan_period CHECK (loan_end >= loan_start)
);

CREATE TABLE IF NOT EXISTS members_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    status ENUM('Tavaline', 'Kuldliige', 'VIP'),
    personal_code VARCHAR(50),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    deleted_at DATETIME NOT NULL
);



-- Trigger raamatute staatuse uuendamiseks laenutuse lisamisel
DELIMITER $$

CREATE TRIGGER trg_book_on_loan
AFTER INSERT ON loans
FOR EACH ROW
BEGIN
    UPDATE books
    SET status = 'Laenutatud'
    WHERE book_id = NEW.book_id;
END$$

CREATE TRIGGER trg_book_on_return
AFTER UPDATE ON loans
FOR EACH ROW
BEGIN
    IF NEW.return_date IS NOT NULL THEN
        UPDATE books
        SET status = 'Vaba'
        WHERE book_id = NEW.book_id;
    END IF;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER trg_members_delete_history
BEFORE DELETE ON members
FOR EACH ROW
BEGIN
    INSERT INTO members_history (
        member_id,
        status,
        personal_code,
        first_name,
        last_name,
        deleted_at
    ) VALUES (
        OLD.member_id,
        OLD.status,
        OLD.personal_code,
        OLD.first_name,
        OLD.last_name,
        NOW()
    );
END$$

DELIMITER ;