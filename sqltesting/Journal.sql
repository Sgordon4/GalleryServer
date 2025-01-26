
SELECT * FROM journal;



SELECT * FROM journal WHERE fileuid IN ('2e057bcf-0d6d-4b11-a461-2aaa290c5a8b', 'c2801f9f-561b-4003-967e-e3c62b1c4bb4');

SELECT DISTINCT ON (fileuid) journalid, fileuid, accountuid, changes, changetime 
FROM journal WHERE journalid > 2 AND accountuid = 'b16fe0ba-df94-4bb6-ad03-aab7e47ca8c3' 
AND fileuid IN ('2e057bcf-0d6d-4b11-a461-2aaa290c5a8b', 'c2801f9f-561b-4003-967e-e3c62b1c4bb4')
AND deviceuid != '052dc91c-0290-469b-8caf-e1b6793eba91'
ORDER BY fileuid, journalid DESC;


SELECT DISTINCT ON (fileuid, (MAX(journalid) AS MaxID)) journalid, fileuid, accountuid, changes, changetime 
FROM journal 
WHERE fileuid IN ('2e057bcf-0d6d-4b11-a461-2aaa290c5a8b', 'c2801f9f-561b-4003-967e-e3c62b1c4bb4')
ORDER BY fileuid, MaxID DESC;

SELECT DISTINCT ON (fileuid) journalid, fileuid, changes
FROM journal
WHERE fileuid IN ('2e057bcf-0d6d-4b11-a461-2aaa290c5a8b', 'c2801f9f-561b-4003-967e-e3c62b1c4bb4')
ORDER BY fileuid, journalid DESC;

SELECT *
FROM (
    SELECT DISTINCT ON (fileuid) journalid, fileuid, changes
	FROM journal
	WHERE fileuid IN ('2e057bcf-0d6d-4b11-a461-2aaa290c5a8b', 'c2801f9f-561b-4003-967e-e3c62b1c4bb4')
	ORDER BY fileuid, journalid DESC
) subquery
ORDER BY journalid;



SELECT * FROM journal
WHERE fileuid in ('8166de31-4ef5-4480-b6c8-b775c95e2601','39327b5a-b5eb-4288-b980-06260cb9772e');

SELECT * FROM ( 
	SELECT DISTINCT ON (fileuid) journalid, fileuid, accountuid, changes, changetime 
	FROM journal WHERE journalid > 2 AND accountuid = 'b16fe0ba-df94-4bb6-ad03-aab7e47ca8c3' 
	AND fileuid in ('8166de31-4ef5-4480-b6c8-b775c95e2601','39327b5a-b5eb-4288-b980-06260cb9772e') 
	AND deviceuid != 'ffeebb67-8dcd-4676-b0d5-7594b22ff580'
	ORDER BY fileuid, journalid DESC 
) subquery ORDER BY journalid;



SELECT journalid, fileuid, accountuid, changes, changetime 
FROM journal 
WHERE journalid > 2 
AND deviceuid != 'ffeebb67-8dcd-4676-b0d5-7594b22ff580'
LIMIT ;

SELECT * FROM (
SELECT journalid, fileuid, accountuid, changes, changetime 
FROM journal 
WHERE journalid > 2 
AND deviceuid != 'ffeebb67-8dcd-4676-b0d5-7594b22ff580'
ORDER BY journalid DESC
LIMIT 3 ) subquery
ORDER BY journalid ASC




INSERT INTO journal (fileuid, accountuid, filehash, attrhash, changetime)
VALUES (gen_random_uuid(), gen_random_uuid(), 'filehash', 'attrhash', extract(epoch from date_trunc('second', (now() at time zone 'utc'))));



SELECT J.journalID, F.fileuid, F.accountuid, F.isdir, F.islink, F.isdeleted, F.userattr, F.filesize, F.filehash, 
F.changetime, F.modifytime, F.accesstime, F.createtime, F.attrhash
FROM (
	select max(journalid) AS journalid, fileuid from journal 
	WHERE journalID > 8 
	GROUP BY fileuid 
	ORDER BY journalid
) J
LEFT JOIN file F
ON F.fileuid = J.fileuid;



select max(journalid) AS journalid, fileuid from journal 
WHERE journalID > 8 
GROUP BY fileuid 
ORDER BY journalid;



SELECT * FROM journal;





UPDATE file SET filehash = '' WHERE fileuid = '54a01172-aa08-43c6-aace-5328645a04b3' RETURNING *;
UPDATE file SET filehash = 'SDLJDHESIOUXHCIDUHIS' WHERE fileuid = '54a01172-aa08-43c6-aace-5328645a04b3' RETURNING *;
UPDATE file SET filesize = '33' WHERE fileuid = '54a01172-aa08-43c6-aace-5328645a04b3' RETURNING *;



INSERT INTO file 
(fileuid, accountuid, isdir)
VALUES 
(gen_random_uuid(), gen_random_uuid(), TRUE)
ON CONFLICT (fileuid)
DO UPDATE SET
(isdir, changetime)
= (TRUE, extract(epoch from date_trunc('second', (now() at time zone 'utc'))))
RETURNING *;