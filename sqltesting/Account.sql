delete from account;


SELECT * FROM account;



INSERT INTO account 
(accountuid, rootfileuid, email, displayname, password, isdeleted, createtime)
VALUES ('9a9931b0-0053-4b74-9ea4-05c014482fa4', '7e282368-f44c-46b1-8d40-413362cdea16', 
		'firstuser@gmail.com', 'firstUserName', 'password', FALSE, (now() at time zone 'utc'))
	ON CONFLICT (accountuid) DO UPDATE SET 
(accountuid, rootfileuid, email, displayname, password, isdeleted, createtime)
= ('9a9931b0-0053-4b74-9ea4-05c014482fa4', '7e282368-f44c-46b1-8d40-413362cdea16', 
		'firstuser@gmail.com', 'firstUserName', 'password', FALSE, (now() at time zone 'utc'));


	
INSERT INTO account 
(accountuid, rootfileuid, email, displayname, password, isdeleted, createtime)
VALUES ('9a9931b0-0053-4b74-9ea4-05c014482fa4', '7e282368-f44c-46b1-8d40-413362cdea16', 
		'firstuser@gmail.com', 'firstUserName', 'password', FALSE, (now() at time zone 'utc'))
	ON CONFLICT (accountuid) DO UPDATE SET 
(accountuid, isdeleted)
= ('9a9931b0-0053-4b74-9ea4-05c014482fa4', TRUE)
RETURNING *;


UPDATE account SET (rootfileuid, email) = 
('7e282368-f44c-46b1-8d40-413362cdea16', 'firstuser@gmail.com') 
WHERE accountuid = '9a9931b0-0053-4b74-9ea4-05c014482fa4' RETURNING *;
	

------------------------------------------------------------------------


SELECT accountuid, email, displayname, 
	rootfileuid, EXTRACT(epoch FROM createtime) FROM account
	WHERE accountuid = '9a9931b0-0053-4b74-9ea4-05c014482fa4'
	AND deletetime is null;



-- Update Account

WITH accountupdate AS 
(
	UPDATE account
	SET (email, displayname, password, changetime)
	= ('firstuser@gmail.com', 'firstusernameupdated', 'password', (now() at time zone 'utc'))
	WHERE accountuid = '1a752b4b-5182-4c15-b4ce-efcc65a4afb3'
	RETURNING *
)
SELECT accountuid, email, displayname, rootfileuid FROM accountupdate;



-- New Account

WITH accountupdate AS 
(
	INSERT INTO account
	(email, displayname, password)
	--VALUES ('firstuser@gmail.com', 'firstusername', 'password')
	VALUES ('seconduser@gmail.com', 'secondusername', 'password')
	--VALUES ('thirduser@gmail.com', 'passwordname', 'password')
	--VALUES ('fourthuser@gmail.com', 'fourthusername', 'password')
	--VALUES ('fifthuser@gmail.com', 'fifthusername', 'password')

	RETURNING *
), 
fileupdate AS 
(
	INSERT INTO file (fileuid, owneruid, isdir)
	SELECT rootfileuid, accountuid, true
	FROM accountupdate
	RETURNING *
), 
journalupdate AS 
(
	INSERT INTO journal 
	(fileuid, owneruid, filesize, fileblocks)
	SELECT fileuid, owneruid, filesize, fileblocks
	FROM fileupdate
)
SELECT accountuid, email, displayname, rootfileuid FROM accountupdate;
