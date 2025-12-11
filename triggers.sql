USE library;
DELIMITER $$

CREATE TRIGGER books_prevent_delete_on_loan
BEFORE DELETE ON books
FOR EACH ROW
BEGIN
    IF OLD.status = 'Laenutatud' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot delete a book that is currently loaned out';
    END IF;
END$$

CREATE TRIGGER member_prevent_delete_on_loan
BEFORE DELETE ON members
FOR EACH ROW
BEGIN
    IF (SELECT COUNT(*) FROM loans WHERE member_id = OLD.personal_code) > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot delete member: has active loans';
    END IF;
END$$

CREATE TRIGGER orders_set_book_status
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    IF NEW.book_id IS NOT NULL THEN
        UPDATE books
        SET status = 'Ostetud'
        WHERE id = NEW.book_id;
    END IF;
END$$

CREATE TRIGGER books_set_loaned_status
AFTER INSERT ON loans
FOR EACH ROW
BEGIN
    UPDATE books
    SET status = 'Laenutatud'
    WHERE id = NEW.book_id;
END$$

CREATE TRIGGER trg_book_on_loan_delete
AFTER DELETE ON loans
FOR EACH ROW
BEGIN
    DECLARE book_status VARCHAR(30);

    SELECT status INTO book_status
    FROM books
    WHERE id = OLD.book_id;

    IF book_status = 'Ostetud' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Book cannot be updated: status = Ostetud';
    END IF;

    UPDATE books
    SET status = 'Vaba'
    WHERE id = OLD.book_id;

    INSERT INTO loans_history (
        loan_id,
        member_id,
        book_id,
        loan_start,
        loan_end,
        return_date
    ) VALUES (
        OLD.id,
        OLD.member_id,
        OLD.book_id,
        OLD.loan_start,
        OLD.loan_end,
        CURRENT_TIMESTAMP
    );
END$$

DELIMITER ;
