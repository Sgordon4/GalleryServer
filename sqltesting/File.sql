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
('45c61d9c-f444-47ac-8b1a-6008054f3dcd', '61776fe1-c7e8-4260-8b55-ba5b305c7dc5', TRUE)




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
('45c61d9c-f444-47ac-8b1a-6008054f3dcd', '61776fe1-c7e8-4260-8b55-ba5b305c7dc5', TRUE)
ON CONFLICT (fileuid)
DO UPDATE SET
(isdir, changetime)
= (TRUE, (now() at time zone 'utc'))
RETURNING *;




SELECT * FROM file WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd';

UPDATE file SET ishidden = TRUE WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;

UPDATE file SET isdir = TRUE WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;

UPDATE file SET isdir = FALSE WHERE fileuid = '45c61d9c-f444-47ac-8b1a-6008054f3dcd' RETURNING *;



