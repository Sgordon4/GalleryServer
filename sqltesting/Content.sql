SELECT * FROM file;

SELECT * FROM content;

SELECT * FROM journal;


INSERT INTO content (name) values ('A');

SELECT * FROM content WHERE name in ('A', 'C');


SELECT name FROM content 
WHERE name IN ('smiley.png');


SELECT EXISTS(SELECT 1 FROM content WHERE name IN ('B', 'D', 'F'));


DELETE FROM content WHERE createtime > '2024-08-16 23:27:49.163';