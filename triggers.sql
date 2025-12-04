
-- Trigger raamatute staatuse uuendamiseks laenutuse lisamisel
DELIMITER $$

CREATE TRIGGER trg_book_on_loan
AFTER INSERT ON loans
FOR EACH ROW
BEGIN
    UPDATE books
    SET status = 'Laenutatud'
    WHERE id = NEW.id;
END$$

CREATE TRIGGER trg_book_on_return
AFTER UPDATE ON loans
FOR EACH ROW
BEGIN
    IF NEW.return_date IS NOT NULL THEN
        
        declare book_status varchar(30);


        -- check if book can be changed in the database, because it exists in the library
        select 'status' into book_status
        from books 
        where id = NEW.book_id

        IF book_status = 'Ostetud' THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Book cannot be updated because: status = ostetud'
        END IF;
        
        -- book is in the library
        -- update new book
        UPDATE books        
        SET status = 'Vaba'
        WHERE id = NEW.book_id;
        
        -- add to history table
        INSERT INTO loans_history (            
            member_id,
            book_id,
            loan_start,
            loan_end,
            return_date,            
        ) VALUES (            
            NEW.member_id,
            NEW.book_id,
            NEW.loan_start,
            NEW.loan_end,
            NEW.return_date,            
        );

        -- delete the old loan from the original loans table
        DELETE FROM loans where NEW.id = id;

    END IF;
END$$

CREATE TRIGGER books_prevent_delete_on_loan
BEFORE DELETE ON books
FOR EACH ROW
BEGIN
    IF OLD.status = 'Laenutatud' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot delete a book that is currently loaned out';
    END IF;
END$$

CREATE TRIGGER member_prevent_delete_on_loaned_books
BEFORE DELETE ON members
FOR EACH ROW
BEGIN
    DECLARE loan_count INT;

    SELECT count(*) INTO loan_count from loans where OLD.id = member_id
    IF loan_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TXT = 'Member cannot be deleted when has loaned books'
    END IF;
END$$


CREATE TRIGGER orders_set_book_status
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    IF NEW.book_id IS NOT NULL THEN
        UPDATE books
        SET status = 'Ostetud'
        WHERE id = NEW.book_id;
    END IF;
END$$

DELIMITER ;