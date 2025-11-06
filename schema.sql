
CREATE TABLE IF NOT EXISTS  works (
    work_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_date DATE,
    language VARCHAR(50),
    publisher VARCHAR(100),
    pages INT,
    authors VARCHAR(255) 
);

CREATE TABLE IF NOT EXISTS  employees (
    employee_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    department VARCHAR(50),
    age INT,
    salary DECIMAL(10,2),
    bonus DECIMAL(10,2),
    phone_number VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);


CREATE TABLE IF NOT EXISTS  works (
    work_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_date DATE,
    language VARCHAR(50),
    publisher VARCHAR(100),
    pages INT,
    authors VARCHAR(255)
);


CREATE TABLE IF NOT EXISTS  books (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    format ENUM('Füüsiline', 'Digitaalne') NOT NULL,
    status ENUM('Vaba', 'Laenutatud') DEFAULT 'Vaba',
    FOREIGN KEY (work_id) REFERENCES works(work_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS  loans (
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

