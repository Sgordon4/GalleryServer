select gen_random_uuid () as UID;
select (now() at time zone 'utc') as time;

delete from file;

delete from journal;


select * from file
ORDER BY createtime;

SELECT * FROM journal;





INSERT INTO file 
(fileuid, accountuid, isdir)
VALUES 
(gen_random_uuid(), gen_random_uuid(), TRUE)
ON CONFLICT (fileuid)
DO UPDATE SET
(isdir, changetime)
= (TRUE, (now() at time zone 'utc'))
RETURNING *;


INSERT INTO file 
(fileuid, accountuid, isdir)
VALUES 
('f1a6b6e7-5414-4433-b6e5-77a0b7ecd12f', 'be204e60-adbe-420c-8c64-b153e129335d', TRUE)
ON CONFLICT (fileuid)
DO UPDATE SET
(isdir, changetime)
= (TRUE, (now() at time zone 'utc'))
RETURNING *;






CREATE OR REPLACE FUNCTION insert_to_journal() RETURNS TRIGGER AS $journal_put$
BEGIN
	INSERT INTO journal (accountuid, fileuid, isdir, islink, fileblocks, filesize, filehash, isdeleted)
	VALUES (NEW.accountuid, NEW.fileuid, NEW.isdir, NEW.islink, NEW.fileblocks, NEW.filesize, NEW.filehash, NEW.isdeleted);
	RETURN NEW;
END;


CREATE TRIGGER file_insert_to_journal AFTER INSERT ON file 
FOR EACH ROW EXECUTE PROCEDURE insert_to_journal();

CREATE TRIGGER file_update_to_journal AFTER UPDATE OF isdir, islink, fileblocks, filesize, filehash, isdeleted ON file 
FOR EACH ROW EXECUTE PROCEDURE insert_to_journal();






-------------------------------------------------------------------------------
-- Old


-- Update File owneruid

WITH fileupdate AS 
(
	UPDATE file
	SET (owneruid, changetime)
	= ('1a752b4b-5182-4c15-b4ce-efcc65a4afb3', (now() at time zone 'utc'))
	WHERE fileuid = 'cf5e89a3-ffe3-42ab-8bf7-668311bc9dfc'
	RETURNING *
),
journalupdate AS (
	INSERT INTO journal 
	(fileuid, owneruid, filesize, fileblocks)
	SELECT fileuid, owneruid, filesize, fileblocks
	FROM fileupdate
)
SELECT fileuid, owneruid, isdir, islink, filesize, fileblocks, createtime FROM fileupdate;



-- New File

WITH fileupdate AS 
(
	INSERT INTO file (owneruid) 
	VALUES ('1a752b4b-5182-4c15-b4ce-efcc65a4afb3')
	RETURNING *
),
journalupdate AS (
	INSERT INTO journal 
	(fileuid, owneruid, filesize, fileblocks)
	SELECT fileuid, owneruid, filesize, fileblocks
	FROM fileupdate
)
SELECT fileuid, owneruid, isdir, islink, filesize, fileblocks, createtime FROM fileupdate;





WITH fileupdate AS
	(
		UPDATE file
		SET deletetime = (now() at time zone 'utc')
		WHERE fileuid = '5b600697-2065-4266-ac9d-43deb8e9ba20'
		RETURNING *
	),
	journalupdate AS (
		INSERT INTO journal
		(fileuid, owneruid, filesize, fileblocks)
		SELECT fileuid, owneruid, filesize, fileblocks
		FROM fileupdate
	)
	SELECT fileuid, owneruid, isdir, islink, filesize, fileblocks, createtime FROM fileupdate;



