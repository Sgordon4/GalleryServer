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
	

