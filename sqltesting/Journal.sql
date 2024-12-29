
SELECT * FROM journal;


INSERT INTO journal (fileuid, accountuid, filehash, attrhash, changetime)
VALUES (gen_random_uuid(), gen_random_uuid(), 'filehash', 'attrhash', extract(epoch from date_trunc('second', (now() at time zone 'utc'))));



SELECT J.journalID, F.fileuid, F.accountuid, F.isdir, F.islink, F.isdeleted, F.userattr, F.fileblocks, F.filesize, F.filehash, 
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