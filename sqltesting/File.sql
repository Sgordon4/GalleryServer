select gen_random_uuid () as UID;
select extract(epoch from date_trunc('second', (now() at time zone 'utc'))) as time;

delete from file;

delete from journal;

DELETE FROM file WHERE fileuid = 'd79bee5d-1666-4d18-ae29-1bfba6bf0564';



select * from file
ORDER BY createtime;

SELECT extract(epoch from createtime), file.* from file
ORDER BY createtime;

SELECT * FROM journal;



INSERT INTO file 
(fileuid, accountuid, isdir)
VALUES 
('45c61d9c-f444-47ac-8b1a-6008054f3dcd', '61776fe1-c7e8-4260-8b55-ba5b305c7dc5', TRUE)



SELECT * FROM file WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd';

UPDATE file SET filehash = null WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;
UPDATE file SET filehash = '1123456789' WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;

INSERT INTO file (fileuid, accountuid, isdeleted, filehash) 
VALUES ('45c61d9c-f444-47ac-8b1a-6008054f3dcd', '61776fe1-c7e8-4260-8b55-ba5b305c7dc5', FALSE, '1123456789') 
ON CONFLICT (fileuid) 
DO UPDATE SET (accountuid, isdeleted, changetime, ishidden, filehash) = 
('61776fe1-c7e8-4260-8b55-ba5b305c7dc5', false, extract(epoch from date_trunc('second', (now() at time zone 'utc'))), FALSE, '1123456789') 
WHERE file.filehash = null
RETURNING fileuid, accountuid, isdir, islink, isdeleted, userattr, fileblocks, filesize, filehash, 
changetime, modifytime, accesstime, createtime;



INSERT INTO file (fileuid, accountuid, isdeleted) 
VALUES ('45c61d9c-f444-47ac-8b1a-6008054f3dcd', '61776fe1-c7e8-4260-8b55-ba5b305c7dc5', FALSE) 
ON CONFLICT (fileuid) 
DO UPDATE SET (accountuid, isdeleted, changetime, ishidden, ) = 
('61776fe1-c7e8-4260-8b55-ba5b305c7dc5', false, extract(epoch from date_trunc('second', (now() at time zone 'utc'))), FALSE) 
WHERE EXCLUDED.filehash is null 
RETURNING fileuid, accountuid, isdir, islink, isdeleted, userattr, fileblocks, filesize, filehash, 
changetime, modifytime, accesstime, createtime;




INSERT INTO file 
(fileuid, accountuid, isdir)
VALUES 
(gen_random_uuid(), gen_random_uuid(), TRUE)
ON CONFLICT (fileuid)
DO UPDATE SET
(isdir, changetime)
= (TRUE, extract(epoch from date_trunc('second', (now() at time zone 'utc'))))
RETURNING *;


INSERT INTO file 
(fileuid, accountuid, isdir)
VALUES 
('45c61d9c-f444-47ac-8b1a-6008054f3dcd', '61776fe1-c7e8-4260-8b55-ba5b305c7dc5', TRUE)
ON CONFLICT (fileuid)
DO UPDATE SET
(isdir, changetime)
= (TRUE, extract(epoch from date_trunc('second', (now() at time zone 'utc'))))
RETURNING *;




SELECT * FROM file WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd';

UPDATE file SET ishidden = TRUE WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;

UPDATE file SET isdir = TRUE WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;

UPDATE file SET isdir = FALSE WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;



