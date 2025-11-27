use library;

INSERT INTO works (title, release_date, language, publisher, pages) VALUES
('The Great Gatsby', '1925-04-10', 'English', 'Scribner', 218),
('Pride and Prejudice', '1813-01-28', 'English', 'T. Egerton', 279),
('Harry Potter and the Sorcerers Stone', '1997-06-26', 'English', 'Bloomsbury', 223);

INSERT INTO authors (first_name, last_name) VALUES
('F. Scott', 'Fitzgerald'),
('Jane', 'Austen'),
('J.K.', 'Rowling');

INSERT INTO work_authors (work_id, author_id) VALUES
(1, 1),  -- The Great Gatsby → F. Scott Fitzgerald
(2, 2),  -- Pride and Prejudice → Jane Austen
(3, 3);  -- Harry Potter → J.K. Rowling

INSERT INTO books (work_id, barcode, format) VALUES
(1, 'B10001', 'Füüsiline'),
(1, 'B10002', 'Digitaalne'),
(2, 'B20001', 'Füüsiline'),
(3, 'B30001', 'Füüsiline'),
(3, 'B30002', 'Digitaalne');

INSERT INTO members (status, personal_code, first_name, last_name) VALUES
('Tavaline', '1234567890', 'Alice', 'Smith'),
('Kuldliige', '2345678901', 'Bob', 'Johnson'),
('VIP', '3456789012', 'Charlie', 'Brown');

INSERT INTO employees (first_name, last_name, department, age, salary, bonus, phone_number) VALUES
('David', 'Miller', 'Acquisitions', 35, 3500.00, 300.00, '555-0101'),
('Emma', 'Davis', 'Loans', 29, 3200.00, 250.00, '555-0102');

INSERT INTO loans (member_id, book_id, loan_start, loan_end) VALUES
(1, 1, '2025-11-01', '2025-11-15'),
(2, 3, '2025-11-05', '2025-11-20');

INSERT INTO members (status, personal_code, first_name, last_name)
VALUES 
('Tavaline', '50001010011', 'Mati', 'Kask'),
('Kuldliige', '60002020022', 'Kadri', 'Tamm'),
('VIP', '70003030033', 'Juhan', 'Põld');

INSERT INTO members (status, personal_code, first_name, last_name)
VALUES ('Tavaline', '80004040044', 'Laura', 'Mets');

-- trigger test, addst to members_history table
DELETE FROM members
WHERE member_id = 1;