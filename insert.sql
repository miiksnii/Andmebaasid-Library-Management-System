USE library;

-- === 1. Insert Authors ===
INSERT INTO authors (first_name, last_name) VALUES
('John', 'Doe'),
('Jane', 'Smith'),
('Alice', 'Johnson'),
('Bob', 'Brown');

-- === 2. Insert Works ===
INSERT INTO works (title, release_date, language, publisher, pages) VALUES
('Learn SQL', '2020-01-01', 'English', 'TechBooks', 350),
('Advanced PHP', '2019-05-15', 'English', 'CodePress', 420),
('Database Design', '2021-08-20', 'English', 'DBPublishers', 280),
('Modern Web', '2022-03-10', 'English', 'WebBooks', 310);

-- === 3. Link Authors to Works ===
INSERT INTO authors_works (author_id, work_id) VALUES
(1, 1), -- John Doe -> Learn SQL
(2, 2), -- Jane Smith -> Advanced PHP
(3, 3), -- Alice Johnson -> Database Design
(4, 4), -- Bob Brown -> Modern Web
(2, 3); -- Jane Smith also contributed to Database Design

-- === 4. Insert Books ===
INSERT INTO books (work_id, ISBN, format, status) VALUES
(1, '978-1-23456-001-0', 'Füüsiline', 'Vaba'),
(2, '978-1-23456-002-7', 'Digitaalne', 'Vaba'),
(3, '978-1-23456-003-4', 'Füüsiline', 'Laenutatud'),
(4, '978-1-23456-004-1', 'Digitaalne', 'Ostetud');

-- === 5. Insert Members ===
INSERT INTO members (personal_code, status, first_name, last_name) VALUES
('M1001', 'Tavaline', 'Tom', 'Harris'),
('M1002', 'Kuldliige', 'Sara', 'Connor'),
('M1003', 'VIP', 'Liam', 'Smith');

-- === 6. Insert Employees ===
INSERT INTO employees (personal_code, first_name, last_name, department, age, salary, bonus, phone_number) VALUES
('E2001', 'Alice', 'Wong', 'Lending', 35, 3500.00, 500.00, '555-1001'),
('E2002', 'Mark', 'Lee', 'IT', 40, 4000.00, 700.00, '555-1002');

-- === 7. Insert Loans ===
INSERT INTO loans (member_id, book_id, loan_start, loan_end) VALUES
('M1001', 1, '2025-12-01', '2025-12-15'),
('M1002', 3, '2025-11-25', '2025-12-10');

-- === 8. Insert Loans History ===
INSERT INTO loans_history (loan_id, member_id, book_id, loan_start, loan_end, return_date) VALUES
(1, 'M1001', 1, '2025-12-01', '2025-12-15', '2025-12-12 10:00:00'),
(2, 'M1002', 3, '2025-11-25', '2025-12-10', '2025-12-09 14:30:00');

-- === 9. Insert Orders ===
INSERT INTO orders (book_id, order_date, status) VALUES
(2, '2025-12-11 12:00:00', 'Active'),
(4, '2025-12-10 09:30:00', 'Completed');
